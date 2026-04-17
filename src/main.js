import { BootScene } from './game/scenes/BootScene.js';
import { LevelOneScene } from './game/scenes/LevelOneScene.js';
import { LevelTwoScene } from './game/scenes/LevelTwoScene.js';
import { LevelThreeScene } from './game/scenes/LevelThreeScene.js';
import { MenuScene } from './game/scenes/MenuScene.js';

const statusNode = document.querySelector('#boot-status');

function setStatus(message, isError = false) {
  if (!statusNode) {
    return;
  }

  statusNode.hidden = false;
  statusNode.textContent = message;
  statusNode.style.borderColor = isError ? '#d94f8a' : '#111111';
}

window.addEventListener('load', () => {
  const Phaser = window.Phaser;

  if (!Phaser) {
    setStatus('Phaser не загрузился. Проверь подключение к CDN или добавь локальную сборку Phaser.', true);
    return;
  }

  const config = {
    type: Phaser.AUTO,
    parent: 'game-root',
    width: 1280,
    height: 720,
    backgroundColor: '#f5f6f2',
    pixelArt: true,
    roundPixels: true,
    physics: {
      default: 'matter',
      matter: {
        gravity: { y: 2.25 },
        debug: false
      }
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [BootScene, MenuScene, LevelOneScene, LevelTwoScene, LevelThreeScene]
  };

  window.__zvezdiGame = new Phaser.Game(config);
  statusNode?.setAttribute('hidden', 'hidden');
});
