import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

const { NG } = loadAppInstance();
const { searchTracks, searchArtists, searchAlbums, scoreTrack } = NG;

test('1. Local Scoring: exact title match yields highest score and ranks first', () => {
  const results = searchTracks('تملي معاك');
  assert.ok(results.length > 0, 'Should find tracks');
  assert.equal(results[0].title.ar, 'تملي معاك', 'Exact title must be the top result');
});

test('2. Local Scoring: partial Arabic artist prefix ("عمرو دي") matches Amr Diab tracks', () => {
  const results = searchTracks('عمرو دي');
  assert.ok(results.length >= 2, 'Should match multiple Amr Diab tracks');
  for (const tr of results.slice(0, 2)) {
    assert.equal(tr.artist.ar, 'عمرو دياب');
  }
});

test('3. Local Scoring: partial title prefix ("tamally") matches "Tamally Maak"', () => {
  const results = searchTracks('tamally');
  assert.ok(results.length > 0);
  assert.equal(results[0].title.en, 'Tamally Maak');
});

test('4. Local Scoring: partial title substring ("maak") matches tracks containing "maak"', () => {
  const results = searchTracks('maak');
  assert.ok(results.length > 0);
  assert.ok(
    results.some(r => r.title.en.toLowerCase().includes('maak') || r.title.ar.includes('معاك'))
  );
});

test('5. Local Scoring: multi-token query in different language / mixed ("ويجز الب")', () => {
  const results = searchTracks('ويجز الب');
  assert.ok(results.length > 0);
  const first = results[0];
  assert.ok(
    first.artist.ar.includes('ويجز') || first.title.ar.includes('البخت'),
    'Expected Wegz / El Bakht match'
  );
});

test('6. Local Scoring: English prefix query ("blinding li") matches The Weeknd track', () => {
  const results = searchTracks('blinding li');
  assert.ok(results.length > 0);
  assert.equal(results[0].title.en, 'Blinding Lights');
});

test('7. Local Scoring: typo tolerance matches misspelled candidate below exact matches', () => {
  const typoResults = searchTracks('tamali');
  assert.ok(typoResults.length > 0, 'Typo query "tamali" should match "Tamally Maak"');
  assert.equal(typoResults[0].title.en, 'Tamally Maak');

  const exactScore = scoreTrack(typoResults[0], 'tamally');
  const typoScore = scoreTrack(typoResults[0], 'tamali');
  assert.ok(exactScore > typoScore, 'Exact match score must exceed typo match score');
});

test('8. Local Scoring: short query (<= 2 chars) bounds: "ب" only matches prefix, not random weak matches', () => {
  const results = searchTracks('ب');
  assert.ok(results.length > 0);
  for (const tr of results) {
    const titleAr = tr.title.ar || '';
    const artistAr = tr.artist.ar || '';
    const words = (titleAr + ' ' + artistAr).split(' ');
    const hasPrefix = words.some(w => w.startsWith('ب') || (w.startsWith('ال') && w.slice(2).startsWith('ب')));
    assert.ok(hasPrefix, `Track ${tr.id} should have a word starting with prefix "ب"`);
  }
});

test('9. Local Scoring: phrase from lyrics flags matched lyric snippet', () => {
  const results = searchTracks('في قلبي هواك');
  const found = results.find(tr => tr._matchedLyric && tr._matchedLyric.includes('في قلبي هواك'));
  assert.ok(found, 'Should find track and annotate with _matchedLyric snippet');
});

test('10. Local Scoring: searchArtists and searchAlbums return relevant entity matches', () => {
  const artists = searchArtists('عمرو');
  assert.ok(artists.length > 0);
  assert.equal(artists[0].name.ar, 'عمرو دياب');

  const albums = searchAlbums('تملي');
  assert.ok(albums.length > 0);
  assert.equal(albums[0].name.ar, 'تملي معاك');
});
