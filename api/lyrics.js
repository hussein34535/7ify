export function normalizeMusicText(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function parseLRC(lrc) {
  if (typeof lrc !== 'string' || lrc.length > 200000) return [];
  const rawLines = lrc.split(/\r?\n/);
  const result = [];
  const timeRegex = /\[(\d{1,3}):([0-5]\d(?:\.\d{1,3})?)\]/g;

  for (const line of rawLines) {
    const text = line
      .replace(timeRegex, '')
      .replace(/\[[a-z]{1,3}:[^\]]*\]/gi, '')
      .trim();
    if (!text) continue;

    timeRegex.lastIndex = 0;
    const matches = Array.from(line.matchAll(timeRegex));
    if (!matches.length) continue;

    for (const match of matches) {
      const min = Number(match[1]);
      const sec = Number(match[2]);
      const time = min * 60 + sec;
      if (!Number.isFinite(time) || time < 0) continue;
      result.push({
        t: Number(time.toFixed(3)),
        text
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

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET, OPTIONS');
    return res.status(405).json({ error: 'method_not_allowed' });
  }

  const { track, artist } = req.query || {};
  const trackName = String(Array.isArray(track) ? track[0] : (track || '')).trim();
  const artistName = String(Array.isArray(artist) ? artist[0] : (artist || '')).trim();

  if (!trackName || trackName.length > 160) {
    return res.status(400).json({ error: 'invalid_track_name', synced: false, lines: [] });
  }

  if (artistName.length > 120) {
    return res.status(400).json({ error: 'invalid_artist_name', synced: false, lines: [] });
  }

  const normTargetTrack = normalizeMusicText(trackName);
  const normTargetArtist = normalizeMusicText(artistName);

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
          return res.status(200).json({ ok: true, synced: true, lines, plain: null });
        }
      }
      if (d.plainLyrics) {
        const plainLines = d.plainLyrics.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(text => ({
          t: null,
          text
        }));
        res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
        return res.status(200).json({ ok: true, synced: false, lines: plainLines, plain: d.plainLyrics });
      }
    }

    // 2. Search fallback on LRCLIB with candidate validation
    const searchUrl = 'https://lrclib.net/api/search?q=' + encodeURIComponent(trackName + (artistName ? (' ' + artistName) : ''));
    const sr = await fetch(searchUrl, {
      headers: { 'User-Agent': '7ify (https://7ify.vercel.app)' },
      signal: AbortSignal.timeout(4500)
    });

    if (sr.ok) {
      const list = await sr.json();
      if (Array.isArray(list) && list.length) {
        // Filter candidates that match track name and artist name
        const matched = list.filter((cand) => {
          const cTrack = normalizeMusicText(cand.trackName);
          const cArtist = normalizeMusicText(cand.artistName);
          const trackMatches = cTrack.includes(normTargetTrack) || normTargetTrack.includes(cTrack);
          if (!normTargetArtist) return trackMatches;
          const artistMatches = cArtist.includes(normTargetArtist) || normTargetArtist.includes(cArtist);
          return trackMatches && artistMatches;
        });

        const candidate = matched.find(x => x.syncedLyrics) || matched[0];
        if (candidate) {
          if (candidate.syncedLyrics) {
            const lines = parseLRC(candidate.syncedLyrics);
            if (lines.length) {
              res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
              return res.status(200).json({ ok: true, synced: true, lines, plain: null });
            }
          }
          if (candidate.plainLyrics) {
            const plainLines = candidate.plainLyrics.split(/\r?\n/).map(s => s.trim()).filter(Boolean).map(text => ({
              t: null,
              text
            }));
            res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
            return res.status(200).json({ ok: true, synced: false, lines: plainLines, plain: candidate.plainLyrics });
          }
        }
      }
    }
  } catch (err) {
    console.error('Lyrics fetch error:', err.message);
    return res.status(502).json({ ok: false, error: 'upstream_unavailable', synced: false, lines: [] });
  }

  return res.status(200).json({ ok: true, synced: false, lines: [], plain: null });
}
