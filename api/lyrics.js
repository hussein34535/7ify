function parseLRC(lrc) {
  if (!lrc || typeof lrc !== 'string') return [];
  const rawLines = lrc.split('\n');
  const result = [];
  const timeRegex = /\[(\d{2}):(\d{2}(?:\.\d+)?)\]/g;

  for (const line of rawLines) {
    const text = line.replace(timeRegex, '').trim();
    if (!text) continue;
    let match;
    timeRegex.lastIndex = 0;
    while ((match = timeRegex.exec(line)) !== null) {
      const min = parseInt(match[1], 10);
      const sec = parseFloat(match[2]);
      result.push({
        t: +(min * 60 + sec).toFixed(2),
        text,
        ar: text,
        en: text
      });
    }
  }

  result.sort((a, b) => a.t - b.t);
  return result;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const { track, artist } = req.query || {};
  const trackName = String(track || '').trim();
  const artistName = String(artist || '').trim();

  if (!trackName) {
    return res.status(400).json({ error: 'missing_track_name', synced: false, lines: [] });
  }

  try {
    // 1. Direct match on LRCLIB
    const getUrl = 'https://lrclib.net/api/get?track_name=' + encodeURIComponent(trackName) +
      (artistName ? ('&artist_name=' + encodeURIComponent(artistName)) : '');

    const r = await fetch(getUrl, {
      headers: { 'User-Agent': '7ify (https://7ify.vercel.app)' },
      signal: AbortSignal.timeout(4500)
    });

    if (r.ok) {
      const d = await r.json();
      if (d.syncedLyrics) {
        const lines = parseLRC(d.syncedLyrics);
        if (lines.length) {
          res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
          return res.status(200).json({ synced: true, lines, plain: null });
        }
      }
      if (d.plainLyrics) {
        const plainLines = d.plainLyrics.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({
          t: null,
          text,
          ar: text,
          en: text
        }));
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ synced: false, lines: plainLines, plain: d.plainLyrics });
      }
    }

    // 2. Search fallback on LRCLIB
    const searchUrl = 'https://lrclib.net/api/search?q=' + encodeURIComponent(trackName + (artistName ? (' ' + artistName) : ''));
    const sr = await fetch(searchUrl, {
      headers: { 'User-Agent': '7ify (https://7ify.vercel.app)' },
      signal: AbortSignal.timeout(4500)
    });

    if (sr.ok) {
      const list = await sr.json();
      if (Array.isArray(list) && list.length) {
        const candidate = list.find(x => x.syncedLyrics) || list[0];
        if (candidate.syncedLyrics) {
          const lines = parseLRC(candidate.syncedLyrics);
          if (lines.length) {
            res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
            return res.status(200).json({ synced: true, lines, plain: null });
          }
        }
        if (candidate.plainLyrics) {
          const plainLines = candidate.plainLyrics.split('\n').map(s => s.trim()).filter(Boolean).map(text => ({
            t: null,
            text,
            ar: text,
            en: text
          }));
          res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
          return res.status(200).json({ synced: false, lines: plainLines, plain: candidate.plainLyrics });
        }
      }
    }
  } catch (err) {
    console.error('Lyrics fetch error:', err.message);
  }

  return res.status(200).json({ synced: false, lines: [] });
}
