import test from 'node:test';
import assert from 'node:assert/strict';
import { parseYear } from '../../api/search.js';
import { loadAppInstance } from '../helpers/load-app.mjs';

const { NG } = loadAppInstance();
const { formatDuration, formatPosition } = NG;

test('formatDuration formats valid durations correctly from actual runtime', () => {
  assert.equal(formatDuration(260), '4:20');
  assert.equal(formatDuration(30), '0:30');
  assert.equal(formatDuration(65), '1:05');
});

test('formatDuration returns --:-- for null, undefined, or missing durations without fake 180s', () => {
  assert.equal(formatDuration(null), '--:--');
  assert.equal(formatDuration(undefined), '--:--');
  assert.equal(formatDuration(0), '--:--');
  assert.equal(formatDuration(-10), '--:--');
});

test('formatPosition safely formats position 0 as 0:00', () => {
  assert.equal(formatPosition(0), '0:00');
  assert.equal(formatPosition(15.4), '0:15');
});

test('parseYear exported from api/search.js returns integer year or null without fake 2024 fallback', () => {
  assert.equal(parseYear('2000-08-01T07:00:00Z'), 2000);
  assert.equal(parseYear('1996'), 1996);
  assert.equal(parseYear(null), null);
  assert.equal(parseYear(''), null);
  assert.equal(parseYear('invalid-date'), null);
  assert.equal(parseYear('1840'), null); // too early
});

test('getAlbums and getArtistAlbums from runtime NG return null for missing years without fake 2024 fallback', () => {
  const { NG: instanceNG, TRACKS } = loadAppInstance();
  TRACKS.push({
    id: 'test-track-no-year',
    title: { ar: 'أغنية بدون سنة', en: 'Song No Year' },
    artist: { ar: 'فنان تجريبي', en: 'Test Artist' },
    album: { ar: 'ألبوم بدون سنة', en: 'Album No Year' },
    year: null,
    duration: 120
  });
  const albums = instanceNG.getAlbums();
  const testAlb = albums.find(a => a.name?.ar === 'ألبوم بدون سنة');
  assert.ok(testAlb, 'Album should be grouped');
  assert.equal(testAlb.year, null, 'Album year should be null, not 2024');

  const artistAlbums = instanceNG.getArtistAlbums('فنان تجريبي');
  const testArtistAlb = artistAlbums.find(a => a.name?.ar === 'ألبوم بدون سنة');
  assert.ok(testArtistAlb, 'Artist album should be found');
  assert.equal(testArtistAlb.year, null, 'Artist album year should be null, not 2024');
});
