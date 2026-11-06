export function parseYear(releaseDate) {
  const releaseYear = releaseDate ? Number.parseInt(String(releaseDate).slice(0, 4), 10) : null;
  return Number.isInteger(releaseYear) && releaseYear >= 1900 && releaseYear <= (new Date().getFullYear() + 1)
    ? releaseYear
    : null;
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

  const { q } = req.query || {};
  const query = String(Array.isArray(q) ? q[0] : (q || '')).trim();

  if (query.length > 120) {
    return res.status(400).json({ error: 'query_too_long', results: [], artists: [] });
  }

  if (query.length < 2) {
    return res.status(200).json({ results: [], artists: [] });
  }

  const palettes = [
    ['#1A0C06', '#7A3B12', '#F0A64B'],
    ['#1A0508', '#5C0E17', '#F26B6B'],
    ['#050B10', '#0F3446', '#58C7E8'],
    ['#0A1110', '#1C3A36', '#9AD7C8'],
    ['#0B0A14', '#2E2B4F', '#9B8BFF'],
    ['#14030A', '#6B0F2A', '#FF7A93'],
    ['#121008', '#5A4612', '#E8C55A'],
    ['#08120F', '#154A3B', '#4EE5B6']
  ];
  const motifs = ['rings', 'arcs', 'dots', 'orb'];

  try {
    const itunesUrl = 'https://itunes.apple.com/search?term=' + encodeURIComponent(query) + '&media=music&entity=song&limit=30';
    const r = await fetch(itunesUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ar,en;q=0.9'
      },
      signal: AbortSignal.timeout(5500)
    });

    if (!r.ok) {
      throw new Error('itunes_http_' + r.status);
    }

    const data = await r.json();
    const rawList = Array.isArray(data.results) ? data.results : [];

    const artistMap = new Map();
    const results = rawList.map((item, idx) => {
      const id = 'sp-' + (item.trackId || (Date.now() + '_' + idx));
      const artHiRes = item.artworkUrl100
        ? item.artworkUrl100.replace(/100x100bb\.(jpg|png|webp)/, '600x600bb.$1')
        : '';

      const durationMs = Number(item.trackTimeMillis);
      const fullDuration = Number.isFinite(durationMs) && durationMs > 0 ? Math.round(durationMs / 1000) : null;

      const year = parseYear(item.releaseDate);

      const palette = palettes[idx % palettes.length];
      const motif = motifs[idx % motifs.length];

      const artistName = item.artistName || 'فنان';
      if (!artistMap.has(artistName)) {
        artistMap.set(artistName, {
          name: { ar: artistName, en: artistName },
          sub: { ar: item.primaryGenreName || 'موسيقى', en: item.primaryGenreName || 'Music' },
          track: id,
          colors: palette,
          source: 'apple-music'
        });
      }

      return {
        id,
        appleId: item.trackId,
        title: { ar: item.trackName || query, en: item.trackName || query },
        artist: { ar: artistName, en: artistName },
        album: { ar: item.collectionName || item.trackName || 'ألبوم', en: item.collectionName || item.trackName || 'Single' },
        art: artHiRes,
        preview: item.previewUrl || '',
        duration: fullDuration,
        fullDuration,
        previewDuration: item.previewUrl ? 30 : null,
        playbackType: item.previewUrl ? 'preview' : 'unavailable',
        isAudioPreview: Boolean(item.previewUrl),
        year,
        genre: (item.primaryGenreName || 'arabic').toLowerCase(),
        colors: palette,
        motif,
        source: 'online'
      };
    });

    const artists = Array.from(artistMap.values()).slice(0, 8);

    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ ok: true, results, artists });
  } catch (err) {
    console.error('Online search API error:', err.message);
    return res.status(502).json({ ok: false, error: 'upstream_unavailable', results: [], artists: [] });
  }
}
