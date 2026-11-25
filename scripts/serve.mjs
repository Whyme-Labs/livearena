import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const files = {
  '/': ['index.html', 'text/html'],
  '/index.html': ['index.html', 'text/html'],
  '/arena.css': ['arena.css', 'text/css'],
  '/arena.mjs': ['arena.mjs', 'text/javascript'],
  '/ui.mjs': ['ui.mjs', 'text/javascript'],
  '/devnet.json': ['devnet.json', 'application/json'],
};

const port = Number(process.env.PORT ?? 4173);
createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  const item = Object.hasOwn(files, pathname) ? files[pathname] : null;
  if (!item || !['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const [name, mime] = item;
    const body = await readFile(new URL('../app/' + name, import.meta.url));
    response.writeHead(200, { 'content-type': mime + '; charset=utf-8', 'x-content-type-options': 'nosniff' });
    response.end(request.method === 'HEAD' ? undefined : body);
  } catch {
    response.writeHead(404).end('Not found');
  }
}).listen(port, () => console.log('LiveArena running at http://localhost:' + port));
