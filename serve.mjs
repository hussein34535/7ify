/* Minimal local development server matching Vercel serverless contracts. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep, resolve } from 'node:path';

const ROOT = resolve(process.cwd());
const PORT = Number(process.env.PORT || 8787);
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8'
};

function createApiRes(res) {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) {
      res.writeHead(this.statusCode, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        ...this.headers
      });
      res.end(JSON.stringify(data));
    },
    redirect(code, location) {
      res.writeHead(code, {
        'location': location,
        'access-control-allow-origin': '*',
        ...this.headers
      });
      res.end();
    },
    end() {
      res.writeHead(this.statusCode, this.headers);
      res.end();
    }
  };
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1:' + PORT);

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type, Accept',
        'Access-Control-Max-Age': '86400'
      });
      res.end();
      return;
    }

    const apiReq = {
      method: req.method,
      query: Object.fromEntries(url.searchParams.entries()),
      headers: req.headers
    };

    // API endpoint: /api/search
    if (url.pathname === '/api/search') {
      const { default: searchHandler } = await import('./api/search.js');
      await searchHandler(apiReq, createApiRes(res));
      return;
    }

    // API endpoint: /api/search-multi
    if (url.pathname === '/api/search-multi') {
      const { default: multiSearchHandler } = await import('./api/search-multi.js');
      await multiSearchHandler(apiReq, createApiRes(res));
      return;
    }

    // API endpoint: /api/lyrics
    if (url.pathname === '/api/lyrics') {
      const { default: lyricsHandler } = await import('./api/lyrics.js');
      await lyricsHandler(apiReq, createApiRes(res));
      return;
    }

    // API endpoint: /api/stream (unified with Vercel)
    if (url.pathname === '/api/stream') {
      const { default: streamHandler } = await import('./api/stream.js');
      await streamHandler(apiReq, createApiRes(res));
      return;
    }

    // API endpoint: /api/yt-search
    if (url.pathname === '/api/yt-search') {
      const { default: ytHandler } = await import('./api/yt-search.js');
      await ytHandler(apiReq, createApiRes(res));
      return;
    }

    // API endpoint: /api/provider-match
    if (url.pathname === '/api/provider-match') {
      const { default: matchHandler } = await import('./api/provider-match.js');
      await matchHandler(apiReq, createApiRes(res));
      return;
    }

    // Static file serving with strict path traversal prevention
    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/' || pathname === '/callback') pathname = '/nagham-studio.html';
    const filePath = normalize(join(ROOT, pathname));

    if (filePath !== ROOT && !filePath.startsWith(ROOT + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('403 Forbidden');
      return;
    }

    const data = await readFile(filePath);
    res.writeHead(200, {
      'content-type': TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(data);
  } catch (err) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`NAGHAM Studio: http://127.0.0.1:${PORT}/nagham-studio.html`);
});

export default server;
