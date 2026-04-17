import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
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
  ['.css', 'text/css; charset=utf-8'],
  ['.svg', 'image/svg+xml'],
  ['.mp4', 'video/mp4'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg']
]);

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

function handleRequest(request, response) {
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
