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

  const { q } = req.query || {};
  const query = String(Array.isArray(q) ? q[0] : (q || '')).trim();

  if (!query || query.length > 120) {
    return res.status(400).json({ error: 'invalid_query' });
  }

  try {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!r.ok) {
      return res.status(502).json({ error: 'upstream_unavailable' });
    }

    const html = await r.text();
    const m = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/>var ytInitialData = ({.*?});</s);
    if (!m) return res.status(404).json({ error: 'not_found' });

    const data = JSON.parse(m[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    if (!Array.isArray(contents)) return res.status(404).json({ error: 'not_found' });

    for (const item of contents) {
      const v = item.videoRenderer;
      if (v && v.videoId) {
        res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
        return res.status(200).json({
          videoId: v.videoId,
          title: v.title?.runs?.[0]?.text || '',
          duration: v.lengthText?.simpleText || ''
        });
      }
    }
  } catch (err) {
    console.error('YouTube search error:', err.message);
    return res.status(502).json({ error: 'upstream_unavailable' });
  }

  return res.status(404).json({ error: 'not_found' });
}
