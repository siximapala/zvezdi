import { CHARACTERS } from '../config/characters.js';
import { firstLevelEntry } from '../config/level-registry.js';
import { hideHud } from '../systems/hud.js';
import {
  createLobbySession,
  disconnectNetworkSession,
  getNetworkSession,
  joinLobbySession
} from '../systems/networkSession.js';

const PhaserScene = window.Phaser?.Scene ?? class {};
const LOBBY_CHARACTERS = ['pink', 'blue', 'green'];
const REACTIONS = [
  { key: '4', label: 'Привет!' },
  { key: '5', label: 'Сюда!' },
  { key: '6', label: 'Готов!' }
];

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
      'Кликни по цветной звезде, чтобы выбрать персонажа.',
      'Если лобби ещё нет, выбор звезды сразу создаст его и запустит уровень.',
      'Войти по коду: выбери свободную звезду и подключайся.',
      'Управление: A/D - движение, Space - прыжок, E - способность, R - рестарт.'
    ];

    this.add
      .text(100, 410, lines.join('\n'), {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '20px',
        color: '#111111',
        lineSpacing: 12
      })
      .setResolution(2);

    this.add
      .text(100, 548, 'Выбери звезду кликом, чтобы создать лобби и начать', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '22px',
        fontStyle: '700',
        color: '#111111'
      })
      .setResolution(2);

    this.createMenuButton(100, 592, 'Войти по коду', () => this.joinLobby(), { fontSize: '22px' });
    this.createMenuButton(294, 592, 'Отключиться', () => this.disconnectLobby(), { fontSize: '22px' });
    this.lobbyCodeText = this.add
      .text(790, 526, '', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '34px',
        fontStyle: '700',
        color: '#111111',
        align: 'center',
        backgroundColor: '#ffffff',
        padding: { x: 22, y: 14 }
      })
      .setResolution(2);

    this.networkText = this.add
      .text(790, 640, 'J: войти по коду   K: отключиться', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '16px',
        color: '#111111',
        lineSpacing: 8
      })
      .setResolution(2);

    this.characterChoices = new Map();

    CHARACTERS.forEach((character, index) => {
      const sprite = this.add.image(870 + index * 84, 380 + index * 18, character.textureKey);
      sprite.setScale(3.3);

      const aura = this.add.circle(sprite.x, sprite.y, 96, character.lightColor, 0.16).setBlendMode(Phaser.BlendModes.ADD);
      const label = this.add
        .text(sprite.x, sprite.y + 126, character.name, {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '18px',
          fontStyle: '700',
          color: '#111111',
          align: 'center',
          backgroundColor: '#ffffff',
          padding: { x: 8, y: 4 }
        })
        .setOrigin(0.5)
        .setResolution(2);

      sprite.setInteractive({ useHandCursor: true });
      sprite.on('pointerdown', () => this.selectCharacter(character.id));
      sprite.on('pointerover', () => {
        if (!this.isCharacterOccupiedByOther(character.id)) {
          sprite.setScale(3.65);
        }
      });
      sprite.on('pointerout', () => sprite.setScale(this.selectedCharacterId() === character.id ? 3.65 : 3.3));
      sprite.setDepth(2);
      label.setDepth(3);
      this.characterChoices.set(character.id, { sprite, aura, label });
    });

    this.networkSession = getNetworkSession();
    this.bindNetworkSession(this.networkSession);
    this.updateNetworkText();

    this.boundMenuKeyHandler = (event) => this.handleMenuKey(event);
    this.input.keyboard.on('keydown', this.boundMenuKeyHandler);
    this.events.once('shutdown', () => {
      this.input.keyboard.off('keydown', this.boundMenuKeyHandler);
      this.boundMenuKeyHandler = null;
      this.unbindNetworkSession();
    });
  }

  startFirstLevel() {
    const firstLevel = firstLevelEntry();

    if (!firstLevel) {
      return;
    }

    const session = getNetworkSession();

    if (session?.connected) {
      if (session.isHost) {
        session.startLevel(firstLevel.sceneKey);
      } else {
        this.setNetworkStatus('Ожидание старта от хоста...');
      }
      return;
    }

    if (firstLevel) {
      this.scene.start(firstLevel.sceneKey);
    }
  }

  async createLobby() {
    try {
      this.setNetworkStatus('Создаю лобби...');
      this.networkSession = await createLobbySession();
      this.bindNetworkSession(this.networkSession);
      this.updateNetworkText();
      this.startFirstLevel();
    } catch (error) {
      this.setNetworkStatus(error instanceof Error ? error.message : 'Не удалось создать лобби');
    }
  }

  async createLobbyWithCharacter(characterId) {
    try {
      this.setNetworkStatus('Создаю лобби и выбираю звезду...');
      this.networkSession = await createLobbySession();
      this.bindNetworkSession(this.networkSession);
      await this.networkSession.selectCharacter(characterId);
      this.updateNetworkText();
      this.startFirstLevel();
    } catch (error) {
      this.setNetworkStatus(error instanceof Error ? error.message : 'Не удалось создать лобби');
    }
  }

  async joinLobby() {
    const code = window.prompt('Код лобби');

    if (!code) {
      return;
    }

    try {
      this.setNetworkStatus('Подключаюсь к лобби...');
      this.networkSession = await joinLobbySession(code);
      this.bindNetworkSession(this.networkSession);
      this.updateNetworkText();
    } catch (error) {
      this.setNetworkStatus(error instanceof Error ? error.message : 'Не удалось войти в лобби');
    }
  }

  handleMenuKey(event) {
    if (this.sys?.isActive && !this.sys.isActive()) {
      return;
    }

    const code = event.code || '';

    if (code === 'KeyJ') {
      this.joinLobby();
      return;
    }

    if (code === 'KeyK') {
      this.disconnectLobby();
      return;
    }

    const digit = code.startsWith('Digit') || code.startsWith('Numpad') ? Number(code.replace(/\D/g, '')) : Number(event.key);
    const characterId = LOBBY_CHARACTERS[digit - 1];
    const reaction = REACTIONS.find((item) => item.key === String(digit));

    if (characterId) {
      this.selectCharacter(characterId);
      return;
    }

    if (reaction) {
      this.sendReaction(reaction.label);
    }
  }

  async selectCharacter(characterId) {
    if (this.isCharacterOccupiedByOther(characterId)) {
      this.setNetworkStatus('Эта звезда уже занята. Выбери свободную.');
      return;
    }

    const session = getNetworkSession();

    if (!session?.connected) {
      await this.createLobbyWithCharacter(characterId);
      return;
    }

    try {
      await session.selectCharacter(characterId);
      this.updateNetworkText();
    } catch (error) {
      this.setNetworkStatus(error instanceof Error ? error.message : 'Не удалось выбрать звезду');
    }
  }

  bindNetworkSession(session) {
    if (!session || this.boundNetworkSession === session) {
      return;
    }

    this.unbindNetworkSession();
    this.boundNetworkSession = session;
    this.boundNetworkChange = () => this.updateNetworkText();
    this.boundNetworkReaction = (event) => this.showLobbyReaction(event.detail);
    session.addEventListener('change', this.boundNetworkChange);
    session.addEventListener('reaction', this.boundNetworkReaction);
  }

  unbindNetworkSession() {
    if (!this.boundNetworkSession) {
      return;
    }

    this.boundNetworkSession.removeEventListener('change', this.boundNetworkChange);
    this.boundNetworkSession.removeEventListener('reaction', this.boundNetworkReaction);
    this.boundNetworkSession = null;
    this.boundNetworkChange = null;
    this.boundNetworkReaction = null;
  }

  sendReaction(label) {
    const session = getNetworkSession();

    if (!session?.connected) {
      this.setNetworkStatus('Реакции работают после входа в лобби.');
      return;
    }

    session.sendReaction(label);
  }

  disconnectLobby() {
    disconnectNetworkSession();
    this.networkSession = null;
    this.updateNetworkText();
  }

  updateNetworkText() {
    const session = getNetworkSession();

    if (!session?.connected || !session.code) {
      this.lobbyCodeText?.setText('СОЗДАЙ\nЛОББИ');
      this.updateCharacterChoices();
      this.setNetworkStatus('Нажми на свободную цветную звезду, чтобы создать лобби\nJ: войти по коду   K: отключиться');
      return;
    }

    const role = session.isHost ? 'хост' : 'клиент';
    const roster = this.lobbyRoster(session);
    this.lobbyCodeText?.setText(`КОД ЛОББИ\n${session.code}`);
    this.updateCharacterChoices();
    this.setNetworkStatus(
      `Подключение: ${session.code} (${role}), игроков: ${session.playerCount}/3\n${roster}\nEnter: старт у хоста.`
    );
  }

  setNetworkStatus(message) {
    this.networkText?.setText(message);
  }

  updateCharacterChoices() {
    for (const character of CHARACTERS) {
      const choice = this.characterChoices?.get(character.id);

      if (!choice) {
        continue;
      }

      const occupiedByOther = this.isCharacterOccupiedByOther(character.id);
      const selectedByMe = this.selectedCharacterId() === character.id;

      choice.sprite.clearTint();
      choice.sprite.setAlpha(occupiedByOther ? 0.28 : 1);
      choice.sprite.setScale(selectedByMe ? 3.65 : 3.3);
      choice.aura.setAlpha(occupiedByOther ? 0.04 : selectedByMe ? 0.28 : 0.16);
      choice.label.setText(occupiedByOther ? `${character.name}\nзанята` : selectedByMe ? `${character.name}\nты` : character.name);
      choice.label.setAlpha(occupiedByOther ? 0.58 : 1);

      if (occupiedByOther) {
        choice.sprite.disableInteractive();
        choice.sprite.setTint(0x777777);
      } else {
        choice.sprite.setInteractive({ useHandCursor: true });
      }
    }
  }

  selectedCharacterId() {
    return getNetworkSession()?.selectedCharacterId ?? null;
  }

  isCharacterOccupiedByOther(characterId) {
    const session = getNetworkSession();

    if (!session?.lobby?.players) {
      return false;
    }

    return session.lobby.players.some((player) => player.characterId === characterId && player.id !== session.clientId);
  }

  showLobbyReaction(detail) {
    const character = CHARACTERS.find((item) => item.id === detail?.characterId);
    const name = character?.name ?? 'Игрок';
    this.setNetworkStatus(`${name}: ${detail?.label ?? ''}`);
    window.setTimeout(() => this.updateNetworkText(), 1200);
  }

  createMenuButton(x, y, label, onClick, options = {}) {
    const button = this.add
      .text(x, y, label, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: options.fontSize ?? '18px',
        fontStyle: '700',
        color: '#111111',
        backgroundColor: '#ffffff',
        padding: { x: options.paddingX ?? 12, y: options.paddingY ?? 7 }
      })
      .setResolution(2)
      .setInteractive({ useHandCursor: true });

    button.on('pointerover', () => button.setStyle({ backgroundColor: '#e8ece8' }));
    button.on('pointerout', () => button.setStyle({ backgroundColor: '#ffffff' }));
    button.on('pointerdown', onClick);

    return button;
  }

  lobbyRoster(session) {
    const byCharacter = new Map((session.lobby?.players ?? []).map((player) => [player.characterId, player]));

    return CHARACTERS.map((character, index) => {
      const player = byCharacter.get(character.id);
      const owner = player ? (player.id === session.clientId ? 'ты' : player.isHost ? 'хост' : 'игрок') : 'свободна у хоста';
      return `${index + 1}. ${character.name}: ${owner}`;
    }).join('   ');
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
