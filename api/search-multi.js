/**
 * 7ify / NAGHAM STUDIO — Multi-Source Music Search API
 * Orchestrates parallel queries across Apple Music, YouTube, Jamendo, and Internet Archive.
 * Normalizes, scores, deduplicates, and aggregates multiple playback sources into unified tracks.
 */

// Simple in-memory TTL cache for serverless environment
const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export function normalizeStr(str) {
  if (!str) return '';
  return String(str)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s\-_.,/\\()[\]{}:;!?'"`~+*#@&^%$]+/g, ' ')
    .trim();
}

export function cleanTitle(raw) {
  if (!raw) return '';
  return String(raw)
    .replace(/[\(\[\{](?:official\s*(?:music\s*)?video|video\s*clip|official\s*audio|lyrics|lyric\s*video|audio|hd|4k|hq|visualizer)[\)\]\}]/gi, '')
    .replace(/(?:official\s*(?:music\s*)?video|video\s*clip|official\s*audio|lyric\s*video)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function detectSpecialVersion(text) {
  const norm = normalizeStr(text);
  const isRemix = /\b(remix|rmx|club mix|extended)\b/i.test(norm);
  const isLive = /\b(live|حفلة|حفله|مباشر|concert)\b/i.test(norm);
  const isCover = /\b(cover|كفر|بصوت)\b/i.test(norm);
  const isKaraoke = /\b(karaoke|instrumental|موسيقى فقط)\b/i.test(norm);
  return { isRemix, isLive, isCover, isKaraoke };
}

export function bigramSimilarity(str1, str2) {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 1;
  if (str1.length < 2 || str2.length < 2) return str1 === str2 ? 1 : 0;
  const bigrams1 = new Map();
  for (let i = 0; i < str1.length - 1; i++) {
    const bg = str1.substr(i, 2);
    bigrams1.set(bg, (bigrams1.get(bg) || 0) + 1);
  }
  let intersection = 0;
  for (let i = 0; i < str2.length - 1; i++) {
    const bg = str2.substr(i, 2);
    const count = bigrams1.get(bg) || 0;
    if (count > 0) {
      bigrams1.set(bg, count - 1);
      intersection++;
    }
  }
  return (2.0 * intersection) / ((str1.length - 1) + (str2.length - 1));
}

export function computeMatchScore(target, candidate) {
  if (!target || !candidate) return 0;

  const targetTitle = normalizeStr(cleanTitle(target.title?.ar || target.title?.en || target.title || ''));
  const candTitle = normalizeStr(cleanTitle(candidate.title?.ar || candidate.title?.en || candidate.title || ''));

  const targetArtist = normalizeStr(target.artist?.ar || target.artist?.en || target.artist || '');
  const candArtist = normalizeStr(candidate.artist?.ar || candidate.artist?.en || candidate.channelTitle || candidate.artist || '');

  // Word overlap token similarity for title
  const tWords = new Set(targetTitle.split(' ').filter(w => w.length > 1));
  const cWords = new Set(candTitle.split(' ').filter(w => w.length > 1));
  let tokenTitleScore = 0;
  if (tWords.size > 0 && cWords.size > 0) {
    let intersect = 0;
    for (const w of tWords) {
      if (cWords.has(w)) intersect++;
    }
    tokenTitleScore = intersect / Math.max(tWords.size, cWords.size);
  } else if (targetTitle && candTitle && (targetTitle.includes(candTitle) || candTitle.includes(targetTitle))) {
    tokenTitleScore = 0.8;
  }
  const bigramTitleScore = bigramSimilarity(targetTitle, candTitle);
  const titleScore = Math.max(tokenTitleScore, bigramTitleScore);

  // Word overlap token similarity for artist
  const taWords = new Set(targetArtist.split(' ').filter(w => w.length > 1));
  const caWords = new Set(candArtist.split(' ').filter(w => w.length > 1));
  let tokenArtistScore = 0;
  if (taWords.size > 0 && caWords.size > 0) {
    let intersect = 0;
    for (const w of taWords) {
      if (caWords.has(w)) intersect++;
    }
    tokenArtistScore = intersect / Math.max(taWords.size, caWords.size);
  } else if (targetArtist && candArtist && (targetArtist.includes(candArtist) || candArtist.includes(targetArtist))) {
    tokenArtistScore = 0.85;
  }
  const bigramArtistScore = bigramSimilarity(targetArtist, candArtist);
  let artistScore = Math.max(tokenArtistScore, bigramArtistScore);

  // Check if candidate title itself contains artist name (common on YouTube video titles)
  if (artistScore < 0.35 && targetArtist && candTitle.includes(targetArtist)) {
    artistScore = 0.80;
  }

  // Duration match (tolerance: up to 15 seconds)
  let durScore = 0.5;
  const tDur = Number(target.duration || target.fullDuration || 0);
  const cDur = Number(candidate.duration || candidate.durationSec || candidate.fullDuration || 0);
  if (tDur > 0 && cDur > 0) {
    const diff = Math.abs(tDur - cDur);
    if (diff <= 5) durScore = 1.0;
    else if (diff <= 15) durScore = 0.8;
    else if (diff <= 30) durScore = 0.4;
    else durScore = 0.1;
  }

  // Version penalties: penalize Live / Remix / Cover if base song is original
  const tVers = detectSpecialVersion(targetTitle);
  const cVers = detectSpecialVersion(candTitle);
  let penalty = 0;
  if (!tVers.isRemix && cVers.isRemix) penalty += 0.35;
  if (!tVers.isLive && cVers.isLive) penalty += 0.35;
  if (!tVers.isCover && cVers.isCover) penalty += 0.35;
  if (!tVers.isKaraoke && cVers.isKaraoke) penalty += 0.40;

  const total = (titleScore * 0.50) + (artistScore * 0.35) + (durScore * 0.15) - penalty;
  return Math.max(0, Math.min(1.0, total));
}

export function parseYear(releaseDate) {
  const releaseYear = releaseDate ? Number.parseInt(String(releaseDate).slice(0, 4), 10) : null;
  return Number.isInteger(releaseYear) && releaseYear >= 1900 && releaseYear <= (new Date().getFullYear() + 1)
    ? releaseYear
    : null;
}

export async function fetchAppleMusic(query, signal) {
  try {
    const url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(query) + '&media=music&entity=song&limit=25';
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept-Language': 'ar,en;q=0.9'
      },
      signal
    });
    if (!r.ok) return [];
    const data = await r.json();
    return Array.isArray(data.results) ? data.results : [];
  } catch (err) {
    return [];
  }
}

export async function fetchYouTube(query, signal) {
  // If YouTube Data API Key is configured in environment
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (apiKey) {
    try {
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&maxResults=8&q=${encodeURIComponent(query)}&key=${encodeURIComponent(apiKey)}`;
      const r = await fetch(url, { signal });
      if (r.ok) {
        const d = await r.json();
        return (d.items || []).map(it => ({
          videoId: it.id?.videoId,
          title: it.snippet?.title || '',
          channelTitle: it.snippet?.channelTitle || '',
          thumbnail: it.snippet?.thumbnails?.high?.url || it.snippet?.thumbnails?.default?.url || ''
        })).filter(x => Boolean(x.videoId));
      }
    } catch (e) {}
  }

  // Upstream YouTube search parser
  try {
    const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query + ' audio');
    const r = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal
    });
    if (!r.ok) return [];
    const html = await r.text();
    const m = html.match(/var ytInitialData = ({.*?});<\/script>/s) || html.match(/>var ytInitialData = ({.*?});</s);
    if (!m) return [];
    const data = JSON.parse(m[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;
    if (!Array.isArray(contents)) return [];

    const list = [];
    for (const item of contents) {
      const v = item.videoRenderer;
      if (v && v.videoId) {
        const durText = v.lengthText?.simpleText || '';
        let sec = 0;
        const parts = durText.split(':').map(Number);
        if (parts.length === 2) sec = (parts[0] * 60) + parts[1];
        else if (parts.length === 3) sec = (parts[0] * 3600) + (parts[1] * 60) + parts[2];

        list.push({
          videoId: v.videoId,
          title: v.title?.runs?.[0]?.text || '',
          channelTitle: v.ownerText?.runs?.[0]?.text || '',
          durationSec: sec,
          thumbnail: v.thumbnail?.thumbnails?.[0]?.url || ''
        });
        if (list.length >= 8) break;
      }
    }
    return list;
  } catch (err) {
    return [];
  }
}

export async function fetchJamendo(query, signal) {
  const clientId = process.env.JAMENDO_CLIENT_ID;
  if (!clientId) return [];
  try {
    const url = `https://api.jamendo.com/v3.0/tracks/?client_id=${encodeURIComponent(clientId)}&format=json&limit=10&namesearch=${encodeURIComponent(query)}&include=musicinfo&audioformat=mp32`;
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.results) ? d.results : [];
  } catch (e) {
    return [];
  }
}

export async function fetchArchive(query, signal) {
  try {
    const url = `https://archive.org/advancedsearch.php?q=mediatype:(audio)+AND+(${encodeURIComponent(query)})&fl[]=identifier,title,creator,album,year,length&rows=8&output=json`;
    const r = await fetch(url, { signal });
    if (!r.ok) return [];
    const d = await r.json();
    return Array.isArray(d.response?.docs) ? d.response.docs : [];
  } catch (e) {
    return [];
  }
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
    return res.status(400).json({ error: 'query_too_long', results: [] });
  }

  if (query.length < 2) {
    return res.status(200).json({ ok: true, results: [], artists: [], sourcesCount: {} });
  }

  const cacheKey = normalizeStr(query);
  const now = Date.now();
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (now - cached.timestamp < CACHE_TTL_MS) {
      res.setHeader('X-Cache', 'HIT');
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
      return res.status(200).json(cached.payload);
    }
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

  const timeoutSignal = AbortSignal.timeout(6500);

  // Parallel multi-source fetch with Promise.allSettled
  const [appleRes, ytRes, jamRes, archRes] = await Promise.allSettled([
    fetchAppleMusic(query, timeoutSignal),
    fetchYouTube(query, timeoutSignal),
    fetchJamendo(query, timeoutSignal),
    fetchArchive(query, timeoutSignal)
  ]);

  const rawApple = appleRes.status === 'fulfilled' ? appleRes.value : [];
  const rawYouTube = ytRes.status === 'fulfilled' ? ytRes.value : [];
  const rawJamendo = jamRes.status === 'fulfilled' ? jamRes.value : [];
  const rawArchive = archRes.status === 'fulfilled' ? archRes.value : [];

  const sourcesCount = {
    apple: rawApple.length,
    youtube: rawYouTube.length,
    jamendo: rawJamendo.length,
    archive: rawArchive.length
  };

  const results = [];
  const artistMap = new Map();
  const matchedYtIndices = new Set();

  // 1. Process Apple Music results as primary high-fidelity metadata tracks
  rawApple.forEach((item, idx) => {
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

    const availableSources = [];

    // Check for YouTube match for this song
    let bestYt = null;
    let bestYtScore = 0;
    let bestYtIdx = -1;

    rawYouTube.forEach((y, yIdx) => {
      const score = computeMatchScore(
        { title: item.trackName, artist: artistName, duration: fullDuration },
        { title: y.title, artist: y.channelTitle, duration: y.durationSec }
      );
      if (score > bestYtScore && score >= 0.50) {
        bestYtScore = score;
        bestYt = y;
        bestYtIdx = yIdx;
      }
    });

    if (bestYt && bestYt.videoId) {
      matchedYtIndices.add(bestYtIdx);
      availableSources.push({
        provider: 'youtube',
        providerName: 'YouTube',
        label: 'YouTube (مشغل رسمي)',
        playbackMode: 'OFFICIAL_EMBED',
        isFullTrack: true,
        duration: fullDuration || bestYt.durationSec || 210,
        videoId: bestYt.videoId,
        title: bestYt.title,
        confidence: Number(bestYtScore.toFixed(2))
      });
    }

    // Add Apple Music preview source if previewUrl exists
    if (item.previewUrl) {
      availableSources.push({
        provider: 'apple-preview',
        providerName: 'Apple Music',
        label: 'معاينة ٣٠ ثانية (Apple Music)',
        playbackMode: 'PREVIEW',
        isFullTrack: false,
        duration: 30,
        url: item.previewUrl,
        confidence: 1.0
      });
    }

    // Determine highest priority active source
    const primarySource = availableSources.find(s => s.playbackMode === 'FULL')
      || availableSources.find(s => s.playbackMode === 'OFFICIAL_EMBED')
      || availableSources.find(s => s.playbackMode === 'PREVIEW')
      || null;

    const activeMode = primarySource ? primarySource.playbackMode : 'UNAVAILABLE';
    const activeProvider = primarySource ? primarySource.provider : 'none';
    const isFull = primarySource ? primarySource.isFullTrack : false;
    const playDur = isFull ? (fullDuration || 0) : (item.previewUrl ? 30 : 0);

    results.push({
      id,
      appleId: item.trackId,
      title: { ar: item.trackName || query, en: item.trackName || query },
      artist: { ar: artistName, en: artistName },
      album: { ar: item.collectionName || item.trackName || 'ألبوم', en: item.collectionName || item.trackName || 'Single' },
      art: artHiRes,
      preview: item.previewUrl || '',
      duration: fullDuration,
      fullDuration,
      catalogDuration: fullDuration,
      previewDuration: item.previewUrl ? 30 : null,
      playableDuration: playDur,
      playbackType: isFull ? 'full' : (item.previewUrl ? 'preview' : 'unavailable'),
      playbackMode: activeMode,
      playbackProvider: activeProvider,
      isAudioPreview: !isFull && Boolean(item.previewUrl),
      isFullTrack: isFull,
      isPreview: !isFull && Boolean(item.previewUrl),
      availability: isFull ? 'available' : (item.previewUrl ? 'preview_only' : 'unavailable'),
      activeSource: activeProvider,
      sources: availableSources,
      youtubeVideoId: primarySource?.videoId || bestYt?.videoId || null,
      year,
      genre: (item.primaryGenreName || 'arabic').toLowerCase(),
      colors: palette,
      motif,
      source: 'multi-source'
    });
  });

  // 2. Add remaining high-quality YouTube tracks that weren't merged
  rawYouTube.forEach((y, idx) => {
    if (matchedYtIndices.has(idx)) return;
    const id = 'yt-' + y.videoId;
    const palette = palettes[(results.length + idx) % palettes.length];
    const dur = y.durationSec || 210;

    results.push({
      id,
      title: { ar: cleanTitle(y.title), en: cleanTitle(y.title) },
      artist: { ar: y.channelTitle || 'YouTube Artist', en: y.channelTitle || 'YouTube Artist' },
      album: { ar: 'YouTube Music', en: 'YouTube Music' },
      art: y.thumbnail || '',
      preview: '',
      duration: dur,
      fullDuration: dur,
      catalogDuration: dur,
      previewDuration: null,
      playableDuration: dur,
      playbackType: 'full',
      playbackMode: 'OFFICIAL_EMBED',
      playbackProvider: 'youtube',
      isAudioPreview: false,
      isFullTrack: true,
      isPreview: false,
      availability: 'available',
      activeSource: 'youtube',
      youtubeVideoId: y.videoId,
      sources: [
        {
          provider: 'youtube',
          providerName: 'YouTube',
          label: 'YouTube (مشغل رسمي)',
          playbackMode: 'OFFICIAL_EMBED',
          isFullTrack: true,
          duration: dur,
          videoId: y.videoId,
          title: y.title,
          confidence: 0.9
        }
      ],
      year: new Date().getFullYear(),
      genre: 'general',
      colors: palette,
      motif: 'rings',
      source: 'youtube'
    });
  });

  // 3. Add Jamendo tracks if available
  rawJamendo.forEach((j, idx) => {
    const id = 'jam-' + j.id;
    const palette = palettes[(results.length + idx) % palettes.length];
    const dur = Number(j.duration) || 180;
    results.push({
      id,
      title: { ar: j.name, en: j.name },
      artist: { ar: j.artist_name, en: j.artist_name },
      album: { ar: j.album_name || 'Jamendo', en: j.album_name || 'Jamendo' },
      art: j.image || '',
      preview: '',
      url: j.audio,
      duration: dur,
      fullDuration: dur,
      catalogDuration: dur,
      previewDuration: null,
      playableDuration: dur,
      playbackType: 'full',
      playbackMode: 'FULL',
      playbackProvider: 'jamendo',
      isAudioPreview: false,
      isFullTrack: true,
      isPreview: false,
      availability: 'available',
      activeSource: 'jamendo',
      sources: [
        {
          provider: 'jamendo',
          providerName: 'Jamendo (Creative Commons)',
          label: 'Jamendo (تشغيل كامل مرخص)',
          playbackMode: 'FULL',
          isFullTrack: true,
          duration: dur,
          url: j.audio,
          license: j.license_ccurl || 'Creative Commons'
        }
      ],
      year: new Date().getFullYear(),
      genre: 'independent',
      colors: palette,
      motif: 'dots',
      source: 'jamendo'
    });
  });

  // 4. Add Archive.org tracks if available
  rawArchive.forEach((a, idx) => {
    if (!a.identifier) return;
    const id = 'arc-' + a.identifier.replace(/[^a-z0-9_-]/gi, '_').slice(0, 40);
    const palette = palettes[(results.length + idx) % palettes.length];
    const dur = Number(a.length) || 190;
    results.push({
      id,
      title: { ar: a.title || query, en: a.title || query },
      artist: { ar: a.creator || 'Internet Archive', en: a.creator || 'Internet Archive' },
      album: { ar: a.album || 'Archive Audio', en: a.album || 'Archive Audio' },
      art: `https://archive.org/services/img/${a.identifier}`,
      preview: '',
      url: `https://archive.org/download/${a.identifier}`,
      duration: dur,
      fullDuration: dur,
      catalogDuration: dur,
      previewDuration: null,
      playableDuration: dur,
      playbackType: 'full',
      playbackMode: 'FULL',
      playbackProvider: 'archive',
      isAudioPreview: false,
      isFullTrack: true,
      isPreview: false,
      availability: 'available',
      activeSource: 'archive',
      archiveIdentifier: a.identifier,
      sources: [
        {
          provider: 'archive',
          providerName: 'Internet Archive',
          label: 'أرشيف الإنترنت (تشغيل كامل)',
          playbackMode: 'FULL',
          isFullTrack: true,
          duration: dur,
          identifier: a.identifier
        }
      ],
      year: a.year ? Number(a.year) : null,
      genre: 'archive',
      colors: palette,
      motif: 'orb',
      source: 'archive'
    });
  });

  const artists = Array.from(artistMap.values()).slice(0, 8);
  const payload = { ok: true, results, artists, sourcesCount };

  // Store in cache
  cache.set(cacheKey, { timestamp: now, payload });

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
  return res.status(200).json(payload);
}
