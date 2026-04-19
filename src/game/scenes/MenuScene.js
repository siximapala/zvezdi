import { CHARACTERS } from '../config/characters.js';
import { firstLevelEntry } from '../config/level-registry.js';
import { hideHud } from '../systems/hud.js';

const PhaserScene = window.Phaser?.Scene ?? class {};

export class MenuScene extends PhaserScene {
  constructor() {
    super('MenuScene');
  }

  create() {
    const Phaser = window.Phaser;
    hideHud();
    this.cameras.main.setBackgroundColor('#f5f6f2');

    this.drawLogo();

    this.add
      .text(92, 238, 'ЗВЁЗДЫ', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '58px',
        fontStyle: '700',
        color: '#111111'
      })
      .setResolution(2);

    this.add
      .text(96, 322, 'Три звезды, три света, один выход.', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '25px',
        color: '#111111'
      })
      .setResolution(2);

    const lines = [
      'Искра: A / D / W',
      'Волна: ← / → / ↑',
      'Мята: J / L / I / M / O',
      'R: заново, Esc: меню'
    ];

    this.add
      .text(100, 410, lines.join('\n'), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '22px',
        color: '#111111',
        lineSpacing: 12
      })
      .setResolution(2);

    this.add
      .text(100, 590, 'Enter или Space', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '28px',
        fontStyle: '700',
        color: '#111111'
      })
      .setResolution(2);

    CHARACTERS.forEach((character, index) => {
      const sprite = this.add.image(870 + index * 84, 380 + index * 18, character.textureKey);
      sprite.setScale(2.2);

      this.add.circle(sprite.x, sprite.y, 96, character.lightColor, 0.16).setBlendMode(Phaser.BlendModes.ADD);
      sprite.setDepth(2);
    });

    this.input.keyboard.once('keydown-ENTER', () => this.startFirstLevel());
    this.input.keyboard.once('keydown-SPACE', () => this.startFirstLevel());
    this.input.once('pointerdown', () => this.startFirstLevel());
  }

  startFirstLevel() {
    const firstLevel = firstLevelEntry();

    if (firstLevel) {
      this.scene.start(firstLevel.sceneKey);
    }
  }

  drawLogo() {
    const graphics = this.add.graphics();

    graphics.lineStyle(18, 0x111111, 1);
    graphics.beginPath();
    graphics.moveTo(760, 130);
    graphics.lineTo(905, 96);
    graphics.lineTo(978, 170);
    graphics.lineTo(1108, 134);
    graphics.lineTo(1192, 222);
    graphics.strokePath();

    graphics.lineStyle(10, 0xd7dad8, 1);
    graphics.beginPath();
    graphics.moveTo(732, 248);
    graphics.lineTo(842, 210);
    graphics.lineTo(990, 250);
    graphics.lineTo(1130, 220);
    graphics.strokePath();
  }
}
