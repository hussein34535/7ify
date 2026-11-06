/**
 * Safe Music Provider Matching API
 * Intelligently matches an Apple Music catalog track with an authorized playback provider
 * (e.g. Spotify, Audius, Jamendo) with strict title, artist, and duration checks.
 */

// Normalizes Arabic text (removes tashkeel, standardizes alef, yaa, taa marbuta)
export function normalizeArabic(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/[\u064B-\u065F\u0670]/g, '') // remove diacritics
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

// Strips common catalog noise terms like (Remastered 2011), [Official Audio], etc.
export function sanitizeTitle(title) {
  if (!title || typeof title !== 'string') return '';
  return title
    .replace(/\s*[\(\[](official\s*(audio|video|music\s*video)|remastered|version|deluxe|bonus|single|album|studio\s*edition|hd|4k)[^\)\]]*[\)\]]/gi, '')
    .replace(/\s*[\(\[](feat\.|ft\.|featuring)[^\)\]]+[\)\]]/gi, '')
    .replace(/[\u2010-\u2015\-_–—]/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Computes word-token similarity between two strings
export function tokenOverlap(strA, strB) {
  if (!strA || !strB) return 0;
  const tokensA = new Set(strA.toLowerCase().split(/\s+/).filter(Boolean));
  const tokensB = new Set(strB.toLowerCase().split(/\s+/).filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let matches = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) matches++;
  }
  return matches / Math.max(tokensA.size, tokensB.size);
}

// Check if a title candidate has forbidden noise (e.g. remix, live, cover) not in the target
export function hasDisallowedVariant(targetTitle, candidateTitle) {
  const forbidden = ['remix', 'live', 'cover', 'karaoke', 'instrumental', 'acoustic', 'tribute'];
  const targetLower = (targetTitle || '').toLowerCase();
  const candLower = (candidateTitle || '').toLowerCase();
  for (const word of forbidden) {
    if (candLower.includes(word) && !targetLower.includes(word)) {
      return true;
    }
  }
  return false;
}

// Validates whether a candidate track is an exact match for the catalog track
export function evaluateCandidate(target, candidate) {
  if (!target || !candidate) return { isMatch: false, reason: 'missing_data' };

  // 1. Duration check: candidate must be within +/- 4 seconds of catalog duration
  if (target.duration && candidate.duration) {
    const diff = Math.abs(Number(target.duration) - Number(candidate.duration));
    if (diff > 4) {
      return { isMatch: false, reason: 'duration_mismatch', delta: diff };
    }
  }

  // 2. Disallowed variants check (remix, live, acoustic cover, etc.)
  if (hasDisallowedVariant(target.title, candidate.title)) {
    return { isMatch: false, reason: 'unwanted_variant' };
  }

  // 3. Title similarity
  const cleanTarget = normalizeArabic(sanitizeTitle(target.title));
  const cleanCand = normalizeArabic(sanitizeTitle(candidate.title));
  const titleSim = tokenOverlap(cleanTarget, cleanCand);
  if (titleSim < 0.6) {
    return { isMatch: false, reason: 'title_similarity_low', score: titleSim };
  }

  // 4. Artist similarity
  const cleanTargetArtist = normalizeArabic(sanitizeTitle(target.artist));
  const cleanCandArtist = normalizeArabic(sanitizeTitle(candidate.artist));
  const artistSim = tokenOverlap(cleanTargetArtist, cleanCandArtist);
  if (artistSim < 0.5 && !cleanCandArtist.includes(cleanTargetArtist) && !cleanTargetArtist.includes(cleanCandArtist)) {
    return { isMatch: false, reason: 'artist_similarity_low', score: artistSim };
  }

  return { isMatch: true, confidence: (titleSim + artistSim) / 2 };
}

let cachedClientToken = null;
let clientTokenExpiresAt = 0;

async function getSpotifyClientToken(clientId, clientSecret) {
  const now = Date.now();
  if (cachedClientToken && now < clientTokenExpiresAt - 60000) {
    return cachedClientToken;
  }
  try {
    const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return null;
    const d = await r.json();
    if (d.access_token) {
      cachedClientToken = d.access_token;
      clientTokenExpiresAt = now + ((d.expires_in || 3600) * 1000);
      return cachedClientToken;
    }
  } catch (err) {
    console.error('Failed to get Spotify client token:', err.message);
  }
  return null;
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

  const { title, artist, duration, provider = 'spotify' } = req.query || {};
  const trackTitle = String(Array.isArray(title) ? title[0] : (title || '')).trim();
  const artistName = String(Array.isArray(artist) ? artist[0] : (artist || '')).trim();
  const durSec = Number(Array.isArray(duration) ? duration[0] : duration) || null;

  if (!trackTitle) {
    return res.status(400).json({ error: 'invalid_title', message: 'Track title is required' });
  }
  if (trackTitle.length > 120 || artistName.length > 120) {
    return res.status(400).json({ error: 'query_too_long' });
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (provider === 'spotify' && clientId && clientSecret) {
    try {
      const token = await getSpotifyClientToken(clientId, clientSecret);
      if (token) {
        const cleanTitle = sanitizeTitle(trackTitle);
        const cleanArtist = sanitizeTitle(artistName);
        const q = `track:${cleanTitle} artist:${cleanArtist}`;
        const searchUrl = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=5`;
        const r = await fetch(searchUrl, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: AbortSignal.timeout(5000)
        });
        if (r.ok) {
          const data = await r.json();
          const items = data.tracks?.items || [];
          for (const item of items) {
            const candidate = {
              title: item.name,
              artist: item.artists?.[0]?.name || '',
              duration: Math.round((item.duration_ms || 0) / 1000),
              uri: item.uri,
              id: item.id
            };
            const evalResult = evaluateCandidate({ title: trackTitle, artist: artistName, duration: durSec }, candidate);
            if (evalResult.isMatch) {
              res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=604800');
              return res.status(200).json({
                ok: true,
                matched: true,
                provider: 'spotify',
                confidence: evalResult.confidence,
                track: {
                  uri: candidate.uri,
                  id: candidate.id,
                  title: candidate.title,
                  artist: candidate.artist,
                  duration: candidate.duration,
                  playbackType: 'full',
                  isFullTrack: true
                }
              });
            }
          }
        }
      }
    } catch (err) {
      console.error('Spotify catalog search error:', err.message);
    }
  }

  // When no server provider credentials exist, return honest unmatched status
  // allowing client-side PKCE or Apple Music preview fallback.
  res.setHeader('Cache-Control', 'public, s-maxage=3600');
  return res.status(200).json({
    ok: true,
    matched: false,
    provider,
    reason: (!clientId || !clientSecret) ? 'provider_credentials_not_configured' : 'no_confident_match',
    message: (!clientId || !clientSecret)
      ? 'Server credentials not set. Connect client-side or use 30s preview.'
      : 'No high-confidence track match found within duration tolerance.'
  });
}
