export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { id, appleId } = req.query || {};
  const rawId = String(appleId || id || '').trim();

  // Only permit strict numeric Apple Track IDs (e.g. 1440857781)
  if (rawId && /^\d{1,18}$/.test(rawId)) {
    try {
      const itunesUrl = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(rawId);
      const r = await fetch(itunesUrl, {
        headers: { 'User-Agent': '7ify (https://7ify.vercel.app)' },
        signal: AbortSignal.timeout(4500)
      });
      if (r.ok) {
        const data = await r.json();
        const item = data.results && data.results[0];
        if (item && item.trackId === Number(rawId) && typeof item.previewUrl === 'string') {
          const parsed = new URL(item.previewUrl);
          // Strict allowlist for verified Apple Music audio CDN hostnames
          const isAppleHost = parsed.protocol === 'https:' && (
            parsed.hostname === 'audio-ssl.itunes.apple.com' ||
            parsed.hostname.endsWith('.mzstatic.com') ||
            parsed.hostname.endsWith('.apple.com')
          );
          if (isAppleHost) {
            res.setHeader('Cache-Control', 'public, s-maxage=86400, max-age=86400');
            return res.redirect(302, item.previewUrl);
          }
        }
      }
    } catch (err) {
      console.error('Apple stream lookup error:', err.message);
    }
  }

  // No arbitrary redirects. Return honest 404 when no authorized stream is configured.
  return res.status(404).json({
    error: 'authorized_stream_unavailable',
    message: 'No authorized full-track source is configured.'
  });
}
