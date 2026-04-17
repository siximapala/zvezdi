const hudNode = () => document.querySelector('#game-hud');
const levelNode = () => document.querySelector('#hud-level');
const statsNode = () => document.querySelector('#hud-stats');
const controlsNode = () => document.querySelector('#hud-controls');
const messageNode = () => document.querySelector('#hud-message');

export function showHud() {
  hudNode()?.removeAttribute('hidden');
}

export function hideHud() {
  hudNode()?.setAttribute('hidden', 'hidden');
}

export function updateHud({ level, ready, total, deaths, message, hasNext }) {
  showHud();

  const levelElement = levelNode();
  const statsElement = statsNode();
  const controlsElement = controlsNode();
  const messageElement = messageNode();

  if (levelElement) {
    levelElement.textContent = level;
  }

  if (statsElement) {
    statsElement.textContent = `Ворота: ${ready}/${total}  Ошибки: ${deaths}`;
  }

  if (controlsElement) {
    controlsElement.textContent = hasNext ? 'R: заново  Esc: меню  Enter: дальше' : 'R: заново  Esc: меню';
  }

  if (messageElement && message !== undefined) {
    messageElement.textContent = message;
  }
}

export function setHudMessage(message) {
  showHud();

  const messageElement = messageNode();
  if (messageElement) {
    messageElement.textContent = message;
  }
}
