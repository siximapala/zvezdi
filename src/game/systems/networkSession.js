const CHARACTER_ORDER = ['pink', 'blue', 'green'];
const SNAPSHOT_INTERVAL_MS = 33;
const INPUT_HEARTBEAT_MS = 50;
const SNAPSHOT_RENDER_DELAY_MS = 90;
const SNAPSHOT_MAX_EXTRAPOLATE_MS = 80;
const SNAPSHOT_BUFFER_LIMIT = 8;
const REMOTE_SNAP_DISTANCE = 360;
const REMOTE_JUMP_BUFFER_MS = 180;
const REACTION_LABELS = new Set(['Привет!', 'Сюда!', 'Готов!']);
const RECONNECT_DELAYS_MS = [500, 1000, 2000, 4000, 6000, 8000];
const HEARTBEAT_INTERVAL_MS = 2000;
const HEARTBEAT_TIMEOUT_MS = 8000;
const HEARTBEAT_MAX_MISSES = 3;

let activeSession = null;

export function getNetworkSession() {
  return activeSession;
}

export function hasNetworkSession() {
  return Boolean(activeSession?.connected);
}

export async function createLobbySession() {
  const session = new NetworkSession();
  await session.connect();
  await session.createLobby();
  activeSession = session;
  return session;
}

export async function joinLobbySession(code) {
  const session = new NetworkSession();
  await session.connect();
  await session.joinLobby(code);
  activeSession = session;
  return session;
}

export function disconnectNetworkSession() {
  activeSession?.disconnect();
  activeSession = null;
}

class NetworkSession extends EventTarget {
  constructor() {
    super();
    this.socket = null;
    this.clientId = null;
    this.lobby = null;
    this.connected = false;
    this.pending = new Map();
    this.remoteInputs = new Map();
    this.remoteJumpBufferUntil = new Map();
    this.remoteTargets = new Map();
    this.lastSentInputs = new Map();
    this.lastSentInputAt = new Map();
    this.lastSnapshotAt = 0;
    this.scene = null;
    this.manualDisconnect = false;
    this.reconnectAttempt = 0;
    this.reconnectTimer = null;
    this.lastLobbyCode = null;
    this.lastCharacterId = null;
    this.lastWasHost = false;
    this.lastSceneKey = null;
    this.sessionToken = createRequestId();
    this.heartbeatInterval = null;
    this.heartbeatTimeout = null;
    this.heartbeatMisses = 0;
    this.lastPingAt = 0;
    this.latencyMs = null;
    this.latencySamples = [];
    this.statusOverlay = null;
  }

  get code() {
    return this.lobby?.code ?? null;
  }

  get isHost() {
    return Boolean(this.lobby && this.clientId && this.lobby.hostId === this.clientId);
  }

  get playerCount() {
    return this.lobby?.players?.length ?? 0;
  }

  get selectedCharacterId() {
    return this.lobby?.players?.find((player) => player.id === this.clientId)?.characterId ?? null;
  }

  async connect() {
    if (this.socket) {
      return;
    }

    this.manualDisconnect = false;
    this.socket = new WebSocket(webSocketUrl());
    this.socket.addEventListener('message', (event) => this.handleMessage(event));
    this.socket.addEventListener('close', () => {
      this.socket = null;
      this.connected = false;
      this.stopHeartbeat();
      this.rejectPendingRequests(new Error('Соединение с лобби потеряно.'));
      this.dispatchEvent(new Event('change'));

      if (this.manualDisconnect) {
        return;
      }

      this.updateNetworkStatus('Соединение потеряно. Переподключаюсь...');
      this.scheduleReconnect();
    });

    await new Promise((resolve, reject) => {
      this.socket.addEventListener(
        'open',
        () => {
          this.connected = true;
          this.reconnectAttempt = 0;
          this.startHeartbeat();
          this.updateNetworkStatus();
          resolve();
        },
        { once: true }
      );
      this.socket.addEventListener(
        'error',
        () => reject(new Error('Не удалось подключиться к lobby-серверу. Запусти игру через npm run dev.')),
        { once: true }
      );
    });
  }

  createLobby() {
    return this.request({ type: 'createLobby', sessionToken: this.sessionToken }).then((payload) => {
      this.lobby = payload?.lobby ?? this.lobby;
      this.rememberLobbyState();
      this.dispatchEvent(new Event('change'));
      this.updateNetworkStatus();
      return payload;
    });
  }

  recreateLobbyWithPreviousCode() {
    return this.request({
      type: 'createLobby',
      sessionToken: this.sessionToken,
      preferredCode: this.lastLobbyCode
    }).then((payload) => {
      this.lobby = payload?.lobby ?? this.lobby;
      this.rememberLobbyState();
      this.dispatchEvent(new Event('change'));
      this.updateNetworkStatus();
      return payload;
    });
  }

  joinLobby(code) {
    return this.request({ type: 'joinLobby', code: normalizeCode(code), sessionToken: this.sessionToken }).then((payload) => {
      this.lobby = payload?.lobby ?? this.lobby;
      this.rememberLobbyState();
      this.dispatchEvent(new Event('change'));
      this.updateNetworkStatus();
      return payload;
    });
  }

  selectCharacter(characterId) {
    return this.request({ type: 'selectCharacter', characterId }).then((payload) => {
      this.lobby = payload?.lobby ?? this.lobby;
      this.lastCharacterId = characterId;
      this.rememberLobbyState();
      this.dispatchEvent(new Event('change'));
      this.updateNetworkStatus();
      this.startActiveLobbySceneIfNeeded();
      return payload;
    });
  }

  sendReaction(label) {
    if (!this.lobby || !this.connected || !REACTION_LABELS.has(label)) {
      return;
    }

    this.send({
      type: 'reaction',
      label,
      characterId: this.selectedCharacterId
    });
  }

  startLevel(sceneKey) {
    if (!this.isHost) {
      return;
    }

    this.lastSceneKey = sceneKey;
    this.send({ type: 'startLevel', sceneKey });
    this.startScene(sceneKey, { force: true });
  }

  requestNextLevel() {
    if (!this.lobby || !this.connected) {
      return;
    }

    this.send({ type: 'nextLevelRequest' });
  }

  requestRestartLevel() {
    if (!this.lobby || !this.connected) {
      return;
    }

    this.send({ type: 'restartLevelRequest' });
  }

  enterGameplay(scene) {
    this.scene = scene;
    this.remoteInputs.clear();
    this.remoteJumpBufferUntil.clear();
    this.lastSnapshotAt = 0;

    if (scene?.scene?.key) {
      this.lastSceneKey = scene.scene.key;
    }
  }

  leaveGameplay(scene) {
    if (this.scene === scene) {
      this.scene = null;
    }

    this.remoteTargets.clear();
  }

  ownsCharacter(characterId) {
    if (!this.lobby || !this.clientId) {
      return true;
    }

    const assignments = this.characterAssignments();
    return assignments.get(characterId) === this.clientId;
  }

  inputFor(characterId, localInput) {
    if (!this.lobby) {
      return localInput;
    }

    if (this.ownsCharacter(characterId)) {
      this.sendInputIfNeeded(characterId, localInput);
      return this.isHost ? localInput : emptyInput(characterId);
    }

    if (this.isHost) {
      return this.consumeRemoteInput(characterId);
    }

    return emptyInput(characterId);
  }

  receivePeerInput(input, clientId) {
    if (!this.isHost || !input?.characterId) {
      return;
    }

    const assignments = this.characterAssignments();

    if (assignments.get(input.characterId) !== clientId) {
      return;
    }

    const nextInput = normalizedInput(input);

    if (nextInput.jumpPressed) {
      this.remoteJumpBufferUntil.set(input.characterId, performance.now() + REMOTE_JUMP_BUFFER_MS);
    }

    this.remoteInputs.set(input.characterId, nextInput);
  }

  consumeRemoteInput(characterId) {
    const input = this.remoteInputs.get(characterId) ?? emptyInput(characterId);
    const bufferedUntil = this.remoteJumpBufferUntil.get(characterId) ?? 0;

    if (performance.now() <= bufferedUntil) {
      return { ...input, jumpPressed: true };
    }

    this.remoteJumpBufferUntil.delete(characterId);
    return input;
  }

  acknowledgeRemoteJump(characterId) {
    this.remoteJumpBufferUntil.delete(characterId);

    const input = this.remoteInputs.get(characterId);
    if (input) {
      input.jumpPressed = false;
    }
  }

  sendInputIfNeeded(characterId, localInput) {
    const input = normalizedInput({ characterId, ...localInput });
    const key = inputSignature(input);
    const now = performance.now();
    const previousKey = this.lastSentInputs.get(characterId);
    const previousAt = this.lastSentInputAt.get(characterId) ?? 0;
    const changed = key !== previousKey;
    const forceSend = input.jumpPressed || input.abilityPressed || now - previousAt >= INPUT_HEARTBEAT_MS;

    if (!changed && !forceSend) {
      return;
    }

    this.lastSentInputs.set(characterId, key);
    this.lastSentInputAt.set(characterId, now);
    this.send({ type: 'clientInput', input });
  }

  applySnapshot(snapshot) {
    if (this.isHost || !this.scene || !Array.isArray(snapshot?.players)) {
      return;
    }

    if (snapshot.completed && !this.scene.completed) {
      this.scene.markLevelCompleted?.({ fromNetwork: true });
    }

    const byId = new Map(this.scene.players.map((player) => [player.character.id, player]));

    for (const state of snapshot.players) {
      const player = byId.get(state.id);

      if (!player) {
        continue;
      }

      const samples = this.remoteTargets.get(state.id) ?? [];
      samples.push({
        receivedAt: performance.now(),
        x: state.x,
        y: state.y,
        vx: state.vx,
        vy: state.vy,
        flipX: Boolean(state.flipX),
        grounded: Boolean(state.grounded),
        respawning: Boolean(state.respawning),
        grapple: normalizeGrappleState(state.grapple),
        blueFall: normalizeBlueFallState(state.blueFall)
      });

      if (samples.length > SNAPSHOT_BUFFER_LIMIT) {
        samples.splice(0, samples.length - SNAPSHOT_BUFFER_LIMIT);
      }

      this.remoteTargets.set(state.id, samples);
    }
  }

  updateInterpolation() {
    if (this.isHost || !this.scene || this.remoteTargets.size === 0) {
      return;
    }

    const byId = new Map(this.scene.players.map((player) => [player.character.id, player]));

    const now = performance.now();

    for (const [characterId, samples] of this.remoteTargets) {
      const player = byId.get(characterId);
      const target = snapshotStateAt(samples, now);

      if (!player || !target) {
        continue;
      }

      player.sprite.setPosition(target.x, target.y);

      player.sprite.setVelocity(target.vx, target.vy);
      player.sprite.setFlipX(target.flipX);
      player.onGroundAt = target.grounded ? now : -1000;
      player.respawning = target.respawning;
      player.isMoving = Math.abs(target.vx) > 0.4;
      this.scene.applyNetworkPlayerState?.(player, target, now);
    }
  }

  sendSnapshot(time) {
    if (!this.isHost || !this.scene || time - this.lastSnapshotAt < SNAPSHOT_INTERVAL_MS) {
      return;
    }

    this.lastSnapshotAt = time;
    this.send({
      type: 'hostSnapshot',
      snapshot: {
        players: this.scene.players.map((player) => ({
          id: player.character.id,
          x: Math.round(player.sprite.x * 10) / 10,
          y: Math.round(player.sprite.y * 10) / 10,
          vx: Math.round(player.sprite.body.velocity.x * 100) / 100,
          vy: Math.round(player.sprite.body.velocity.y * 100) / 100,
          flipX: player.sprite.flipX,
          grounded: time - player.onGroundAt < 130,
          respawning: player.respawning,
          grapple: player.grapple
            ? {
                anchorId: player.grapple.anchor?.id ?? null,
                length: Math.round(player.grapple.length * 10) / 10
              }
            : null,
          blueFall:
            player.character.id === 'blue'
              ? {
                  energy: Math.round((player.blueFallEnergy ?? 0) * 10) / 10,
                  jumpUsed: Boolean(player.blueFallJumpUsed),
                  burstAge: blueFallBurstAge(player, time),
                  burstEnergy: Math.round((player.blueFallJumpBurstEnergy ?? 0) * 10) / 10
                }
              : null
        })),
        completed: this.scene.completed
      }
    });
  }

  characterAssignments() {
    if (this.lobby?.assignments) {
      return new Map(Object.entries(this.lobby.assignments));
    }

    const players = this.lobby?.players ?? [];
    const assignments = new Map();

    for (const player of players) {
      if (CHARACTER_ORDER.includes(player.characterId)) {
        assignments.set(player.characterId, player.id);
      }
    }

    const hostId = this.lobby?.hostId ?? players[0]?.id;

    for (const characterId of CHARACTER_ORDER) {
      if (!assignments.has(characterId) && hostId) {
        assignments.set(characterId, hostId);
      }
    }

    return assignments;
  }

  request(message) {
    const requestId = createRequestId();
    this.send({ ...message, requestId });

    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      window.setTimeout(() => {
        if (!this.pending.has(requestId)) {
          return;
        }

        this.pending.delete(requestId);
        reject(new Error('Lobby-сервер не ответил вовремя.'));
      }, 4000);
    });
  }

  send(message) {
    if (this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(message));
    }
  }

  disconnect() {
    this.manualDisconnect = true;
    this.clearReconnectTimer();
    this.stopHeartbeat();
    this.socket?.close();
    this.socket = null;
    this.connected = false;
    this.lobby = null;
    this.scene = null;
    this.remoteInputs.clear();
    this.remoteJumpBufferUntil.clear();
    this.remoteTargets.clear();
    this.lastSentInputs.clear();
    this.lastSentInputAt.clear();
    this.removeNetworkStatus();
  }

  handleMessage(event) {
    let message;

    try {
      message = JSON.parse(event.data);
    } catch {
      return;
    }

    if (message.type === 'connected') {
      this.clientId = message.clientId;
      return;
    }

    if (message.type === 'pong') {
      if (typeof message.sentAt === 'number') {
        this.recordLatency(Math.max(0, Math.round(performance.now() - message.sentAt)));
      }

      this.heartbeatMisses = 0;
      this.clearHeartbeatTimeout();
      this.updateNetworkStatus();
      return;
    }

    if (message.type === 'response' && message.requestId) {
      const pending = this.pending.get(message.requestId);

      if (!pending) {
        return;
      }

      this.pending.delete(message.requestId);

      if (message.ok) {
        pending.resolve(message.payload);
      } else {
        pending.reject(new Error(message.error ?? 'Lobby request failed'));
      }
      return;
    }

    if (message.type === 'lobbyState') {
      this.lobby = message.lobby;
      this.rememberLobbyState();
      this.dispatchEvent(new Event('change'));
      this.updateNetworkStatus();
      this.syncSceneToLobby();
      return;
    }

    if (message.type === 'peerInput') {
      this.receivePeerInput(message.input, message.clientId);
      return;
    }

    if (message.type === 'snapshot') {
      this.applySnapshot(message.snapshot);
      return;
    }

    if (message.type === 'reaction') {
      this.dispatchEvent(
        new CustomEvent('reaction', {
          detail: {
            clientId: message.clientId,
            characterId: message.characterId,
            label: message.label
          }
        })
      );
      return;
    }

    if (message.type === 'nextLevelRequest') {
      this.dispatchEvent(new CustomEvent('nextLevelRequest', { detail: { clientId: message.clientId } }));
      return;
    }

    if (message.type === 'restartLevelRequest') {
      this.dispatchEvent(new CustomEvent('restartLevelRequest', { detail: { clientId: message.clientId } }));
      return;
    }

    if (message.type === 'startLevel' && message.sceneKey) {
      this.lastSceneKey = message.sceneKey;
      this.startScene(message.sceneKey, { force: true });
    }
  }

  startScene(sceneKey, { force = false } = {}) {
    if (!sceneKey) {
      return;
    }

    if (!force && this.currentSceneKey() === sceneKey) {
      return;
    }

    if (this.scene) {
      this.scene.scene.start(sceneKey);
      return;
    }

    window.__zvezdiGame?.scene?.start?.(sceneKey);
  }

  startActiveLobbySceneIfNeeded() {
    if (!this.lobby?.sceneKey) {
      return;
    }

    this.startScene(this.lobby.sceneKey);
  }

  syncSceneToLobby() {
    if (!this.lobby?.sceneKey) {
      return;
    }

    this.startScene(this.lobby.sceneKey);
  }

  currentSceneKey() {
    return this.scene?.scene?.key ?? window.__zvezdiGame?.scene?.getScenes?.(true)?.[0]?.scene?.key ?? null;
  }

  rememberLobbyState() {
    if (this.lobby?.code) {
      this.lastLobbyCode = this.lobby.code;
    }

    if (this.lobby?.sceneKey) {
      this.lastSceneKey = this.lobby.sceneKey;
    }

    if (this.lobby && this.clientId) {
      this.lastWasHost = this.lobby.hostId === this.clientId;
    }

    if (this.selectedCharacterId) {
      this.lastCharacterId = this.selectedCharacterId;
    }
  }

  scheduleReconnect() {
    if (this.manualDisconnect || !this.lastLobbyCode || this.reconnectTimer) {
      return;
    }

    const delay = RECONNECT_DELAYS_MS[Math.min(this.reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)];
    this.reconnectAttempt += 1;
    this.updateNetworkStatus(`Переподключение через ${Math.ceil(delay / 1000)} с...`);
    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.reconnectToLobby();
    }, delay);
  }

  async reconnectToLobby() {
    if (this.manualDisconnect || this.connected || !this.lastLobbyCode) {
      return;
    }

    this.updateNetworkStatus('Переподключаюсь...');

    try {
      await this.connect();
      try {
        await this.joinLobby(this.lastLobbyCode);
      } catch (error) {
        if (!this.lastWasHost || !isLobbyNotFoundError(error)) {
          throw error;
        }

        await this.recreateLobbyWithPreviousCode();
      }

      if (this.lastCharacterId) {
        await this.selectCharacter(this.lastCharacterId);
      }

      if (this.lastWasHost && this.lastSceneKey) {
        this.startLevel(this.lastSceneKey);
      }

      this.startActiveLobbySceneIfNeeded();
      this.updateNetworkStatus();
    } catch {
      this.connected = false;
      this.stopHeartbeat();
      this.socket?.close();
      this.socket = null;
      this.scheduleReconnect();
    }
  }

  clearReconnectTimer() {
    if (!this.reconnectTimer) {
      return;
    }

    window.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  rejectPendingRequests(error) {
    for (const pending of this.pending.values()) {
      pending.reject(error);
    }

    this.pending.clear();
  }

  startHeartbeat() {
    this.stopHeartbeat();
    this.heartbeatMisses = 0;
    this.sendHeartbeat();
    this.heartbeatInterval = window.setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS);
  }

  stopHeartbeat() {
    if (this.heartbeatInterval) {
      window.clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    this.clearHeartbeatTimeout();
  }

  sendHeartbeat() {
    if (!this.connected || this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    if (this.heartbeatTimeout) {
      return;
    }

    this.lastPingAt = performance.now();
    this.send({ type: 'ping', sentAt: this.lastPingAt });
    this.heartbeatTimeout = window.setTimeout(() => {
      if (this.manualDisconnect) {
        return;
      }

      this.heartbeatTimeout = null;
      this.heartbeatMisses += 1;

      if (this.heartbeatMisses < HEARTBEAT_MAX_MISSES) {
        this.updateNetworkStatus(`Проверяю соединение... ${this.heartbeatMisses}/${HEARTBEAT_MAX_MISSES}`);
        this.sendHeartbeat();
        return;
      }

      this.updateNetworkStatus('Соединение потеряно. Переподключаюсь...');
      this.connected = false;
      this.socket?.close();
    }, HEARTBEAT_TIMEOUT_MS);
  }

  recordLatency(sample) {
    this.latencySamples.push(sample);

    if (this.latencySamples.length > 9) {
      this.latencySamples.shift();
    }

    this.latencyMs = Math.min(...this.latencySamples);
  }

  clearHeartbeatTimeout() {
    if (!this.heartbeatTimeout) {
      return;
    }

    window.clearTimeout(this.heartbeatTimeout);
    this.heartbeatTimeout = null;
  }

  updateNetworkStatus(message = null) {
    if (!this.lobby && !message) {
      this.removeNetworkStatus();
      return;
    }

    if (!this.statusOverlay) {
      this.statusOverlay = document.createElement('div');
      this.statusOverlay.className = 'network-status-overlay';
      document.body.append(this.statusOverlay);
    }

    const code = this.code ? `Лобби ${this.code}` : 'Лобби';
    const latency = typeof this.latencyMs === 'number' ? ` · ${this.latencyMs} мс` : '';
    const text = message ?? `${code}${latency}`;
    this.statusOverlay.textContent = text;
    this.statusOverlay.classList.toggle('network-status-overlay--warn', Boolean(message) || (this.latencyMs ?? 0) > 180);
  }

  removeNetworkStatus() {
    this.statusOverlay?.remove();
    this.statusOverlay = null;
  }
}

function webSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/lobby`;
}

function normalizeCode(code) {
  return String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function isLobbyNotFoundError(error) {
  return String(error?.message ?? error).includes('Лобби не найдено');
}

function normalizeGrappleState(grapple) {
  if (!grapple?.anchorId) {
    return null;
  }

  return {
    anchorId: String(grapple.anchorId),
    length: Number.isFinite(Number(grapple.length)) ? Number(grapple.length) : null
  };
}

function normalizeBlueFallState(blueFall) {
  if (!blueFall) {
    return null;
  }

  return {
    energy: finiteNumber(blueFall.energy, 0),
    jumpUsed: Boolean(blueFall.jumpUsed),
    burstAge: blueFall.burstAge === null ? null : finiteNumber(blueFall.burstAge, null),
    burstEnergy: finiteNumber(blueFall.burstEnergy, 0)
  };
}

function blueFallBurstAge(player, time) {
  const burstAge = time - (player.blueFallJumpBurstAt ?? -1000);
  return burstAge >= 0 && burstAge <= 420 ? Math.round(burstAge) : null;
}

function finiteNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function snapshotStateAt(samples, now) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return null;
  }

  const renderAt = now - SNAPSHOT_RENDER_DELAY_MS;
  let previous = samples[0];
  let next = null;

  for (const sample of samples) {
    if (sample.receivedAt <= renderAt) {
      previous = sample;
      continue;
    }

    next = sample;
    break;
  }

  if (next && next !== previous) {
    const span = Math.max(1, next.receivedAt - previous.receivedAt);
    const alpha = Math.max(0, Math.min(1, (renderAt - previous.receivedAt) / span));
    return interpolateSnapshot(previous, next, alpha);
  }

  const latest = samples.at(-1);
  const extrapolateMs = Math.max(0, Math.min(SNAPSHOT_MAX_EXTRAPOLATE_MS, renderAt - latest.receivedAt));
  const frameScale = extrapolateMs / 16.67;

  return {
    ...latest,
    x: latest.x + latest.vx * frameScale,
    y: latest.y + latest.vy * frameScale
  };
}

function interpolateSnapshot(previous, next, alpha) {
  return {
    ...next,
    x: previous.x + (next.x - previous.x) * alpha,
    y: previous.y + (next.y - previous.y) * alpha,
    vx: previous.vx + (next.vx - previous.vx) * alpha,
    vy: previous.vy + (next.vy - previous.vy) * alpha,
    flipX: alpha < 0.5 ? previous.flipX : next.flipX,
    grounded: alpha < 0.5 ? previous.grounded : next.grounded,
    respawning: previous.respawning || next.respawning,
    grapple: alpha < 0.5 ? previous.grapple : next.grapple,
    blueFall: alpha < 0.5 ? previous.blueFall : next.blueFall
  };
}

function normalizedInput(input) {
  return {
    characterId: input.characterId,
    left: Boolean(input.left),
    right: Boolean(input.right),
    down: Boolean(input.down),
    jump: Boolean(input.jump),
    ability: Boolean(input.ability),
    jumpPressed: Boolean(input.jumpPressed),
    abilityPressed: Boolean(input.abilityPressed)
  };
}

function inputSignature(input) {
  return [
    input.left ? 1 : 0,
    input.right ? 1 : 0,
    input.down ? 1 : 0,
    input.jump ? 1 : 0,
    input.ability ? 1 : 0,
    input.jumpPressed ? 1 : 0,
    input.abilityPressed ? 1 : 0
  ].join('');
}

function emptyInput(characterId) {
  return {
    characterId,
    left: false,
    right: false,
    down: false,
    jump: false,
    ability: false,
    jumpPressed: false,
    abilityPressed: false
  };
}

function createRequestId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
