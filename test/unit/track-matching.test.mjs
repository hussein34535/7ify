import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCandidate, sanitizeTitle, normalizeArabic, hasDisallowedVariant } from '../../api/provider-match.js';

test('1. Normalizes Arabic text and sanitizes noise titles accurately', () => {
  const rawTitle = 'تملي معاك (Official Music Video) [Remastered]';
  const clean = sanitizeTitle(rawTitle);
  assert.equal(clean, 'تملي معاك');

  const arabicWithTashkeel = 'تَمَلِّي مَعَاكْ';
  const normalized = normalizeArabic(arabicWithTashkeel);
  assert.equal(normalized, 'تملي معاك');
});

test('2. Successful match: Exact title, artist, and duration within tolerance', () => {
  const target = {
    title: 'نور العين',
    artist: 'عمرو دياب',
    duration: 305
  };
  const candidate = {
    title: 'نور العين',
    artist: 'عمرو دياب',
    duration: 306
  };
  const res = evaluateCandidate(target, candidate);
  assert.equal(res.isMatch, true);
  assert.ok(res.confidence >= 0.8);
});

test('3. Rejects duration mismatch: difference greater than 4 seconds', () => {
  const target = {
    title: 'البخت',
    artist: 'ويجز',
    duration: 200
  };
  const candidate = {
    title: 'البخت',
    artist: 'ويجز',
    duration: 215 // 15 seconds difference (e.g. extended or live version)
  };
  const res = evaluateCandidate(target, candidate);
  assert.equal(res.isMatch, false);
  assert.equal(res.reason, 'duration_mismatch');
  assert.equal(res.delta, 15);
});

test('4. Rejects unwanted variants: Remix, Live, Cover, Karaoke', () => {
  const target = {
    title: 'تملي معاك',
    artist: 'عمرو دياب',
    duration: 260
  };
  const remixCand = {
    title: 'تملي معاك (DJ Remix)',
    artist: 'عمرو دياب',
    duration: 260
  };
  assert.equal(hasDisallowedVariant(target.title, remixCand.title), true);
  const res = evaluateCandidate(target, remixCand);
  assert.equal(res.isMatch, false);
  assert.equal(res.reason, 'unwanted_variant');
});

test('5. Rejects artist mismatch: different singer performing same title', () => {
  const target = {
    title: 'روما',
    artist: 'كايروكي',
    duration: 230
  };
  const wrongArtistCand = {
    title: 'روما',
    artist: 'فنان آخر تماماً',
    duration: 230
  };
  const res = evaluateCandidate(target, wrongArtistCand);
  assert.equal(res.isMatch, false);
  assert.equal(res.reason, 'artist_similarity_low');
});
