import { CHARACTERS, CHARACTER_BY_ID } from '../config/characters.js';
import { LEVEL_ONE, MATERIALS } from '../config/level-one.js';
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

export class LevelOneScene extends PhaserScene {
  constructor(sceneKey = 'LevelOneScene', level = LEVEL_ONE) {
    super(sceneKey);
    this.level = level;
    this.players = [];
    this.goalState = {};
    this.completed = false;
  }

  create() {
    const Phaser = window.Phaser;

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
    this.createUi();
    this.createDevUi();

    this.matter.world.on('collisionstart', this.handleMatterCollision, this);
    this.matter.world.on('collisionactive', this.handleMatterCollision, this);
    this.resetKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
    this.menuKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    this.nextKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const matterWorld = this.matter.world;
    this.events.once('shutdown', () => {
      matterWorld?.off?.('collisionstart', this.handleMatterCollision, this);
      matterWorld?.off?.('collisionactive', this.handleMatterCollision, this);
      removeDevTuningPanel();
      hideHud();
    });
  }

  update(time) {
    const Phaser = window.Phaser;

    if (Phaser.Input.Keyboard.JustDown(this.resetKey)) {
      this.scene.restart();
      return;
    }

    if (Phaser.Input.Keyboard.JustDown(this.menuKey)) {
      this.scene.start('MenuScene');
      return;
    }

    if (this.completed && Phaser.Input.Keyboard.JustDown(this.nextKey) && this.level.nextLevel) {
      this.scene.start(this.level.nextLevel);
      return;
    }

    for (const player of this.players) {
      updatePlayerMovement(player, time);
      this.updateLight(player);
      playCharacterAnimation(player.sprite, player.character, 'idle');

      if (player.sprite.y > this.level.world.height + 90) {
        this.respawnPlayer(player, 'Р С—Р В°Р Т‘Р ВµР Р…Р С‘Р Вµ');
      }
    }

    this.updateGrapples(time);
    this.updateMechanics();
    this.updateCamera();
    this.updateGoals();
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
      const sprite = this.matter.add.sprite(character.spawn.x, character.spawn.y, character.textureKey);

      sprite.setScale(1.32);
      sprite.setRectangle(42, 42);
      sprite.setFixedRotation();
      sprite.setFriction(0.03, 0.02, 0.12);
      sprite.setFrictionAir(0.018);
      sprite.setBounce(0.01);
      sprite.setMass(2.2);
      sprite.setCollisionCategory(COLLISION_CATEGORIES.player);
      sprite.setCollidesWith(collisionMask);
      sprite.setDepth(2);

      const aura = this.add.circle(sprite.x, sprite.y, 74, character.lightColor, 0.18);
      aura.setBlendMode(window.Phaser.BlendModes.ADD);
      aura.setDepth(1);

      const player = {
        character,
        sprite,
        aura,
        keys: createControlSet(this, character.controls),
        collisionMask,
        lastSurface: 'neutral',
        surfaceTouchedAt: 0,
        onGroundAt: -1000,
        ridingPlayerAt: -1000,
        slopeMomentumUntil: 0,
        slipperyJumpCount: 0,
        slopeSlideDirection: -1,
        respawning: false
      };

      annotateBody(sprite.body, { gameKind: 'player', playerId: character.id });
      this.registerPlayerBody(player);
      this.players.push(player);
      playCharacterAnimation(sprite, character, 'idle');
    }
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

  handlePlayerPair(first, second, time) {
    if (first.respawning || second.respawning) {
      return;
    }

    if (this.isAbove(first.sprite.body, second.sprite.body, 18)) {
      this.markGrounded(first, 'neutral', time, second.sprite.body);
      first.ridingPlayerAt = time;
    } else if (this.isAbove(second.sprite.body, first.sprite.body, 18)) {
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

    if (this.isAbove(player.sprite.body, otherBody, 8)) {
      this.markGrounded(player, material, time, otherBody);
    }
  }

  markGrounded(player, material, time, body) {
    player.onGroundAt = time;
    player.lastSurface = material;
    player.surfaceTouchedAt = time;
    player.slopeSlideDirection = body.slideDirection ?? (material === 'blue' ? -1 : 1);

    if (body.slope) {
      player.slopeMomentumUntil = Math.max(player.slopeMomentumUntil, time + 700);
    }
  }

  isAbove(upperBody, lowerBody, centerPadding) {
    const upper = this.rootBody(upperBody);
    const lower = this.rootBody(lowerBody);
    const upperBottom = upper.bounds.max.y;
    const lowerTop = lower.bounds.min.y;
    const centerAbove = upper.position.y < lower.position.y - centerPadding;
    const closeToTop = upperBottom >= lowerTop - 28 && upperBottom <= lower.bounds.max.y + 12;

    return centerAbove && closeToTop;
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

    if (green.keys.ability && Phaser.Input.Keyboard.JustDown(green.keys.ability)) {
      if (green.grapple) {
        green.grapple = null;
        this.clearGrappleLine(green);
        return;
      }

      const anchor = this.findGrappleAnchor(green);

      if (anchor) {
        const distance = Math.hypot(anchor.x - green.sprite.x, anchor.y - green.sprite.y);
        green.grapple = {
          anchor,
          length: Phaser.Math.Clamp(distance, anchor.minLength ?? 74, anchor.maxLength ?? anchor.radius)
        };
        this.currentMessage = 'Мята держится лозой. I/M - длина, J/L - раскачка, K - отпустить';
        setHudMessage(this.currentMessage);
      }
    }

    if (green.grapple) {
      const { anchor } = green.grapple;
      const body = green.sprite.body;
      const dx = green.sprite.x - anchor.x;
      const dy = green.sprite.y - anchor.y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      const minLength = anchor.minLength ?? 74;
      const maxLength = anchor.maxLength ?? anchor.radius;
      const lengthDelta = (green.keys.jump.isDown ? -4.6 : 0) + (green.keys.down?.isDown ? 4.6 : 0);

      green.grapple.length = Phaser.Math.Clamp(green.grapple.length + lengthDelta, minLength, maxLength);

      const normalX = dx / distance;
      const normalY = dy / distance;
      const radialVelocity = body.velocity.x * normalX + body.velocity.y * normalY;
      const stretch = distance - green.grapple.length;
      const correction = stretch * 0.032 + radialVelocity * 0.34;

      green.sprite.setVelocity(
        Phaser.Math.Clamp(body.velocity.x - normalX * correction, -15, 15),
        Phaser.Math.Clamp(body.velocity.y - normalY * correction, -17, 17)
      );
      green.slopeMomentumUntil = time + 700;
      this.drawGrappleLine(green, anchor);
    } else {
      this.clearGrappleLine(green);
    }
  }
  findGrappleAnchor(player) {
    let best = null;
    let bestDistance = Infinity;

    for (const anchor of this.level.grappleAnchors ?? []) {
      const distance = Math.hypot(anchor.x - player.sprite.x, anchor.y - player.sprite.y);

      if (distance <= anchor.radius && distance < bestDistance) {
        best = anchor;
        bestDistance = distance;
      }
    }

    return best;
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
      friction: 0.82,
      frictionStatic: 1,
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
      friction: 0.86,
      frictionStatic: 1,
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
    this.goalZones = this.level.goals.map((goal) => {
      const character = CHARACTER_BY_ID[goal.id];
      const pad = this.add
        .rectangle(goal.x, goal.y, goal.width, goal.height, character.color, 0.2)
        .setOrigin(0, 0)
        .setStrokeStyle(3, character.color, 0.95);

      pad.characterId = goal.id;
      this.goalState[goal.id] = false;
      return pad;
    });
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
    const ready = Object.values(this.goalState).filter(Boolean).length;
    updateHud({
      level: this.level.title,
      ready,
      total: this.level.goals.length,
      deaths: this.deaths,
      message: this.currentMessage,
      hasNext: Boolean(this.level.nextLevel)
    });
  }

  updateGoals() {
    const Phaser = window.Phaser;

    for (const pad of this.goalZones) {
      const player = this.players.find((candidate) => candidate.character.id === pad.characterId);
      const intersects = Phaser.Geom.Intersects.RectangleToRectangle(player.sprite.getBounds(), pad.getBounds());
      this.goalState[pad.characterId] = intersects;
      pad.setFillStyle(player.character.color, intersects ? 0.72 : 0.2);
    }

    this.updateInfoText();

    if (!this.completed && Object.values(this.goalState).every(Boolean)) {
      this.completed = true;
      this.currentMessage = this.level.completeMessage;
      setHudMessage(this.currentMessage);
      this.cameras.main.flash(260, 255, 255, 255);
    }
  }

  respawnPlayer(player, reason) {
    if (player.respawning || this.completed) {
      return;
    }

    player.respawning = true;
    this.deaths += 1;
    this.currentMessage = `${player.character.name}: ${reason}`;
    setHudMessage(this.currentMessage);
    player.sprite.setTintFill(0xffffff);
    player.sprite.body.collisionFilter.mask = 0;
    player.sprite.setIgnoreGravity(true);
    player.sprite.setVelocity(0, 0);

    this.time.delayedCall(180, () => {
      player.sprite.clearTint();
      player.sprite.setPosition(player.character.spawn.x, player.character.spawn.y);
      player.sprite.setVelocity(0, 0);
      player.sprite.setIgnoreGravity(false);
      player.sprite.body.collisionFilter.mask = player.collisionMask;
      player.onGroundAt = -1000;
      player.surfaceTouchedAt = 0;
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

