import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

test('preserves empty playlists array without falling back to seed playlists in actual runtime loadState', () => {
  const customSaved = {
    lang: 'ar',
    playlists: []
  };
  const { state } = loadAppInstance({
    'nagham.studio.v2': JSON.stringify(customSaved)
  });
  assert.equal(state.playlists.length, 0);
  assert.deepEqual(state.playlists, []);
});

test('cleans up temporary local blob IDs from stored favorites, queue, and playlists', () => {
  const { NG } = loadAppInstance();
  const dirty = ['t1', 'local-blob-123', 't2', 'file-abc', 't3'];
  const cleaned = NG.cleanSavedIds(dirty);
  assert.deepEqual(cleaned, ['t1', 't2', 't3']);
});

test('persists and restores dynamic online search tracks across browser restarts', () => {
  // Step 1: User runs a search, receives an online track, and likes it
  const { NG, state, TRACKS, localStorage } = loadAppInstance();
  const onlineTrack = {
    id: 'sp-999888',
    appleId: 999888,
    title: { ar: 'أغنية أونلاين', en: 'Online Song' },
    artist: { ar: 'فنان أونلاين', en: 'Online Artist' },
    album: { ar: 'ألبوم أونلاين', en: 'Online Album' },
    art: 'https://example.com/art.jpg',
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 210,
    year: 2021,
    source: 'online'
  };

  TRACKS.push(onlineTrack);
  state.favorites.push(onlineTrack.id);
  state.playlists.push({
    id: 'p-user-1',
    name: { ar: 'قائمتي المفضلة', en: 'My Favorite List' },
    sub: { ar: '', en: '' },
    colors: ['#1B0B10', '#6B2430', '#E8A0A8'],
    motif: 'rings',
    trackIds: [onlineTrack.id]
  });

  // Save state
  NG.save();

  const savedRaw = localStorage.getItem('nagham.studio.v2');
  assert.ok(savedRaw, 'State must be serialized to localStorage');
  const parsed = JSON.parse(savedRaw);
  assert.ok(Array.isArray(parsed.savedTracks), 'savedTracks array must be persisted');
  assert.equal(parsed.savedTracks.length, 1);
  assert.equal(parsed.savedTracks[0].id, 'sp-999888');

  // Step 2: New browser session opens with the saved localStorage
  const newSession = loadAppInstance({
    'nagham.studio.v2': savedRaw
  });

  // In the new session, getTrack('sp-999888') must find the rehydrated online track!
  const rehydrated = newSession.NG.getTrack('sp-999888');
  assert.ok(rehydrated, 'Online track must be restored into TRACKS and findable via getTrack()');
  assert.equal(rehydrated.title.ar, 'أغنية أونلاين');
  assert.equal(rehydrated.artist.ar, 'فنان أونلاين');
  assert.equal(rehydrated.preview, 'https://audio-ssl.itunes.apple.com/preview.m4a');
  assert.equal(rehydrated.year, 2021);

  // Favorites and playlists must reference and resolve the track seamlessly
  assert.ok(newSession.state.favorites.includes('sp-999888'));
  const userPl = newSession.state.playlists.find(p => p.id === 'p-user-1');
  assert.ok(userPl);
  assert.deepEqual(userPl.trackIds, ['sp-999888']);
});
