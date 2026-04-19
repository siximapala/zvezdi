import { CHARACTERS } from '../config/characters.js';
import { levelEntries, levelEntryFor, registerDiscoveredLevels } from '../config/level-registry.js';
import { registerCharacterAnimations } from '../systems/animations.js';
import { GameplayScene } from './GameplayScene.js';

const PhaserScene = window.Phaser?.Scene ?? class {};
const LEVEL_MANIFEST_KEY = 'level-manifest';
const LEVEL_MANIFEST_PATH = 'assets/levels/manifest.json';

export class BootScene extends PhaserScene {
  constructor() {
    super('BootScene');
  }

  preload() {
    for (const character of CHARACTERS) {
      this.load.spritesheet(character.textureKey, `assets/sprites/${character.textureKey}.png`, {
        frameWidth: 32,
        frameHeight: 32
      });
      this.load.spritesheet(`${character.id}-death`, `assets/sprites/${character.id}-death.png`, {
        frameWidth: 32,
        frameHeight: 32
      });
    }
    this.load.spritesheet('green-leaves', 'assets/sprites/green-leavesh.png', {
      frameWidth: 32,
      frameHeight: 32
    });

    this.load.json(LEVEL_MANIFEST_KEY, LEVEL_MANIFEST_PATH);
  }

  create() {
    registerCharacterAnimations(this);
    registerDiscoveredLevels(this.cache.json.get(LEVEL_MANIFEST_KEY));
    this.loadLevelMapsThenStart();
  }

  loadLevelMapsThenStart() {
    let queued = false;

    for (const { level } of levelEntries()) {
      if (level.tiledKey && level.tiledPath) {
        if (!this.cache.json.get(level.tiledKey)) {
          this.load.json(level.tiledKey, level.tiledPath);
          queued = true;
        }
      }
    }

    if (!queued) {
      this.startRequestedScene();
      return;
    }

    this.load.once('complete', () => this.startRequestedScene());
    this.load.start();
  }

  startRequestedScene() {
    this.registerGameplayScenes();

    const params = new URLSearchParams(window.location.search);
    const levelEntry = levelEntryFor(params.get('level'));

    this.scene.start(levelEntry ? levelEntry.sceneKey : 'MenuScene');
  }

  registerGameplayScenes() {
    for (const entry of levelEntries()) {
      if (this.scene.manager.keys?.[entry.sceneKey]) {
        continue;
      }

      const SceneClass = class extends GameplayScene {
        constructor() {
          super(entry.sceneKey, entry.level);
        }
      };

      this.scene.add(entry.sceneKey, SceneClass, false);
    }
  }
}
