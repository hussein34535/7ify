export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { id, q, preview } = req.query || {};

  // 1. Direct preview URL parameter: redirect 302 to the high-speed Apple Music CDN
  if (preview && typeof preview === 'string' && preview.startsWith('http')) {
    res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
    return res.redirect(302, preview);
  }

  // 2. Query or track ID: dynamically resolve stream from iTunes Search API
  const query = String(q || id || '').trim();
  if (query) {
    try {
      const itunesUrl = 'https://itunes.apple.com/search?term=' + encodeURIComponent(query) + '&media=music&entity=song&limit=1';
      const r = await fetch(itunesUrl, {
        headers: { 'User-Agent': '7ify (https://7ify.vercel.app)' },
        signal: AbortSignal.timeout(4500)
      });
      if (r.ok) {
        const data = await r.json();
        const found = data.results?.[0]?.previewUrl;
        if (found) {
          res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
          return res.redirect(302, found);
        }
      }
    } catch (err) {
      console.error('Stream lookup error:', err.message);
    }
  }

  // 3. Fallback: return 204 No Content with proper CORS (never 502 Bad Gateway)
  return res.status(204).end();
}
