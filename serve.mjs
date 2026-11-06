/* Minimal local static server + YouTube audio streaming proxy. */
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const ROOT = process.cwd();
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

const ytSearchCache = new Map();
const streamUrlCache = new Map();

async function searchYouTube(query) {
  const q = String(query || '').trim();
  if (!q) return null;
  if (ytSearchCache.has(q)) return ytSearchCache.get(q);

  try {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(4500)
    });
    const html = await r.text();
    const m = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/>var ytInitialData = ({.*?});</s);
    if (!m) return null;
    const data = JSON.parse(m[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    if (!Array.isArray(contents)) return null;

    for (const item of contents) {
      const v = item.videoRenderer;
      if (v && v.videoId) {
        const res = {
          videoId: v.videoId,
          title: v.title?.runs?.[0]?.text || '',
          duration: v.lengthText?.simpleText || ''
        };
        ytSearchCache.set(q, res);
        return res;
      }
    }
  } catch (err) {
    console.error('YouTube search error:', err.message);
  }
  return null;
}

async function getAudioStreamUrl(videoId) {
  const id = String(videoId || '').trim();
  if (!id) return null;
  if (streamUrlCache.has(id)) {
    const item = streamUrlCache.get(id);
    if (Date.now() - item.time < 3.5 * 3600 * 1000) {
      return item.url;
    }
  }

  try {
    const url = 'https://www.youtube.com/watch?v=' + id;
    const { stdout } = await execFileAsync('python', [
      '-m', 'yt_dlp',
      '-g',
      '-f', 'bestaudio[ext=m4a]/bestaudio/best',
      '--no-playlist',
      url
    ], { timeout: 15000 });
    const lines = stdout.trim().split(/\r?\n/).filter(Boolean);
    const streamUrl = lines[lines.length - 1];
    if (streamUrl && streamUrl.startsWith('http')) {
      streamUrlCache.set(id, { url: streamUrl, time: Date.now() });
      return streamUrl;
    }
  } catch (err) {
    console.error('Failed to extract audio stream for ' + id + ':', err.message);
  }
  return null;
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');

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

    // API endpoint: /api/search?q=...
    if (url.pathname === '/api/search') {
      const { default: searchHandler } = await import('./api/search.js');
      const apiReq = {
        method: req.method,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers
      };
      const apiRes = {
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
        end() { res.writeHead(this.statusCode, this.headers); res.end(); }
      };
      await searchHandler(apiReq, apiRes);
      return;
    }

    // API endpoint: /api/lyrics?track=...&artist=...
    if (url.pathname === '/api/lyrics') {
      const { default: lyricsHandler } = await import('./api/lyrics.js');
      const apiReq = {
        method: req.method,
        query: Object.fromEntries(url.searchParams.entries()),
        headers: req.headers
      };
      const apiRes = {
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
        end() { res.writeHead(this.statusCode, this.headers); res.end(); }
      };
      await lyricsHandler(apiReq, apiRes);
      return;
    }

    // API endpoint: /api/yt-search?q=...
    if (url.pathname === '/api/yt-search') {
      const q = url.searchParams.get('q') || '';
      const result = await searchYouTube(q);
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=3600'
      });
      res.end(JSON.stringify(result || { error: 'not_found' }));
      return;
    }

    // API endpoint: /api/stream?id=... or /api/stream?q=...
    if (url.pathname === '/api/stream') {
      let videoId = url.searchParams.get('id') || '';
      const q = url.searchParams.get('q') || '';

      if (!videoId && q) {
        const found = await searchYouTube(q);
        if (found && found.videoId) videoId = found.videoId;
      }

      if (!videoId) {
        res.writeHead(400, {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*'
        });
        res.end(JSON.stringify({ error: 'missing_id_or_query' }));
        return;
      }

      const streamUrl = await getAudioStreamUrl(videoId);
      if (!streamUrl) {
        res.writeHead(502, {
          'content-type': 'application/json; charset=utf-8',
          'access-control-allow-origin': '*'
        });
        res.end(JSON.stringify({ error: 'stream_unavailable' }));
        return;
      }

      const upstreamHeaders = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      };
      if (req.headers.range) {
        upstreamHeaders['Range'] = req.headers.range;
      }

      const abortCtrl = new AbortController();
      req.on('close', () => abortCtrl.abort());

      const upstream = await fetch(streamUrl, {
        headers: upstreamHeaders,
        signal: abortCtrl.signal
      });

      const resHeaders = {
        'content-type': upstream.headers.get('content-type') || 'audio/mp4',
        'accept-ranges': 'bytes',
        'access-control-allow-origin': '*',
        'cache-control': 'public, max-age=14400'
      };

      if (upstream.headers.has('content-length')) {
        resHeaders['content-length'] = upstream.headers.get('content-length');
      }
      if (upstream.headers.has('content-range')) {
        resHeaders['content-range'] = upstream.headers.get('content-range');
      }

      res.writeHead(upstream.status, resHeaders);

      if (req.method === 'HEAD' || !upstream.body) {
        res.end();
        return;
      }

      const reader = upstream.body.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!res.write(value)) {
            await new Promise((resolve) => res.once('drain', resolve));
          }
        }
      } catch (err) {
        // Stream closed or cancelled
      } finally {
        res.end();
      }
      return;
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/nagham-studio.html';
    const file = normalize(join(ROOT, pathname));
    if (file !== ROOT && !file.startsWith(ROOT + sep)) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('403');
      return;
    }
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream',
      'cache-control': 'no-store'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('404');
  }
}).listen(PORT, '127.0.0.1', () => {
  console.log('NAGHAM Studio: http://127.0.0.1:' + PORT + '/nagham-studio.html');
});
