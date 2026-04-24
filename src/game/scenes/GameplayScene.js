import { CHARACTERS, CHARACTER_BY_ID } from '../config/characters.js';
import { MATERIALS } from '../config/materials.js';
import { playCharacterAnimation } from '../systems/animations.js';
import { hideHud, setHudMessage, updateHud } from '../systems/hud.js';
import {
  createDevTuningPanel,
  createGameplayTuning,
  isDevTuningEnabled,
  removeDevTuningPanel
} from '../systems/devTuning.js';
import {
  COLLISION_CATEGORIES,
  addMaterialBlock,
  addSpikeField,
  addStairs,
  addTriangleSlope,
  annotateBody,
  behaviorFor,
  collisionMaskForCharacter,
  createMaterialGroups
} from '../systems/materials.js';
import { createControlSet, updatePlayerMovement } from '../systems/playerControls.js';
import { levelEntryFor } from '../config/level-registry.js';
import { resolveLevelConfig } from '../systems/tiledLevel.js';
import { getNetworkSession } from '../systems/networkSession.js';

const PhaserScene = window.Phaser?.Scene ?? class {};
const CAMERA_VIEW = {
  width: 1280,
  height: 720,
  minWorldWidth: 860,
  minWorldHeight: 484,
  edgePaddingRatio: 0.22,
  minEdgePadding: 120,
  zoomLerp: 0.12,
  scrollLerp: 0.14
};
CAMERA_VIEW.aspect = CAMERA_VIEW.width / CAMERA_VIEW.height;

const GRAPPLE_TUNING = {
  swingForce: 0.34,
  alignedSwingBoost: 1.45,
  reelPump: 0.12,
  radialSpring: 0.034,
  radialDamping: 0.29,
  maxVelocityX: 23,
  maxVelocityY: 24
};

const ONE_WAY_PLATFORM = {
  sideInset: 10,
  standingOverlap: 1,
  landingOverlap: 2,
  previousAboveGrace: 6,
  catchAbove: 38,
  catchBelow: 56,
  stickMs: 220,
  stickBelow: 20,
  upwardGraceVelocity: -3.2
};

const PLAYER_BODY = {
  width: 42,
  height: 98
};

const DEATH_ANIMATION_DURATION_MS = 340;
const GREEN_LEAVES_OFFSET = 26;
const PLAYER_STACK_CENTER_PADDING = 10;
const JUMP_ANIMATION_AIRBORNE_MS = 45;
const BLUE_FALL_EFFECT = {
  maxChargeEnergy: 300,
  burstMs: 420,
  pixelSize: 8
};
const REACTIONS = {
  Digit4: 'Привет!',
  Digit5: 'Сюда!',
  Digit6: 'Готов!',
  Numpad4: 'Привет!',
  Numpad5: 'Сюда!',
  Numpad6: 'Готов!'
};

const GROUND_CONTACT = {
  topGraceAbove: 30,
  topGraceBelow: 18,
  minHorizontalOverlap: 4
};

function emptySharedInput() {
  return {
    left: false,
    right: false,
    down: false,
    jump: false,
    ability: false,
    jumpPressed: false,
    abilityPressed: false
  };
}

async function copyTextToClipboard(text) {
  const value = String(text ?? '').trim();

  if (!value) {
    return false;
  }

  if (copyTextWithTextarea(value)) {
    return true;
  }

  if (navigator.clipboard?.writeText && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

function copyTextWithTextarea(value) {
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', 'readonly');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, value.length);

  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}

function promptCopyText(value) {
  window.prompt('Скопируй код лобби:', value);
}

export class GameplayScene extends PhaserScene {
  constructor(sceneKey, level) {
    super(sceneKey);
    this.sourceLevel = level;
    this.level = level;
    this.players = [];
    this.goalState = {};
    this.completed = false;
  }

  create() {
    const Phaser = window.Phaser;

    this.level = resolveLevelConfig(this, this.sourceLevel);
    this.players = [];
    this.goalState = {};
    this.activatorState = {};
    this.activators = [];
    this.doors = [];
    this.bridges = [];
    this.slopes = [];
    this.bodyToPlayer = new Map();
    this.grappleLines = new Map();
    this.gameplayTuning = createGameplayTuning();
    this.completed = false;
    this.deaths = 0;

    this.matter.world.setBounds(0, 0, this.level.world.width, this.level.world.height + 160, 80, true, true, true, true);
    this.matter.world.setGravity(0, 2.25);
    this.matter.world.engine.positionIterations = 10;
    this.matter.world.engine.velocityIterations = 8;
    this.cameras.main.setBackgroundColor('#f5f6f2');

    this.drawBackdrop();
    this.materialGroups = createMaterialGroups(this);
    this.createLevelGeometry();
    this.createMechanics();
    this.createGoals();
    this.createPlayers();
    this.networkSession = getNetworkSession();
    this.networkSession?.enterGameplay(this);
    this.reactionTexts = new Map();
    this.reactionHandler = (event) => this.showReaction(event.detail);
    this.nextLevelRequestHandler = () => this.startNextLevel();
    this.restartLevelRequestHandler = () => this.restartCurrentLevel();
    this.networkSession?.addEventListener('reaction', this.reactionHandler);
    this.networkSession?.addEventListener('nextLevelRequest', this.nextLevelRequestHandler);
    this.networkSession?.addEventListener('restartLevelRequest', this.restartLevelRequestHandler);
    this.input.keyboard.on('keydown', this.handleReactionKey, this);
    this.createUi();
    this.createLobbyCodePanel();
    this.createReactionHintOverlay();
    this.createDevUi();

    this.matter.world.on('collisionstart', this.handleMatterCollision, this);
    this.matter.world.on('collisionactive', this.handleMatterCollision, this);
    const matterEvents = window.Matter?.Events ?? window.Phaser?.Physics?.Matter?.Matter?.Events;
    const matterEngine = this.matter.world.engine;

    this.beforeMatterSolve = () => this.disableBadOneWayPlatformPairsBeforeSolve();
    matterEvents?.on?.(matterEngine, 'beforeSolve', this.beforeMatterSolve);
    this.resetKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.menuKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.nextKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    this.sharedKeys = this.input.keyboard.addKeys({
      leftA: Phaser.Input.Keyboard.KeyCodes.A,
      rightD: Phaser.Input.Keyboard.KeyCodes.D,
      jumpSpace: Phaser.Input.Keyboard.KeyCodes.SPACE,
      abilityE: Phaser.Input.Keyboard.KeyCodes.E
    });
    const matterWorld = this.matter.world;
    this.events.once('shutdown', () => {
      matterWorld?.off?.('collisionstart', this.handleMatterCollision, this);
      matterWorld?.off?.('collisionactive', this.handleMatterCollision, this);
      matterEvents?.off?.(matterEngine, 'beforeSolve', this.beforeMatterSolve);
      this.input.keyboard.off('keydown', this.handleReactionKey, this);
      this.networkSession?.removeEventListener('reaction', this.reactionHandler);
      this.networkSession?.removeEventListener('nextLevelRequest', this.nextLevelRequestHandler);
      this.networkSession?.removeEventListener('restartLevelRequest', this.restartLevelRequestHandler);
      this.networkSession?.leaveGameplay(this);
      this.lobbyCodePanel?.destroy();
      this.removeLobbyCodeOverlay();
      this.removeReactionHintOverlay();
      removeDevTuningPanel();
      hideHud();
    });
  }

  update(time) {
    const Phaser = window.Phaser;
    this.frameSharedInput = this.readSharedInput();

    if (Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      this.restartCurrentLevel();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.scene.start('MenuScene');
      return;
    }

    if (this.completed && Phaser.Input.Keyboard.JustDown(this.nextKey) && this.level.nextLevel) {
      this.startNextLevel();
      return;
    }

    this.syncSleepingPlayers(time);

    for (const player of this.players) {
      if (player.sleeping) {
        this.updateLight(player);
        this.updateSleepingText(player, time);
        continue;
      }

      if (player.respawning) {
        this.updateLight(player);
        this.updateGrappleLeaves(player);
        this.updateBlueFallEffect(player, time);
        continue;
      }

      player.frameInput = this.inputForPlayer(player);

      if (this.networkSession?.connected && !this.networkSession.isHost) {
        this.updateLight(player);
        this.updateGrappleLeaves(player);
        this.updateBlueFallEffect(player, time);
        continue;
      }

      updatePlayerMovement(player, time, player.frameInput);
      if (player.frameInput.jumpPressed && time - player.lastJumpedAt < 40) {
        this.networkSession?.acknowledgeRemoteJump?.(player.character.id);
      }
      this.updateLight(player);
      this.updateGrappleLeaves(player);
      this.updateBlueFallEffect(player, time);

      this.updatePlayerAnimation(player, time);

      if (player.sprite.y > this.level.world.height + 90) {
        this.respawnPlayer(player, 'Р С—Р В°Р Т‘Р ВµР Р…Р С‘Р Вµ');
      }
    }

    this.updateGrapples(time);
    this.updateMechanics();
    this.networkSession?.updateInterpolation();
    this.updateNetworkInterpolatedAnimations(time);
    this.updateCamera();
    this.updateGoals();
    this.networkSession?.sendSnapshot(time);
  }

  inputForPlayer(player) {
    const Phaser = window.Phaser;
    const sharedInput = this.sharedInputFor(player);

    if (this.networkSession?.connected) {
      return this.networkSession.inputFor(player.character.id, {
        characterId: player.character.id,
        ...sharedInput
      });
    }

    const useSpaceJump = this.shouldUseSpaceJump(player);
    const localInput = {
      characterId: player.character.id,
      left: player.keys.left.isDown || sharedInput.left,
      right: player.keys.right.isDown || sharedInput.right,
      down: Boolean(player.keys.down?.isDown) || sharedInput.down,
      jump: player.keys.jump.isDown || useSpaceJump || sharedInput.jump,
      ability: Boolean(player.keys.ability?.isDown) || sharedInput.ability,
      jumpPressed:
        Phaser.Input.Keyboard.JustDown(player.keys.jump) ||
        (useSpaceJump && Phaser.Input.Keyboard.JustDown(player.keys.spaceJump)) ||
        sharedInput.jumpPressed,
      abilityPressed:
        (player.keys.ability ? Phaser.Input.Keyboard.JustDown(player.keys.ability) : false) || sharedInput.abilityPressed
    };

    return this.networkSession?.inputFor(player.character.id, localInput) ?? localInput;
  }

  sharedInputFor(player) {
    if (this.networkSession?.connected && !this.networkSession.ownsCharacter(player.character.id)) {
      return emptySharedInput();
    }

    return this.frameSharedInput ?? emptySharedInput();
  }

  readSharedInput() {
    const Phaser = window.Phaser;
    const keys = this.sharedKeys;

    if (!keys) {
      return emptySharedInput();
    }

    return {
      left: keys.leftA.isDown,
      right: keys.rightD.isDown,
      down: false,
      jump: keys.jumpSpace.isDown,
      ability: keys.abilityE.isDown,
      jumpPressed: Phaser.Input.Keyboard.JustDown(keys.jumpSpace),
      abilityPressed: Phaser.Input.Keyboard.JustDown(keys.abilityE)
    };
  }

  shouldUseSpaceJump(player) {
    if (!player.keys.spaceJump?.isDown) {
      return false;
    }

    if (!this.networkSession?.connected) {
      return true;
    }

    return this.networkSession.ownsCharacter(player.character.id);
  }

  updatePlayerAnimation(player, time) {
    const airborne = time - player.onGroundAt >= JUMP_ANIMATION_AIRBORNE_MS;
    const movingByVelocity = Math.abs(player.sprite.body?.velocity?.x ?? 0) > 0.4;
    const animationState = airborne ? 'jump' : player.isMoving || movingByVelocity ? 'run' : 'idle';
    playCharacterAnimation(player.sprite, player.character, animationState);
  }

  updateNetworkInterpolatedAnimations(time) {
    if (!this.networkSession?.connected || this.networkSession.isHost) {
      return;
    }

    for (const player of this.players) {
      if (player.sleeping) {
        continue;
      }

      if (player.respawning) {
        this.updateLight(player);
        this.updateGrappleLeaves(player);
        this.updateBlueFallEffect(player, time);
        continue;
      }

      this.updateLight(player);
      this.updateGrappleLeaves(player);
      this.updateBlueFallEffect(player, time);
      this.updatePlayerAnimation(player, time);
    }
  }

  applyNetworkPlayerState(player, state, time) {
    if (player.character.id === 'green') {
      this.applyNetworkGrappleState(player, state.grapple, time);
    }

    if (player.character.id === 'blue') {
      this.applyNetworkBlueFallState(player, state.blueFall, time);
    }
  }

  applyNetworkGrappleState(player, grapple, time) {
    if (!grapple?.anchorId) {
      if (player.grapple) {
        player.grapple = null;
      }

      this.clearGrappleLine(player);
      return;
    }

    const anchor = this.level.grappleAnchors?.find((candidate) => candidate.id === grapple.anchorId);

    if (!anchor) {
      player.grapple = null;
      this.clearGrappleLine(player);
      return;
    }

    player.grapple = {
      anchor,
      length: grapple.length ?? Math.hypot(anchor.x - player.sprite.x, anchor.y - player.sprite.y),
      attachedAt: player.grapple?.attachedAt ?? time
    };
    this.drawGrappleLine(player, anchor);
  }

  applyNetworkBlueFallState(player, blueFall, time) {
    if (!blueFall) {
      player.blueFallEnergy = 0;
      player.blueFallJumpUsed = false;
      player.blueFallJumpBurstAt = -1000;
      player.blueFallJumpBurstEnergy = 0;
      return;
    }

    player.blueFallEnergy = blueFall.energy ?? 0;
    player.blueFallJumpUsed = Boolean(blueFall.jumpUsed);
    player.blueFallJumpBurstEnergy = blueFall.burstEnergy ?? 0;
    player.blueFallJumpBurstAt = blueFall.burstAge === null ? -1000 : time - blueFall.burstAge;
  }

  syncSleepingPlayers(time) {
    for (const player of this.players) {
      this.setPlayerSleeping(player, !this.isCharacterActive(player.character.id));

      if (player.sleeping) {
        this.updateSleepingText(player, time);
      }
    }
  }

  isCharacterActive(characterId) {
    if (!this.networkSession?.connected) {
      return true;
    }

    return (this.networkSession.lobby?.players ?? []).some((player) => player.characterId === characterId);
  }

  setPlayerSleeping(player, sleeping) {
    if (player.sleeping === sleeping) {
      return;
    }

    player.sleeping = sleeping;

    if (sleeping) {
      if (player.grapple) {
        player.grapple = null;
        this.clearGrappleLine(player);
      }

      player.sprite.setVelocity(0, 0);
      player.sprite.setIgnoreGravity(true);
      player.sprite.body.collisionFilter.mask = 0;
      player.sprite.setAlpha(0.34);
      player.aura.setAlpha(0.05);
      player.sleepText = this.add
        .text(player.sprite.x, player.sprite.y - 90, 'zZzZ', {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '22px',
          fontStyle: '700',
          color: '#111111',
          backgroundColor: '#ffffff',
          padding: { x: 8, y: 4 }
        })
        .setOrigin(0.5)
        .setDepth(20)
        .setResolution(2);
      return;
    }

    player.sprite.setAlpha(1);
    player.sprite.setIgnoreGravity(false);
    player.sprite.body.collisionFilter.mask = player.collisionMask;
    player.sleepText?.destroy();
    player.sleepText = null;
  }

  updateSleepingText(player, time) {
    if (!player.sleepText) {
      return;
    }

    const dots = 2 + Math.floor(time / 350) % 4;
    player.sleepText.setText(`zZ${'z'.repeat(dots)}`);
    player.sleepText.setPosition(player.sprite.x, player.sprite.y - 90 + Math.sin(time / 260) * 6);
  }

  handleReactionKey(event) {
    const label = REACTIONS[event.code];

    if (!label) {
      return;
    }

    if (this.networkSession?.connected) {
      this.networkSession.sendReaction(label);
      return;
    }

    this.showReaction({ characterId: this.players[0]?.character.id, label });
  }

  showReaction(detail) {
    const player = this.players.find((candidate) => candidate.character.id === detail?.characterId) ?? this.players[0];

    if (!player || !detail?.label) {
      return;
    }

    const previous = this.reactionTexts.get(player.character.id);
    previous?.destroy();

    const text = this.add
      .text(player.sprite.x, player.sprite.y - 96, detail.label, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '24px',
        fontStyle: '700',
        color: '#111111',
        backgroundColor: '#ffffff',
        padding: { x: 10, y: 5 }
      })
      .setOrigin(0.5)
      .setDepth(20)
      .setResolution(2);

    this.reactionTexts.set(player.character.id, text);
    this.tweens.add({
      targets: text,
      y: text.y - 48,
      alpha: 0,
      duration: 1300,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        if (this.reactionTexts.get(player.character.id) === text) {
          this.reactionTexts.delete(player.character.id);
        }

        text.destroy();
      }
    });
  }

  createLobbyCodePanel() {
    const code = this.networkSession?.code;

    if (!code) {
      return;
    }

    this.createLobbyCodeOverlay(code);

    this.lobbyCodePanel = this.add
      .text(1032, 18, `КОД ЛОББИ: ${code}\nклик - копировать`, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '18px',
        fontStyle: '700',
        color: '#111111',
        align: 'center',
        backgroundColor: '#ffffff',
        padding: { x: 12, y: 8 }
      })
      .setScrollFactor(0)
      .setDepth(100)
      .setResolution(2)
      .setInteractive({ useHandCursor: true });

    this.lobbyCodePanel.on('pointerdown', async () => {
      if (await copyTextToClipboard(code)) {
        this.lobbyCodePanel.setText(`КОД ЛОББИ: ${code}\nскопировано`);
      } else {
        promptCopyText(code);
        this.lobbyCodePanel.setText(`КОД ЛОББИ: ${code}\nвыдели код вручную`);
      }

      this.time.delayedCall(1200, () => {
        this.lobbyCodePanel?.setText(`КОД ЛОББИ: ${code}\nклик - копировать`);
      });
    });
  }

  createLobbyCodeOverlay(code) {
    this.removeLobbyCodeOverlay();

    const overlay = document.createElement('button');
    overlay.type = 'button';
    overlay.className = 'lobby-code-overlay';
    overlay.innerHTML = `<span>КОД ЛОББИ</span><strong>${code}</strong><small>клик - копировать</small>`;
    overlay.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (await copyTextToClipboard(code)) {
        overlay.querySelector('small').textContent = 'скопировано';
      } else {
        promptCopyText(code);
        overlay.querySelector('small').textContent = 'выдели код вручную';
      }

      window.setTimeout(() => {
        if (overlay.isConnected) {
          overlay.querySelector('small').textContent = 'клик - копировать';
        }
      }, 1200);
    });

    document.body.append(overlay);
    this.lobbyCodeOverlay = overlay;
  }

  removeLobbyCodeOverlay() {
    this.lobbyCodeOverlay?.remove();
    this.lobbyCodeOverlay = null;
  }

  createReactionHintOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'reaction-hint-overlay';
    overlay.textContent = 'Можно оставлять реакции: 4 - Привет!, 5 - Сюда!, 6 - Готов!';
    document.body.append(overlay);
    this.reactionHintOverlay = overlay;

    this.reactionHintTimeout = window.setTimeout(() => {
      this.removeReactionHintOverlay();
    }, 10000);
  }

  removeReactionHintOverlay() {
    if (this.reactionHintTimeout) {
      window.clearTimeout(this.reactionHintTimeout);
      this.reactionHintTimeout = null;
    }

    this.reactionHintOverlay?.remove();
    this.reactionHintOverlay = null;
  }

  createLevelGeometry() {
    for (const block of this.level.neutral) {
      addMaterialBlock(this, this.materialGroups.neutral, 'neutral', block);
    }

    for (const item of this.level.materials) {
      const group = this.materialGroups[item.material];

      if (item.shape === 'spikes') {
        addSpikeField(this, group, item.material, item);
      } else if (item.shape === 'stairs') {
        addStairs(this, group, item.material, item);
      } else if (item.shape === 'slope') {
        this.slopes.push(addTriangleSlope(this, item.material, item));
      } else {
        addMaterialBlock(this, group, item.material, item);
      }
    }

    for (const note of this.level.notes) {
      this.add
        .text(note.x, note.y, note.text, {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '18px',
          color: '#111111'
        })
        .setResolution(2)
        .setScrollFactor(1);
    }

    for (const anchor of this.level.grappleAnchors ?? []) {
      this.add.circle(anchor.x, anchor.y, 10, 0x8fc68d, 0.9).setStrokeStyle(3, 0x111111, 0.75);
      this.add.circle(anchor.x, anchor.y, 22, 0x8fc68d, 0.12).setBlendMode(window.Phaser.BlendModes.ADD);
    }
  }

  createPlayers() {
    for (const character of CHARACTERS) {
      const collisionMask = collisionMaskForCharacter(character);
      const spawn = this.spawnFor(character);
      const sprite = this.matter.add.sprite(spawn.x, spawn.y, character.textureKey, 0);

      sprite.setScale(2.97);
      sprite.setRectangle(PLAYER_BODY.width, PLAYER_BODY.height);
      sprite.setFixedRotation();
      sprite.setFriction(0, 0.018, 0);
      sprite.setFrictionAir(0.018);
      sprite.setBounce(0.01);
      sprite.setMass(2.2);
      sprite.setCollisionCategory(COLLISION_CATEGORIES.player);
      sprite.setCollidesWith(collisionMask);
      sprite.setDepth(2);

      const aura = this.add.circle(sprite.x, sprite.y, 74, character.lightColor, 0.18);
      aura.setBlendMode(window.Phaser.BlendModes.ADD);
      aura.setDepth(1);
      const grappleLeaves =
        character.id === 'green'
          ? this.add.sprite(sprite.x, sprite.y, 'green-leaves', 0).setDepth(4).setScale(2.2).setVisible(false)
          : null;
      const blueFallEffect =
        character.id === 'blue' ? this.add.graphics().setDepth(5).setVisible(false) : null;

      const player = {
        character,
        sprite,
        aura,
        grappleLeaves,
        blueFallEffect,
        keys: createControlSet(this, character.controls),
        collisionMask,
        lastSurface: 'neutral',
        surfaceTouchedAt: 0,
        onGroundAt: -1000,
        lastJumpedAt: -1000,
        ridingPlayerAt: -1000,
        oneWayPlatformBody: null,
        oneWayPlatformAt: -1000,
        slopeMomentumUntil: 0,
        slipperyJumpCount: 0,
        blueFallJumpUsed: false,
        blueFallEnergy: 0,
        blueFallLastY: spawn.y,
        blueFallJumpBurstAt: -1000,
        blueFallJumpBurstEnergy: 0,
        slopeSlideDirection: -1,
        sleeping: false,
        sleepText: null,
        respawning: false
      };

      annotateBody(sprite.body, { gameKind: 'player', playerId: character.id });
      this.registerPlayerBody(player);
      this.players.push(player);
      playCharacterAnimation(sprite, character, 'idle');
    }
  }

  spawnFor(character) {
    return this.level.spawns?.[character.id] ?? character.spawn;
  }

  registerPlayerBody(player) {
    const bodies = player.sprite.body.parts?.length ? player.sprite.body.parts : [player.sprite.body];

    for (const body of bodies) {
      body.gameKind = 'player';
      body.playerId = player.character.id;
      this.bodyToPlayer.set(body.id, player);
    }

    this.bodyToPlayer.set(player.sprite.body.id, player);
  }

  handleMatterCollision(event) {
    const time = this.time.now;

    for (const pair of event.pairs) {
      const bodyA = this.rootBody(pair.bodyA);
      const bodyB = this.rootBody(pair.bodyB);
      const playerA = this.playerFromBody(bodyA);
      const playerB = this.playerFromBody(bodyB);

      if (this.disableBadOneWayPlatformPair(pair, playerA, bodyB) || this.disableBadOneWayPlatformPair(pair, playerB, bodyA)) {
        continue;
      }

      if (playerA && playerB) {
        this.handlePlayerPair(playerA, playerB, time);
        continue;
      }

      if (playerA) {
        this.handlePlayerWorldContact(playerA, bodyB, time);
      }

      if (playerB) {
        this.handlePlayerWorldContact(playerB, bodyA, time);
      }
    }
  }

  disableBadOneWayPlatformPairsBeforeSolve() {
    for (const pair of this.matter.world.engine.pairs.list ?? []) {
      const bodyA = this.rootBody(pair.bodyA);
      const bodyB = this.rootBody(pair.bodyB);
      const playerA = this.playerFromBody(bodyA);
      const playerB = this.playerFromBody(bodyB);

      this.disableBadOneWayPlatformPair(pair, playerA, bodyB);
      this.disableBadOneWayPlatformPair(pair, playerB, bodyA);
    }
  }

  disableBadOneWayPlatformPair(pair, player, otherBody) {
    if (!player || !otherBody?.oneWayPlatform) {
      return false;
    }

    if (this.isValidOneWayPlatformContact(player, otherBody)) {
      pair.isSensor = false;
      return false;
    }

    pair.isSensor = true;
    pair.separation = 0;

    if (pair.collision) {
      pair.collision.depth = 0;
    }

    return true;
  }

  handlePlayerPair(first, second, time) {
    if (first.respawning || second.respawning) {
      return;
    }

    if (this.isAbove(first.sprite.body, second.sprite.body, PLAYER_STACK_CENTER_PADDING)) {
      this.markGrounded(first, 'neutral', time, second.sprite.body);
      first.ridingPlayerAt = time;
    } else if (this.isAbove(second.sprite.body, first.sprite.body, PLAYER_STACK_CENTER_PADDING)) {
      this.markGrounded(second, 'neutral', time, first.sprite.body);
      second.ridingPlayerAt = time;
    }
  }

  handlePlayerWorldContact(player, otherBody, time) {
    if (player.respawning || !otherBody) {
      return;
    }

    const material = otherBody.material ?? 'neutral';

    if (otherBody.gameKind === 'sensor') {
      if (behaviorFor(player.character, material) === 'deadly') {
        this.respawnPlayer(player, MATERIALS[material].label);
      }

      return;
    }

    if (otherBody.gameKind !== 'surface' && otherBody.gameKind !== 'door') {
      return;
    }

    if (otherBody.slope) {
      this.markGrounded(player, material, time, otherBody);
      return;
    }

    if (otherBody.oneWayPlatform && !this.isValidOneWayPlatformContact(player, otherBody)) {
      return;
    }

    if (this.isAbove(player.sprite.body, otherBody, 8)) {
      this.markGrounded(player, material, time, otherBody);
    }
  }

  isValidOneWayPlatformContact(playerConfig, platformBody) {
    const player = this.rootBody(playerConfig.sprite.body);
    const platform = this.rootBody(platformBody);
    const playerHeight = player.bounds.max.y - player.bounds.min.y;
    const previousBottom = (player.positionPrev?.y ?? player.position.y) + playerHeight / 2;
    const currentBottom = player.bounds.max.y;
    const topY = platform.topY ?? platform.bounds.min.y;
    const platformMinX = platform.minX ?? platform.bounds.min.x;
    const platformMaxX = platform.maxX ?? platform.bounds.max.x;
    const innerMinX = platformMinX + ONE_WAY_PLATFORM.sideInset;
    const innerMaxX = platformMaxX - ONE_WAY_PLATFORM.sideInset;
    const standingOverlap = Math.min(player.bounds.max.x, platformMaxX) - Math.max(player.bounds.min.x, platformMinX);
    const landingOverlap = Math.min(player.bounds.max.x, innerMaxX) - Math.max(player.bounds.min.x, innerMinX);
    const stillOverPlatform = standingOverlap >= ONE_WAY_PLATFORM.standingOverlap;
    const canLandOnPlatform = landingOverlap >= ONE_WAY_PLATFORM.landingOverlap;
    const recentlyGroundedHere =
      playerConfig.oneWayPlatformBody === platform && this.time.now - playerConfig.oneWayPlatformAt <= ONE_WAY_PLATFORM.stickMs;
    const cameFromAbove = previousBottom <= topY + ONE_WAY_PLATFORM.previousAboveGrace;
    const crossedTop = currentBottom >= topY - ONE_WAY_PLATFORM.catchAbove && currentBottom <= topY + ONE_WAY_PLATFORM.catchBelow;
    const fallingOrResting = player.velocity.y >= -1.2;
    const stillStandingOnTop =
      recentlyGroundedHere &&
      stillOverPlatform &&
      currentBottom >= topY - 32 &&
      currentBottom <= topY + ONE_WAY_PLATFORM.stickBelow &&
      player.velocity.y >= ONE_WAY_PLATFORM.upwardGraceVelocity;

    return stillStandingOnTop || (canLandOnPlatform && cameFromAbove && crossedTop && fallingOrResting);
  }

  markGrounded(player, material, time, body) {
    player.onGroundAt = time;
    player.lastSurface = material;
    player.surfaceTouchedAt = time;
    player.slopeSlideDirection = body.slideDirection ?? (material === 'blue' ? -1 : 1);

    if (body.oneWayPlatform) {
      player.oneWayPlatformBody = this.rootBody(body);
      player.oneWayPlatformAt = time;
    } else if (!body.slope) {
      player.oneWayPlatformBody = null;
      player.oneWayPlatformAt = -1000;
    }

    if (body.slope && behaviorFor(player.character, material) === 'slippery') {
      player.slopeMomentumUntil = Math.max(player.slopeMomentumUntil, time + 700);
    }
  }

  isAbove(upperBody, lowerBody, centerPadding) {
    const upper = this.rootBody(upperBody);
    const lower = this.rootBody(lowerBody);
    const upperBottom = upper.bounds.max.y;
    const lowerTop = lower.bounds.min.y;
    const centerAbove = upper.position.y < lower.position.y - centerPadding;
    const horizontalOverlap = Math.min(upper.bounds.max.x, lower.bounds.max.x) - Math.max(upper.bounds.min.x, lower.bounds.min.x);
    const closeToTop =
      upperBottom >= lowerTop - GROUND_CONTACT.topGraceAbove && upperBottom <= lowerTop + GROUND_CONTACT.topGraceBelow;

    return centerAbove && horizontalOverlap >= GROUND_CONTACT.minHorizontalOverlap && closeToTop;
  }

  rootBody(body) {
    if (!body) {
      return null;
    }

    return body.parent && body.parent !== body ? body.parent : body;
  }

  playerFromBody(body) {
    if (!body) {
      return null;
    }

    return this.bodyToPlayer.get(body.id) ?? this.bodyToPlayer.get(body.parent?.id) ?? null;
  }

  updateGrapples(time) {
    const Phaser = window.Phaser;
    const green = this.players.find((player) => player.character.id === 'green');

    if (!green || !this.level.grappleAnchors?.length) {
      return;
    }

    if (green.frameInput?.abilityPressed) {
      this.toggleGrapple(green, time);
    }

    if (green.grapple) {
      const { anchor } = green.grapple;

      if (!this.hasGrappleLineOfSight(green, anchor)) {
        green.grapple = null;
        this.clearGrappleLine(green);
        return;
      }

      const body = green.sprite.body;
      const tuning = this.gameplayTuning;
      const dx = green.sprite.x - anchor.x;
      const dy = green.sprite.y - anchor.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const minLength = anchor.minLength ?? 74;
      const maxLength = anchor.maxLength ?? anchor.radius;
      const lengthDelta = (green.frameInput?.jump ? -4.6 : 0) + (green.frameInput?.down ? 4.6 : 0);
      const inputAxis = (green.frameInput?.right ? 1 : 0) - (green.frameInput?.left ? 1 : 0);

      green.grapple.length = Phaser.Math.Clamp(green.grapple.length + lengthDelta, minLength, maxLength);

      const normalX = dx / distance;
      const normalY = dy / distance;
      const tangentX = -normalY;
      const tangentY = normalX;
      const radialVelocity = body.velocity.x * normalX + body.velocity.y * normalY;
      const tangentVelocity = body.velocity.x * tangentX + body.velocity.y * tangentY;
      const stretch = distance - green.grapple.length;
      const correction = stretch * GRAPPLE_TUNING.radialSpring + radialVelocity * GRAPPLE_TUNING.radialDamping;
      const tangentInput = inputAxis === 0 ? 0 : inputAxis * Math.sign(tangentX || 1);
      const swingAlignment = Math.sign(tangentVelocity) === Math.sign(tangentInput) ? GRAPPLE_TUNING.alignedSwingBoost : 1;
      const swingImpulse = tangentInput * GRAPPLE_TUNING.swingForce * swingAlignment * tuning.grappleSwingScale;
      const reelImpulse =
        lengthDelta < 0 && Math.abs(tangentVelocity) > 0.7
          ? Math.sign(tangentVelocity) * GRAPPLE_TUNING.reelPump * tuning.grappleSwingScale
          : 0;
      const nextVelocityX = body.velocity.x - normalX * correction + tangentX * (swingImpulse + reelImpulse);
      const nextVelocityY = body.velocity.y - normalY * correction + tangentY * (swingImpulse + reelImpulse);

      green.sprite.setVelocity(
        Phaser.Math.Clamp(
          nextVelocityX,
          -GRAPPLE_TUNING.maxVelocityX * tuning.grappleSpeedScale,
          GRAPPLE_TUNING.maxVelocityX * tuning.grappleSpeedScale
        ),
        Phaser.Math.Clamp(
          nextVelocityY,
          -GRAPPLE_TUNING.maxVelocityY * tuning.grappleSpeedScale,
          GRAPPLE_TUNING.maxVelocityY * tuning.grappleSpeedScale
        )
      );
      green.slopeMomentumUntil = time + 1500;
      this.drawGrappleLine(green, anchor);
    } else {
      this.clearGrappleLine(green);
    }
  }

  toggleGrapple(player, time) {
    const Phaser = window.Phaser;

    if (player.grapple) {
      player.grapple = null;
      this.clearGrappleLine(player);
      return;
    }

    const anchor = this.findGrappleAnchor(player);

    if (!anchor) {
      return;
    }

    const distance = Math.hypot(anchor.x - player.sprite.x, anchor.y - player.sprite.y);
    player.grapple = {
      anchor,
      length: Phaser.Math.Clamp(distance, anchor.minLength ?? 74, anchor.maxLength ?? anchor.radius),
      attachedAt: time
    };
    this.currentMessage = 'Мята держится лозой. I/M - длина, J/L - раскачка, O - отпустить';
    setHudMessage(this.currentMessage);
  }

  findGrappleAnchor(player) {
    let best = null;
    let bestDistance = Infinity;

    for (const anchor of this.level.grappleAnchors ?? []) {
      const distance = Math.hypot(anchor.x - player.sprite.x, anchor.y - player.sprite.y);

      if (distance <= anchor.radius && distance < bestDistance && this.hasGrappleLineOfSight(player, anchor)) {
        best = anchor;
        bestDistance = distance;
      }
    }

    return best;
  }

  hasGrappleLineOfSight(player, anchor) {
    const Matter = window.Matter ?? window.Phaser?.Physics?.Matter?.Matter;
    const query = Matter?.Query;

    if (!query?.ray) {
      return true;
    }

    const from = { x: player.sprite.x, y: player.sprite.y };
    const to = { x: anchor.x, y: anchor.y };
    const bodies = (Matter.Composite?.allBodies?.(this.matter.world.engine.world) ?? []).filter((body) => {
      const root = this.rootBody(body);
      return root && !root.isSensor && (root.gameKind === 'surface' || root.gameKind === 'door');
    });
    const hits = query.ray(bodies, from, to, 6);

    return !hits.some((hit) => {
      const root = this.rootBody(hit.body);
      return root && !root.isSensor && (root.gameKind === 'surface' || root.gameKind === 'door');
    });
  }

  drawGrappleLine(player, anchor) {
    let line = this.grappleLines.get(player.character.id);

    if (!line) {
      line = this.add.graphics().setDepth(3);
      this.grappleLines.set(player.character.id, line);
    }

    line.clear();
    line.lineStyle(5, player.character.color, 0.92);
    line.beginPath();
    line.moveTo(player.sprite.x, player.sprite.y);
    line.lineTo(anchor.x, anchor.y);
    line.strokePath();
  }

  clearGrappleLine(player) {
    const line = this.grappleLines.get(player.character.id);

    if (line) {
      line.clear();
    }

    this.updateGrappleLeaves(player);
  }

  updateGrappleLeaves(player) {
    const leaves = player.grappleLeaves;
    const anchor = player.grapple?.anchor;

    if (!leaves) {
      return;
    }

    if (player.respawning || !anchor) {
      leaves.setVisible(false);
      leaves.anims.stop();
      leaves.setFrame(0);
      return;
    }

    const angle = Math.atan2(anchor.y - player.sprite.y, anchor.x - player.sprite.x);

    leaves.setVisible(true);
    leaves.setPosition(
      player.sprite.x + Math.cos(angle) * GREEN_LEAVES_OFFSET,
      player.sprite.y + Math.sin(angle) * GREEN_LEAVES_OFFSET
    );
    leaves.setRotation(angle);

    if (leaves.anims.currentAnim?.key !== 'green:leaves' || !leaves.anims.isPlaying) {
      leaves.anims.play('green:leaves', true);
    }
  }

  updateBlueFallEffect(player, time) {
    const effect = player.blueFallEffect;

    if (!effect) {
      return;
    }

    effect.clear();

    const burstAge = time - (player.blueFallJumpBurstAt ?? -1000);
    const burstProgress = burstAge >= 0 && burstAge <= BLUE_FALL_EFFECT.burstMs ? 1 - burstAge / BLUE_FALL_EFFECT.burstMs : 0;
    const charge = window.Phaser.Math.Clamp((player.blueFallEnergy ?? 0) / BLUE_FALL_EFFECT.maxChargeEnergy, 0, 1);

    if (player.respawning || (charge <= 0.015 && burstProgress <= 0)) {
      effect.setVisible(false);
      return;
    }

    const x = Math.round(player.sprite.x);
    const y = Math.round(player.sprite.y);
    const pixel = BLUE_FALL_EFFECT.pixelSize;

    effect.setVisible(true);

    if (charge > 0.03 && !player.blueFallJumpUsed) {
      const sparkCount = 5 + Math.floor(charge * 13);

      for (let index = 0; index < sparkCount; index += 1) {
        const side = index % 2 === 0 ? -1 : 1;
        const ring = Math.floor(index / 2);
        const drift = Math.sin(time / 62 + index * 1.7) * 8;
        const px = Math.round(x + side * (34 + ring * 5) + drift);
        const py = Math.round(y - 48 + ((index * 19 + Math.floor(time / 18)) % 118));
        const color = index % 4 === 0 ? 0xf5f6f2 : index % 2 === 0 ? 0x89d0ff : 0x5fa1c9;

        effect.fillStyle(color, 0.42 + charge * 0.56);
        effect.fillRect(px, py, pixel, pixel);
      }

      const chunks = Math.max(1, Math.floor(charge * 9));

      for (let index = 0; index < chunks; index += 1) {
        effect.fillStyle(index % 3 === 0 ? 0xf5f6f2 : index % 2 === 0 ? 0x5fa1c9 : 0x89d0ff, 0.64 + charge * 0.32);
        effect.fillRect(Math.round(x - 44 + index * 11), Math.round(y + 70), 9, 9);
      }
    }

    if (burstProgress > 0) {
      const burstCharge = window.Phaser.Math.Clamp((player.blueFallJumpBurstEnergy ?? 0) / BLUE_FALL_EFFECT.maxChargeEnergy, 0.25, 1);
      const radius = 30 + (1 - burstProgress) * 96 * burstCharge;
      const alpha = burstProgress;

      for (let index = 0; index < 20; index += 1) {
        const angle = (Math.PI * 2 * index) / 20;
        const px = Math.round(x + Math.cos(angle) * radius);
        const py = Math.round(y + Math.sin(angle) * radius);

        effect.fillStyle(index % 2 === 0 ? 0x89d0ff : 0xf5f6f2, alpha);
        effect.fillRect(px, py, pixel + 3, pixel + 3);
      }
    }
  }

  createMechanics() {
    const activatorConfigs = [
      ...(this.level.switches ?? []).map((config) => ({ ...config, type: 'switch' })),
      ...(this.level.plates ?? []).map((config) => ({ ...config, type: 'plate' }))
    ];

    for (const config of activatorConfigs) {
      const zone = this.add
        .rectangle(config.x, config.y, config.width, config.height, config.color, 0.28)
        .setOrigin(0, 0)
        .setStrokeStyle(3, config.color, 1);

      this.activatorState[config.id] = false;
      this.activators.push({ config, zone });
    }

    for (const config of this.level.doors ?? []) {
      const door = this.add
        .rectangle(config.x, config.y, config.width, config.height, config.color, 1)
        .setOrigin(0, 0)
        .setStrokeStyle(3, 0xffffff, 0.16);
      const body = this.createDoorBody(config);

      this.doors.push({ config, door, body, open: false });
    }

    for (const config of this.level.bridges ?? []) {
      const platform = this.add
        .rectangle(config.x, config.y, config.width, config.height, config.color ?? 0x111111, 0.16)
        .setOrigin(0, 0)
        .setStrokeStyle(3, config.color ?? 0x111111, 0.5);

      this.bridges.push({ config, platform, body: null, active: false });
    }
  }

  createDoorBody(config) {
    const body = this.matter.add.rectangle(config.x + config.width / 2, config.y + config.height / 2, config.width, config.height, {
      isStatic: true,
      friction: 0,
      frictionStatic: 0,
      collisionFilter: {
        category: COLLISION_CATEGORIES.door,
        mask: COLLISION_CATEGORIES.player
      }
    });

    return annotateBody(body, { gameKind: 'door', material: 'neutral' });
  }

  createBridgeBody(config) {
    const body = this.matter.add.rectangle(config.x + config.width / 2, config.y + config.height / 2, config.width, config.height, {
      isStatic: true,
      friction: 0,
      frictionStatic: 0,
      collisionFilter: {
        category: COLLISION_CATEGORIES.neutral,
        mask: COLLISION_CATEGORIES.player
      }
    });

    return annotateBody(body, { gameKind: 'surface', material: 'neutral', bridge: true });
  }

  updateMechanics() {
    const Phaser = window.Phaser;

    for (const activator of this.activators) {
      const { config, zone } = activator;
      const pressed = this.players.some((player) => {
        if (player.sleeping) {
          return false;
        }

        const matchesCharacter = config.requires === 'any' || config.requires === player.character.id;
        return matchesCharacter && Phaser.Geom.Intersects.RectangleToRectangle(player.sprite.getBounds(), zone.getBounds());
      });

      this.activatorState[config.id] = config.latch ? this.activatorState[config.id] || pressed : pressed;
      zone.setFillStyle(config.color, pressed ? 0.82 : 0.28);
      zone.setScale(1, pressed ? 0.72 : 1);
    }

    for (const entry of this.doors) {
      const shouldOpen = entry.config.opensWhen.every((activatorId) => this.activatorState[activatorId]);
      const targetOpen = entry.config.latch ? entry.open || shouldOpen : shouldOpen;

      if (entry.open === targetOpen) {
        continue;
      }

      this.setDoorOpen(entry, targetOpen);

      if (entry.open) {
        this.currentMessage = 'Р СџРЎР‚Р С•РЎвЂ¦Р С•Р Т‘ Р С•РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљ';
        setHudMessage(this.currentMessage);
      }
    }

    for (const entry of this.bridges) {
      const shouldAppear = entry.config.appearsWhen.every((activatorId) => this.activatorState[activatorId]);
      const targetActive = entry.config.latch ? entry.active || shouldAppear : shouldAppear;

      if (entry.active !== targetActive) {
        this.setBridgeActive(entry, targetActive);
      }
    }
  }

  setDoorOpen(entry, open) {
    entry.open = open;
    entry.door.setAlpha(open ? 0.14 : 1);

    if (open && entry.body) {
      this.matter.world.remove(entry.body);
      entry.body = null;
    } else if (!open && !entry.body) {
      entry.body = this.createDoorBody(entry.config);
    }
  }

  setBridgeActive(entry, active) {
    entry.active = active;
    entry.platform.setAlpha(active ? 1 : 0.16);
    entry.platform.setStrokeStyle(3, entry.config.color ?? 0x111111, active ? 1 : 0.5);

    if (active && !entry.body) {
      entry.body = this.createBridgeBody(entry.config);
    } else if (!active && entry.body) {
      this.matter.world.remove(entry.body);
      entry.body = null;
    }
  }

  createGoals() {
    const validGoals = [];

    this.goalZones = this.level.goals.flatMap((goal) => {
      const character = CHARACTER_BY_ID[goal.id];

      if (!character) {
        console.warn(`Skipping goal with unknown character id "${goal.id}" in level "${this.level.id}".`);
        return [];
      }

      const pad = this.add
        .rectangle(goal.x, goal.y, goal.width, goal.height, character.color, 0.2)
        .setOrigin(0, 0)
        .setStrokeStyle(3, character.color, 0.95);

      pad.characterId = goal.id;
      this.goalState[goal.id] = false;
      validGoals.push(goal);
      return pad;
    });

    this.level.goals = validGoals;
  }

  createUi() {
    this.currentMessage = this.level.startMessage;
    this.updateInfoText();
  }

  createDevUi() {
    if (isDevTuningEnabled()) {
      createDevTuningPanel(this);
    }
  }

  updateInfoText() {
    const activeGoalIds = this.activeGoalIds();
    const ready = activeGoalIds.filter((id) => this.goalState[id]).length;
    updateHud({
      level: this.level.title,
      ready,
      total: activeGoalIds.length,
      deaths: this.deaths,
      message: this.currentMessage,
      hasNext: Boolean(this.level.nextLevel)
    });
  }

  startNextLevel() {
    if (!this.completed || !this.level.nextLevel) {
      return;
    }

    const nextSceneKey = levelEntryFor(this.level.nextLevel)?.sceneKey ?? this.level.nextLevel;

    if (this.networkSession?.connected) {
      if (this.networkSession.isHost) {
        this.networkSession.startLevel(nextSceneKey);
      } else {
        this.networkSession.requestNextLevel();
        setHudMessage('Ждём переход от хоста...');
      }
      return;
    }

    this.scene.start(nextSceneKey);
  }

  restartCurrentLevel() {
    const sceneKey = this.sys.settings.key;

    if (this.networkSession?.connected) {
      if (this.networkSession.isHost) {
        this.networkSession.startLevel(sceneKey);
      } else {
        this.networkSession.requestRestartLevel();
        setHudMessage('Ждём рестарт от хоста...');
      }
      return;
    }

    this.scene.restart();
  }

  updateGoals() {
    const Phaser = window.Phaser;

    for (const pad of this.goalZones) {
      const player = this.players.find((candidate) => candidate.character.id === pad.characterId);
      const active = this.isCharacterActive(pad.characterId);

      if (!active) {
        this.goalState[pad.characterId] = true;
        pad.setAlpha(0.24);
        pad.setFillStyle(player.character.color, 0.08);
        continue;
      }

      const intersects = Phaser.Geom.Intersects.RectangleToRectangle(player.sprite.getBounds(), pad.getBounds());
      this.goalState[pad.characterId] = intersects;
      pad.setAlpha(1);
      pad.setFillStyle(player.character.color, intersects ? 0.72 : 0.2);
    }

    this.updateInfoText();

    if (!this.completed && Object.values(this.goalState).every(Boolean)) {
      this.markLevelCompleted();
    }
  }

  markLevelCompleted({ fromNetwork = false } = {}) {
    if (this.completed) {
      return;
    }

    this.completed = true;
    this.currentMessage = this.level.completeMessage;
    setHudMessage(this.currentMessage);

    if (!fromNetwork) {
      this.cameras.main.flash(260, 255, 255, 255);
    }
  }

  activeGoalIds() {
    return this.level.goals.map((goal) => goal.id).filter((id) => this.isCharacterActive(id));
  }

  respawnPlayer(player, reason) {
    if (player.respawning || this.completed) {
      return;
    }

    if (player.grapple) {
      player.grapple = null;
      this.clearGrappleLine(player);
    }

    player.respawning = true;
    this.deaths += 1;
    this.currentMessage = `${player.character.name}: ${reason}`;
    setHudMessage(this.currentMessage);
    player.sprite.setTexture(`${player.character.id}-death`, 0);
    player.sprite.anims.play(`${player.character.id}:death`, true);
    player.sprite.body.collisionFilter.mask = 0;
    player.sprite.setIgnoreGravity(true);
    player.sprite.setVelocity(0, 0);

    this.time.delayedCall(DEATH_ANIMATION_DURATION_MS, () => {
      const spawn = this.spawnFor(player.character);

      player.sprite.clearTint();
      player.sprite.setTexture(player.character.textureKey, 0);
      player.sprite.setPosition(spawn.x, spawn.y);
      player.sprite.setVelocity(0, 0);
      player.sprite.setIgnoreGravity(false);
      player.sprite.body.collisionFilter.mask = player.collisionMask;
      player.onGroundAt = -1000;
      player.lastJumpedAt = -1000;
      player.surfaceTouchedAt = 0;
      player.oneWayPlatformBody = null;
      player.oneWayPlatformAt = -1000;
      player.blueFallJumpUsed = false;
      player.blueFallEnergy = 0;
      player.blueFallLastY = spawn.y;
      player.blueFallJumpBurstAt = -1000;
      player.blueFallJumpBurstEnergy = 0;
      player.respawning = false;
    });
  }

  updateLight(player) {
    player.aura.setPosition(player.sprite.x, player.sprite.y);
    player.aura.setAlpha(player.respawning ? 0.06 : 0.18);
  }

  updateCamera() {
    const camera = this.cameras.main;
    const Phaser = window.Phaser;
    const focusRect = this.getCameraFocusRect();
    const targetZoom = CAMERA_VIEW.width / focusRect.width;
    const nextZoom = Phaser.Math.Linear(camera.zoom, targetZoom, CAMERA_VIEW.zoomLerp);
    const viewportWidth = CAMERA_VIEW.width / nextZoom;
    const viewportHeight = CAMERA_VIEW.height / nextZoom;
    const centerX = focusRect.centerX;
    const centerY = focusRect.centerY;
    const maxScrollX = this.level.world.width - viewportWidth;
    const maxScrollY = this.level.world.height - viewportHeight;
    const targetViewX =
      maxScrollX < 0 ? maxScrollX / 2 : Phaser.Math.Clamp(centerX - viewportWidth / 2, 0, maxScrollX);
    const targetViewY =
      maxScrollY < 0 ? maxScrollY / 2 : Phaser.Math.Clamp(centerY - viewportHeight / 2, 0, maxScrollY);
    const zoomOffsetX = (CAMERA_VIEW.width - viewportWidth) / 2;
    const zoomOffsetY = (CAMERA_VIEW.height - viewportHeight) / 2;
    const targetScrollX = targetViewX - zoomOffsetX;
    const targetScrollY = targetViewY - zoomOffsetY;

    camera.setZoom(nextZoom);
    camera.scrollX = Phaser.Math.Linear(camera.scrollX, targetScrollX, CAMERA_VIEW.scrollLerp);
    camera.scrollY = Phaser.Math.Linear(camera.scrollY, targetScrollY, CAMERA_VIEW.scrollLerp);
  }

  getCameraFocusRect() {
    const bounds = this.players.map((player) => player.sprite.getBounds());
    const minX = Math.min(...bounds.map((rect) => rect.left));
    const maxX = Math.max(...bounds.map((rect) => rect.right));
    const minY = Math.min(...bounds.map((rect) => rect.top));
    const maxY = Math.max(...bounds.map((rect) => rect.bottom));
    const rawWidth = Math.max(1, maxX - minX);
    const rawHeight = Math.max(1, maxY - minY);
    const paddingX = Math.max(CAMERA_VIEW.minEdgePadding, rawWidth * CAMERA_VIEW.edgePaddingRatio);
    const paddingY = Math.max(CAMERA_VIEW.minEdgePadding, rawHeight * CAMERA_VIEW.edgePaddingRatio);
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const paddedWidth = Math.max(CAMERA_VIEW.minWorldWidth, rawWidth + paddingX * 2);
    const paddedHeight = Math.max(CAMERA_VIEW.minWorldHeight, rawHeight + paddingY * 2);
    let width = paddedWidth;
    let height = paddedHeight;

    if (width / height > CAMERA_VIEW.aspect) {
      height = width / CAMERA_VIEW.aspect;
    } else {
      width = height * CAMERA_VIEW.aspect;
    }

    if (width > this.level.world.width) {
      width = this.level.world.width;
      height = width / CAMERA_VIEW.aspect;
    }

    return {
      centerX,
      centerY,
      width,
      height
    };
  }

  drawBackdrop() {
    const backgroundPath = this.level.background || 'assets/sprites/new-bg.png';
    const backgroundKey = `background:${backgroundPath}`;

    if (this.textures.exists(backgroundKey)) {
      this.add
        .image(0, 0, backgroundKey)
        .setOrigin(0, 0)
        .setDisplaySize(this.level.world.width, this.level.world.height)
        .setDepth(-10);
      return;
    }

    const graphics = this.add.graphics();

    graphics.fillStyle(0xf5f6f2, 1);
    graphics.fillRect(0, 0, this.level.world.width, this.level.world.height);

    graphics.lineStyle(10, 0xd8dbd9, 1);
    graphics.beginPath();
    graphics.moveTo(-20, 260);
    graphics.lineTo(170, 310);
    graphics.lineTo(332, 410);
    graphics.lineTo(590, 390);
    graphics.lineTo(760, 318);
    graphics.lineTo(960, 368);
    graphics.lineTo(1210, 318);
    graphics.lineTo(1590, 220);
    graphics.strokePath();

    graphics.lineStyle(7, 0xe4e7e5, 1);
    graphics.beginPath();
    graphics.moveTo(150, 266);
    graphics.lineTo(418, 330);
    graphics.lineTo(505, 405);
    graphics.lineTo(778, 382);
    graphics.lineTo(920, 430);
    graphics.lineTo(1170, 365);
    graphics.strokePath();
  }
}
