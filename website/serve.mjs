/**
 * Basit statik sunucu: `node serve.mjs [port] [dir]` — varsayılan 8140, dist/.
 * Temiz URL'ler (/rotalar/ → /rotalar/index.html) ve 404.html desteği.
 */
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.argv[2] || process.env.PORT || 8140);
const root = path.resolve(process.argv[3] || path.join(HERE, 'dist'));

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gpx': 'application/gpx+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

function send(res, file, status = 200) {
  const ext = path.extname(file).toLowerCase();
  res.writeHead(status, {
    'Content-Type': TYPES[ext] ?? 'application/octet-stream',
    'Cache-Control': 'no-cache',
  });
  createReadStream(file).pipe(res);
}

createServer((req, res) => {
  let pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (pathname.includes('..')) {
    res.writeHead(400).end();
    return;
  }
  let file = path.join(root, pathname);
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/` }).end();
      return;
    }
    file = path.join(file, 'index.html');
  }
  if (existsSync(file) && statSync(file).isFile()) {
    send(res, file);
    return;
  }
  const nf = path.join(root, '404.html');
  if (existsSync(nf)) send(res, nf, 404);
  else res.writeHead(404, { 'Content-Type': 'text/plain' }).end('404');
}).listen(port, () => {
  console.log(`▶ http://localhost:${port}  (${root})`);
});
