import { CHARACTERS } from '../config/characters.js';
import { LEVEL_ONE } from '../config/level-one.js';
import { LEVEL_THREE } from '../config/level-three.js';
import { LEVEL_TWO } from '../config/level-two.js';
import { registerCharacterAnimations } from '../systems/animations.js';

const PhaserScene = window.Phaser?.Scene ?? class {};
const LEVEL_ASSETS = [LEVEL_ONE, LEVEL_TWO, LEVEL_THREE];

export class BootScene extends PhaserScene {
  constructor() {
    super('BootScene');
  }

  preload() {
    for (const character of CHARACTERS) {
      this.load.svg(character.textureKey, character.spritePath, { width: 48, height: 48 });
    }

    for (const level of LEVEL_ASSETS) {
      if (level.tiledKey && level.tiledPath) {
        this.load.json(level.tiledKey, level.tiledPath);
      }
    }
  }

  create() {
    registerCharacterAnimations(this);

    const params = new URLSearchParams(window.location.search);
    const level = params.get('level');

    if (level === '2') {
      this.scene.start('LevelTwoScene');
      return;
    }

    if (level === '3') {
      this.scene.start('LevelThreeScene');
      return;
    }

    this.scene.start(level === '1' ? 'LevelOneScene' : 'MenuScene');
  }
}
