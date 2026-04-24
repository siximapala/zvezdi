import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const host = process.env.HOST || '127.0.0.1';
const startPort = Number(process.env.PORT || 4173);

const types = new Map([
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.tmj', 'application/json; charset=utf-8'],
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg']
]);

const LEVEL_MANIFEST_PATH = '/assets/levels/manifest.json';
const WS_MAGIC = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const CHARACTER_SLOTS = ['pink', 'blue', 'green'];
const MAX_LOBBY_CLIENTS = 3;
const REACTION_LABELS = new Set(['Привет!', 'Сюда!', 'Готов!']);
const EMPTY_LOBBY_TTL_MS = 10 * 60 * 1000;
const CLIENT_STALE_MS = 45 * 1000;
const lobbies = new Map();

function safePath(requestUrl) {
  const url = new URL(requestUrl, `http://${host}:${startPort}`);
  const rawPath = decodeURIComponent(url.pathname);
  const normalized = rawPath === '/' ? '/index.html' : rawPath;
  const filePath = path.resolve(root, `.${normalized}`);

  if (!filePath.startsWith(root)) {
    return null;
  }

  return filePath;
}

async function buildLevelManifest() {
  const levelsDir = path.join(root, 'assets', 'levels');
  const entries = await readdir(levelsDir, { withFileTypes: true });
  const levels = [];
  const errors = [];

  for (const entry of entries) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.tmj') {
      continue;
    }

    try {
      const filePath = path.join(levelsDir, entry.name);
      const map = JSON.parse(await readFile(filePath, 'utf8'));
      const properties = readTiledProperties(map);
      const id = stringValue(properties.id, path.basename(entry.name, '.tmj'));

      const bounds = mapWorldBounds(map);

      levels.push({
        id,
        alias: nullableString(properties.alias),
        path: `assets/levels/${entry.name}`,
        tiledKey: `${id}-tiled`,
        title: nullableString(properties.title),
        startMessage: nullableString(properties.startMessage),
        completeMessage: nullableString(properties.completeMessage),
        nextLevel: nullableString(properties.nextLevel),
        worldWidth: Math.max(numberValue(properties.worldWidth), bounds.width),
        worldHeight: Math.max(numberValue(properties.worldHeight), bounds.height)
      });
    } catch (error) {
      errors.push({
        file: entry.name,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  return { levels, errors };
}

function readTiledProperties(map) {
  return Object.fromEntries((map.properties ?? []).map((property) => [property.name, property.value]));
}

function mapWorldBounds(map) {
  const mapWidth = numberValue(map.width) * numberValue(map.tilewidth);
  const mapHeight = numberValue(map.height) * numberValue(map.tileheight);
  let maxX = mapWidth;
  let maxY = mapHeight;

  for (const layer of map.layers ?? []) {
    if (layer.type !== 'objectgroup') {
      continue;
    }

    for (const object of layer.objects ?? []) {
      maxX = Math.max(maxX, numberValue(object.x) + numberValue(object.width));
      maxY = Math.max(maxY, numberValue(object.y) + numberValue(object.height));
    }
  }

  return {
    width: Math.ceil(maxX),
    height: Math.ceil(maxY)
  };
}

function stringValue(...values) {
  return values.find((value) => value !== undefined && value !== null && value !== '') ?? '';
}

function nullableString(value) {
  if (value === undefined || value === null || value === '') {
    return null;
  }

  const result = String(value);
  return result === 'null' || result === 'none' ? null : result;
}

function numberValue(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function handleRequest(request, response) {
  const url = new URL(request.url, `http://${host}:${startPort}`);

  if (url.pathname === LEVEL_MANIFEST_PATH) {
    buildLevelManifest()
      .then((manifest) => {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify(manifest, null, 2));
      })
      .catch((error) => {
        response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end(error instanceof Error ? error.message : 'Failed to build level manifest');
      });
    return;
  }

  const filePath = safePath(request.url);

  if (!filePath) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }

  stat(filePath)
    .then((fileStat) => {
      const finalPath = fileStat.isDirectory() ? path.join(filePath, 'index.html') : filePath;
      const contentType = types.get(path.extname(finalPath)) || 'application/octet-stream';
      response.writeHead(200, { 'Content-Type': contentType });
      createReadStream(finalPath).pipe(response);
    })
    .catch(() => {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    });
}

function handleUpgrade(request, socket) {
  const url = new URL(request.url, `http://${host}:${startPort}`);

  if (url.pathname !== '/lobby') {
    socket.destroy();
    return;
  }

  const key = request.headers['sec-websocket-key'];

  if (!key) {
    socket.destroy();
    return;
  }

  const accept = crypto.createHash('sha1').update(`${key}${WS_MAGIC}`).digest('base64');
  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${accept}`,
      '\r\n'
    ].join('\r\n')
  );

  const client = createWsClient(socket);
  sendWs(client, { type: 'connected', clientId: client.id });
}

function createWsClient(socket) {
  socket.setNoDelay(true);
  socket.setKeepAlive(true, 10_000);

  const client = {
    id: crypto.randomUUID(),
    socket,
    lobbyCode: null,
    characterId: null,
    sessionToken: null,
    lastSeenAt: Date.now(),
    buffer: Buffer.alloc(0)
  };

  socket.on('data', (chunk) => {
    client.lastSeenAt = Date.now();
    client.buffer = Buffer.concat([client.buffer, chunk]);
    readWsFrames(client);
  });
  socket.on('close', () => removeClient(client));
  socket.on('error', () => removeClient(client));

  return client;
}

function readWsFrames(client) {
  while (client.buffer.length >= 2) {
    const first = client.buffer[0];
    const second = client.buffer[1];
    const opcode = first & 0x0f;
    const masked = Boolean(second & 0x80);
    let length = second & 0x7f;
    let offset = 2;

    if (length === 126) {
      if (client.buffer.length < offset + 2) {
        return;
      }

      length = client.buffer.readUInt16BE(offset);
      offset += 2;
    } else if (length === 127) {
      if (client.buffer.length < offset + 8) {
        return;
      }

      const high = client.buffer.readUInt32BE(offset);
      const low = client.buffer.readUInt32BE(offset + 4);
      length = high * 2 ** 32 + low;
      offset += 8;
    }

    const maskOffset = offset;
    const payloadOffset = masked ? offset + 4 : offset;
    const frameEnd = payloadOffset + length;

    if (client.buffer.length < frameEnd) {
      return;
    }

    if (opcode === 8) {
      client.socket.end();
      return;
    }

    if (opcode === 1) {
      const payload = Buffer.from(client.buffer.subarray(payloadOffset, frameEnd));

      if (masked) {
        const mask = client.buffer.subarray(maskOffset, maskOffset + 4);

        for (let index = 0; index < payload.length; index += 1) {
          payload[index] ^= mask[index % 4];
        }
      }

      handleLobbyMessage(client, payload.toString('utf8'));
    }

    client.buffer = client.buffer.subarray(frameEnd);
  }
}

function handleLobbyMessage(client, rawMessage) {
  let message;

  try {
    message = JSON.parse(rawMessage);
  } catch {
    return;
  }

  client.lastSeenAt = Date.now();

  if (message.type === 'ping') {
    sendWs(client, { type: 'pong', sentAt: message.sentAt, serverAt: Date.now() });
    return;
  }

  if (message.type === 'createLobby') {
    client.sessionToken = normalizeSessionToken(message.sessionToken);
    const lobby = createLobby(client, normalizeLobbyCode(message.preferredCode));
    respond(client, message.requestId, true, { lobby: publicLobby(lobby) });
    broadcastLobbyState(lobby);
    return;
  }

  if (message.type === 'joinLobby') {
    const lobby = lobbies.get(normalizeLobbyCode(message.code));

    if (!lobby) {
      respond(client, message.requestId, false, null, 'Лобби не найдено');
      return;
    }

    if (!lobby.clients.has(client.id) && lobby.clients.size >= MAX_LOBBY_CLIENTS) {
      respond(client, message.requestId, false, null, 'Лобби уже заполнено');
      return;
    }

    client.sessionToken = normalizeSessionToken(message.sessionToken);
    joinLobby(client, lobby);
    respond(client, message.requestId, true, { lobby: publicLobby(lobby) });
    broadcastLobbyState(lobby);
    return;
  }

  const lobby = client.lobbyCode ? lobbies.get(client.lobbyCode) : null;

  if (!lobby) {
    return;
  }

  if (message.type === 'clientInput') {
    const host = lobby.clients.get(lobby.hostId);

    if (host && client.id !== lobby.hostId) {
      sendWs(host, { type: 'peerInput', clientId: client.id, input: message.input });
    }
    return;
  }

  if (message.type === 'selectCharacter') {
    const characterId = normalizeCharacterId(message.characterId);

    if (!characterId) {
      respond(client, message.requestId, false, null, 'Неизвестная звезда');
      return;
    }

    const occupied = [...lobby.clients.values()].some((candidate) => {
      return candidate.id !== client.id && candidate.characterId === characterId;
    });

    if (occupied) {
      respond(client, message.requestId, false, null, 'Эта звезда уже занята');
      return;
    }

    client.characterId = characterId;
    respond(client, message.requestId, true, { lobby: publicLobby(lobby) });
    broadcastLobbyState(lobby);
    return;
  }

  if (message.type === 'reaction') {
    const label = normalizeReactionLabel(message.label);

    if (!label) {
      return;
    }

    broadcast(lobby, {
      type: 'reaction',
      clientId: client.id,
      characterId: client.characterId,
      label
    });
    return;
  }

  if (message.type === 'hostSnapshot' && client.id === lobby.hostId) {
    broadcast(lobby, { type: 'snapshot', snapshot: message.snapshot }, client.id);
    return;
  }

  if (message.type === 'nextLevelRequest') {
    const host = lobby.clients.get(lobby.hostId);

    if (host && client.id !== lobby.hostId) {
      sendWs(host, { type: 'nextLevelRequest', clientId: client.id });
    }
    return;
  }

  if (message.type === 'restartLevelRequest') {
    const host = lobby.clients.get(lobby.hostId);

    if (host && client.id !== lobby.hostId) {
      sendWs(host, { type: 'restartLevelRequest', clientId: client.id });
    }
    return;
  }

  if (message.type === 'startLevel' && client.id === lobby.hostId) {
    lobby.sceneKey = message.sceneKey;
    broadcast(lobby, { type: 'startLevel', sceneKey: message.sceneKey }, client.id);
    broadcastLobbyState(lobby);
  }
}

function createLobby(client, preferredCode = '') {
  removeClient(client);

  let code = preferredCode && !lobbies.has(preferredCode) ? preferredCode : createLobbyCode();

  while (lobbies.has(code)) {
    code = createLobbyCode();
  }

  const lobby = {
    code,
    hostId: client.id,
    clients: new Map(),
    sceneKey: null,
    deleteTimer: null
  };

  lobbies.set(code, lobby);
  joinLobby(client, lobby);
  return lobby;
}

function joinLobby(client, lobby) {
  const previousClient = findClientBySessionToken(lobby, client.sessionToken);
  const previousCharacterId = previousClient?.characterId;

  if (previousClient && previousClient.id !== client.id) {
    previousClient.lobbyCode = null;
    previousClient.characterId = null;
    previousClient.socket.destroy();
    lobby.clients.delete(previousClient.id);
  }

  removeClient(client);
  cancelLobbyDelete(lobby);
  client.lobbyCode = lobby.code;
  client.characterId = previousCharacterId ?? firstFreeCharacter(lobby);
  lobby.clients.set(client.id, client);
}

function removeClient(client) {
  if (!client.lobbyCode) {
    return;
  }

  const lobby = lobbies.get(client.lobbyCode);
  client.lobbyCode = null;
  client.characterId = null;

  if (!lobby) {
    return;
  }

  lobby.clients.delete(client.id);

  if (lobby.clients.size === 0) {
    scheduleLobbyDelete(lobby);
    return;
  }

  if (lobby.hostId === client.id) {
    lobby.hostId = lobby.clients.keys().next().value;
  }

  broadcastLobbyState(lobby);
}

function scheduleLobbyDelete(lobby) {
  cancelLobbyDelete(lobby);
  lobby.deleteTimer = setTimeout(() => {
    if (lobby.clients.size === 0) {
      lobbies.delete(lobby.code);
    }
  }, EMPTY_LOBBY_TTL_MS);
}

function cancelLobbyDelete(lobby) {
  if (!lobby?.deleteTimer) {
    return;
  }

  clearTimeout(lobby.deleteTimer);
  lobby.deleteTimer = null;
}

function publicLobby(lobby) {
  return {
    code: lobby.code,
    hostId: lobby.hostId,
    sceneKey: lobby.sceneKey,
    assignments: characterAssignmentsForLobby(lobby),
    players: [...lobby.clients.values()].map((client) => ({
      id: client.id,
      characterId: client.characterId,
      isHost: client.id === lobby.hostId
    }))
  };
}

function characterAssignmentsForLobby(lobby) {
  const assignments = {};

  for (const client of lobby.clients.values()) {
    if (client.characterId) {
      assignments[client.characterId] = client.id;
    }
  }

  for (const characterId of CHARACTER_SLOTS) {
    if (!assignments[characterId]) {
      assignments[characterId] = lobby.hostId;
    }
  }

  return assignments;
}

function broadcastLobbyState(lobby) {
  broadcast(lobby, { type: 'lobbyState', lobby: publicLobby(lobby) });
}

function broadcast(lobby, message, exceptClientId = null) {
  for (const client of lobby.clients.values()) {
    if (client.id !== exceptClientId) {
      sendWs(client, message);
    }
  }
}

function respond(client, requestId, ok, payload = null, error = null) {
  if (!requestId) {
    return;
  }

  sendWs(client, { type: 'response', requestId, ok, payload, error });
}

function sendWs(client, message) {
  if (client.socket.destroyed) {
    return;
  }

  const payload = Buffer.from(JSON.stringify(message), 'utf8');
  let header;

  if (payload.length < 126) {
    header = Buffer.from([0x81, payload.length]);
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payload.length, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeUInt32BE(0, 2);
    header.writeUInt32BE(payload.length, 6);
  }

  client.socket.write(Buffer.concat([header, payload]));
}

function createLobbyCode() {
  return crypto.randomBytes(3).toString('hex').toUpperCase();
}

function normalizeLobbyCode(code) {
  return String(code ?? '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
}

function normalizeCharacterId(characterId) {
  const normalized = String(characterId ?? '').trim().toLowerCase();
  return CHARACTER_SLOTS.includes(normalized) ? normalized : null;
}

function normalizeSessionToken(sessionToken) {
  const normalized = String(sessionToken ?? '').trim();
  return normalized.length >= 8 && normalized.length <= 120 ? normalized : crypto.randomUUID();
}

function findClientBySessionToken(lobby, sessionToken) {
  if (!sessionToken) {
    return null;
  }

  return [...lobby.clients.values()].find((client) => client.sessionToken === sessionToken) ?? null;
}

function normalizeReactionLabel(label) {
  const normalized = String(label ?? '').trim();
  return REACTION_LABELS.has(normalized) ? normalized : null;
}

function firstFreeCharacter(lobby) {
  const occupied = new Set([...lobby.clients.values()].map((client) => client.characterId).filter(Boolean));
  return CHARACTER_SLOTS.find((characterId) => !occupied.has(characterId)) ?? null;
}

function pruneStaleClients() {
  const now = Date.now();

  for (const lobby of lobbies.values()) {
    for (const client of [...lobby.clients.values()]) {
      if (now - client.lastSeenAt <= CLIENT_STALE_MS) {
        continue;
      }

      client.socket.destroy();
      removeClient(client);
    }
  }
}

setInterval(pruneStaleClients, 5000).unref?.();

function listen(port) {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);
    server.on('upgrade', handleUpgrade);
    server.once('error', reject);
    server.listen(port, host, () => resolve({ server, port }));
  });
}

let started = false;

for (let offset = 0; offset < 20; offset += 1) {
  const port = startPort + offset;

  try {
    await listen(port);
    console.log(`Zvezdi dev server: http://${host}:${port}`);
    started = true;
    break;
  } catch (error) {
    if (error.code !== 'EADDRINUSE') {
      throw error;
    }
  }
}

if (!started) {
  throw new Error(`No free port from ${startPort} to ${startPort + 19}`);
}
