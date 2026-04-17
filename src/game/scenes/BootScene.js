import { CHARACTERS } from '../config/characters.js';
import { registerCharacterAnimations } from '../systems/animations.js';

const PhaserScene = window.Phaser?.Scene ?? class {};

export class BootScene extends PhaserScene {
  constructor() {
    super('BootScene');
  }

  preload() {
    for (const character of CHARACTERS) {
      this.load.svg(character.textureKey, character.spritePath, { width: 48, height: 48 });
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
