import { createReadStream } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:http';
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

function listen(port) {
  return new Promise((resolve, reject) => {
    const server = createServer(handleRequest);
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
