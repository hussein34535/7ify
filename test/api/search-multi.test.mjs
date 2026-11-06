import test from 'node:test';
import assert from 'node:assert/strict';
import searchMultiHandler, {
  normalizeStr,
  cleanTitle,
  detectSpecialVersion,
  bigramSimilarity,
  computeMatchScore
} from '../../api/search-multi.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
    end() { return this; }
  };
  return res;
}

test('search-multi rejects non-GET methods with 405 Method Not Allowed', async () => {
  const req = { method: 'POST', query: { q: 'Tamally Maak' } };
  const res = createMockRes();
  await searchMultiHandler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.data?.error, 'method_not_allowed');
});

test('search-multi returns empty results when query is empty or missing', async () => {
  const req = { method: 'GET', query: { q: '   ' } };
  const res = createMockRes();
  await searchMultiHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.data?.ok, true);
  assert.deepEqual(res.data?.results, []);
});

test('normalizeStr strips Arabic diacritics and unifies alef forms', () => {
  assert.equal(normalizeStr('أَحْمَد'), 'احمد');
  assert.equal(normalizeStr('إبراهيم'), 'ابراهيم');
  assert.equal(normalizeStr('آية'), 'ايه');
  assert.equal(normalizeStr('مَغْرِبِيّ'), 'مغربي');
});

test('cleanTitle strips noise suffixes (Official Music Video, HD, 4K, Lyrics)', () => {
  const raw = 'Amr Diab - Tamally Maak (Official Music Video) [HD] 4K (Lyrics)';
  const cleaned = cleanTitle(raw);
  assert.ok(!cleaned.includes('official'));
  assert.ok(!cleaned.includes('music video'));
  assert.ok(!cleaned.includes('4k'));
  assert.ok(!cleaned.includes('lyrics'));
});

test('detectSpecialVersion identifies remix, live, cover, karaoke variants', () => {
  assert.equal(detectSpecialVersion('Song Name (Club Remix)').isRemix, true);
  assert.equal(detectSpecialVersion('Concert Live in Cairo 2020').isLive, true);
  assert.equal(detectSpecialVersion('Acoustic Cover by John').isCover, true);
  assert.equal(detectSpecialVersion('Track Instrumental Karaoke').isKaraoke, true);
  const plain = detectSpecialVersion('Tamally Maak Original Track');
  assert.equal(plain.isRemix, false);
  assert.equal(plain.isLive, false);
});

test('computeMatchScore awards high score to matching track and penalizes version mismatch', () => {
  const target = {
    title: 'تملي معاك',
    artist: 'عمرو دياب',
    duration: 270
  };

  // High match
  const candidateExact = {
    title: 'عمرو دياب - تملي معاك',
    channelTitle: 'Amr Diab Official',
    duration: 271
  };
  const exactScore = computeMatchScore(target, candidateExact);
  assert.ok(exactScore > 0.7, `Expected score > 0.7, got ${exactScore}`);

  // Variant mismatch (remix should be heavily penalized)
  const candidateRemix = {
    title: 'تملي معاك (DJ Snake Remix 2024)',
    channelTitle: 'EDM Party',
    duration: 210
  };
  const remixScore = computeMatchScore(target, candidateRemix);
  assert.ok(remixScore < 0.45, `Expected score < 0.45, got ${remixScore}`);
  assert.ok(exactScore > remixScore, 'Exact match score must exceed remix match score');
});

test('search-multi returns multi-source aggregated tracks with providers and playback modes', async () => {
  const req = { method: 'GET', query: { q: 'Amr Diab', limit: '3' } };
  const res = createMockRes();
  await searchMultiHandler(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(Array.isArray(res.data?.results));
  assert.ok(res.data.results.length > 0);

  const firstTrack = res.data.results[0];
  assert.ok(firstTrack.id, 'Track must have an id');
  assert.ok(firstTrack.title, 'Track must have a title');
  assert.ok(Array.isArray(firstTrack.sources), 'Track must have a sources array');
  assert.ok(firstTrack.sources.length >= 1, 'Track must have at least one source');

  // Verify sources structure
  const validProviders = ['youtube', 'apple', 'apple-preview', 'jamendo', 'archive', 'spotify'];
  const validModes = ['FULL', 'OFFICIAL_EMBED', 'PREVIEW', 'METADATA_ONLY', 'UNAVAILABLE', 'full', 'embed', 'preview'];

  for (const s of firstTrack.sources) {
    assert.ok(validProviders.includes(s.provider), `Unexpected provider: ${s.provider}`);
    assert.ok(validModes.includes(s.playbackMode || s.mode), `Unexpected mode: ${s.playbackMode || s.mode}`);
    assert.ok(typeof s.duration === 'number' && s.duration > 0);
  }

  // Active source must be defined
  assert.ok(firstTrack.activeSource || firstTrack.playbackProvider);
});
