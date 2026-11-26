// Zero-dependency static server: `npm start`, then open http://localhost:8080
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const port = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function resolvePath(url) {
  try {
    const path = decodeURIComponent(new URL(url, 'http://localhost').pathname);
    const file = resolve(root, `.${path.endsWith('/') ? `${path}index.html` : path}`);
    return file === root || file.startsWith(root + sep) ? file : null;
  } catch {
    return null;
  }
}

createServer(async (req, res) => {
  const file = resolvePath(req.url);
  if (!file) return res.writeHead(400).end('Bad request');
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'cache-control': 'no-store' }).end(body);
  } catch {
    res.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log(`Team tracker running at http://localhost:${port}`));
