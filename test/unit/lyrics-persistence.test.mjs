import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

test('1. online track fetches synced lyrics, persists to localStorage with _lyricsSynced=true', async () => {
  const syncedPayload = {
    synced: true,
    lines: [
      { t: 0, text: 'سطر أول متزامن' },
      { t: 14.5, text: 'سطر ثاني متزامن' }
    ]
  };

  const mockFetch = async (url) => ({
    ok: true,
    json: async () => syncedPayload
  });

  const { NG, TRACKS, localStorage } = loadAppInstance({}, { fetch: mockFetch });
  const track = {
    id: 'sp-synced-lyrics-1',
    appleId: 1001,
    title: { ar: 'أغنية متزامنة', en: 'Synced Song' },
    artist: { ar: 'فنان الكلمات', en: 'Lyrics Artist' },
    source: 'online',
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 180,
    previewDuration: 30
  };
  TRACKS.push(track);

  // Execute real runtime fetchLyricsOnline
  await new Promise((resolve) => {
    NG.fetchLyricsOnline(track, track.artist, (data) => resolve(data));
  });

  assert.equal(track._lyricsSynced, true);
  assert.equal(track.lyrics.length, 2);

  // Verify localStorage contains the savedTracks with this updated track
  const savedRaw = localStorage.getItem('nagham.studio.v2');
  assert.ok(savedRaw, 'localStorage must be updated automatically upon receiving lyrics');
  const saved = JSON.parse(savedRaw);
  assert.ok(Array.isArray(saved.savedTracks));
  const savedItem = saved.savedTracks.find(t => t.id === 'sp-synced-lyrics-1');
  assert.ok(savedItem, 'Track must be stored in savedTracks');
  assert.equal(savedItem._lyricsSynced, true);
  assert.deepEqual(savedItem.lyrics, syncedPayload.lines);
});

test('2. new app instance restores synced lyrics via getTrack(id)', () => {
  const savedData = {
    lang: 'ar',
    savedTracks: [
      {
        id: 'sp-synced-lyrics-1',
        title: { ar: 'أغنية متزامنة', en: 'Synced Song' },
        artist: { ar: 'فنان الكلمات', en: 'Lyrics Artist' },
        source: 'online',
        preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
        duration: 180,
        previewDuration: 30,
        _lyricsSynced: true,
        lyrics: [
          { t: 0, text: 'سطر أول متزامن' },
          { t: 14.5, text: 'سطر ثاني متزامن' }
        ]
      }
    ]
  };

  const newSession = loadAppInstance({
    'nagham.studio.v2': JSON.stringify(savedData)
  });

  const restored = newSession.NG.getTrack('sp-synced-lyrics-1');
  assert.ok(restored, 'getTrack must find the restored online track');
  assert.equal(restored._lyricsSynced, true);
  assert.equal(restored.lyrics.length, 2);
  assert.equal(restored.lyrics[1].text, 'سطر ثاني متزامن');
});

test('3. plain lyrics (t:null and plainLyrics) are fetched, persisted, and restored across sessions', async () => {
  const plainPayload = {
    synced: false,
    lines: [
      { t: null, text: 'نص عادي بدون توقيت' },
      { t: null, text: 'سطر نصي إضافي' }
    ],
    plain: 'نص عادي بدون توقيت\nسطر نصي إضافي'
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => plainPayload
  });

  const { NG, TRACKS, localStorage } = loadAppInstance({}, { fetch: mockFetch });
  const track = {
    id: 'sp-plain-lyrics-test',
    appleId: 1002,
    title: { ar: 'أغنية نصية', en: 'Plain Song' },
    artist: { ar: 'كاتب الأغنية', en: 'Writer' },
    source: 'online',
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 200,
    previewDuration: 30
  };
  TRACKS.push(track);

  await new Promise((resolve) => {
    NG.fetchLyricsOnline(track, track.artist, (data) => resolve(data));
  });

  assert.equal(track._lyricsSynced, false);
  assert.equal(track.plainLyrics, plainPayload.plain);
  assert.equal(track.lyrics.length, 2);

  const savedRaw = localStorage.getItem('nagham.studio.v2');
  assert.ok(savedRaw);
  const saved = JSON.parse(savedRaw);
  const savedTrack = saved.savedTracks.find(t => t.id === 'sp-plain-lyrics-test');
  assert.ok(savedTrack);
  assert.equal(savedTrack.plainLyrics, plainPayload.plain);
  assert.equal(savedTrack._lyricsSynced, false);

  // Restore in next session
  const restoredSession = loadAppInstance({
    'nagham.studio.v2': savedRaw
  });
  const restoredTrack = restoredSession.NG.getTrack('sp-plain-lyrics-test');
  assert.ok(restoredTrack);
  assert.equal(restoredTrack.plainLyrics, plainPayload.plain);
  assert.equal(restoredTrack._lyricsSynced, false);
});

test('4. empty lyrics and failed network requests do not corrupt existing saved lyrics', async () => {
  let shouldFail = false;
  let returnEmpty = false;

  const mockFetch = async () => {
    if (shouldFail) throw new Error('Simulated network disconnect');
    if (returnEmpty) return { ok: true, json: async () => ({ synced: false, lines: [], plain: '' }) };
    return { ok: true, json: async () => ({ synced: true, lines: [{ t: 0, text: 'أصلي' }] }) };
  };

  const { NG, TRACKS, localStorage } = loadAppInstance({}, { fetch: mockFetch });
  const track = {
    id: 'sp-protected-lyrics',
    title: { ar: 'أغنية محمية', en: 'Protected Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    source: 'online',
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 180,
    previewDuration: 30
  };
  TRACKS.push(track);

  // 1. Fetch valid lyrics
  await new Promise((resolve) => NG.fetchLyricsOnline(track, track.artist, resolve));
  assert.equal(track.lyrics.length, 1);
  assert.equal(track.lyrics[0].text, 'أصلي');

  const baselineStorage = localStorage.getItem('nagham.studio.v2');

  // 2. Network failure occurs
  shouldFail = true;
  await new Promise((resolve) => NG.fetchLyricsOnline(track, track.artist, resolve));
  assert.equal(track.lyrics.length, 1, 'Lyrics must NOT be erased on network failure');
  assert.equal(track.lyrics[0].text, 'أصلي');

  // 3. Empty API response occurs
  shouldFail = false;
  returnEmpty = true;
  await new Promise((resolve) => NG.fetchLyricsOnline(track, track.artist, resolve));
  assert.equal(track.lyrics.length, 1, 'Lyrics must NOT be erased on empty response');
  assert.equal(track.lyrics[0].text, 'أصلي');
});

test('5. local file tracks are never fetched or serialized into savedTracks', async () => {
  let fetchCalled = false;
  const mockFetch = async () => {
    fetchCalled = true;
    return { ok: true, json: async () => ({ synced: true, lines: [{ t: 0, text: 'ممنوع' }] }) };
  };

  const { NG, TRACKS, localStorage } = loadAppInstance({}, { fetch: mockFetch });
  const localTrack = {
    id: 'local-audio-file-123',
    title: { ar: 'ملف محلي', en: 'Local' },
    artist: { ar: 'أنا', en: 'Me' },
    url: 'blob:http://localhost/abc-123',
    source: 'file',
    duration: 150
  };
  TRACKS.push(localTrack);

  await new Promise((resolve) => NG.fetchLyricsOnline(localTrack, localTrack.artist, resolve));

  assert.equal(fetchCalled, false, 'fetch must not be called for local files');
  assert.equal(localTrack.lyrics, undefined);

  NG.save();
  const raw = localStorage.getItem('nagham.studio.v2');
  if (raw) {
    const saved = JSON.parse(raw);
    if (saved.savedTracks) {
      assert.equal(saved.savedTracks.some(t => t.id === 'local-audio-file-123'), false);
    }
  }
});

test('6. re-fetching identical lyrics does not trigger redundant localStorage writes (change-detection guard)', async () => {
  const payload = {
    synced: true,
    lines: [{ t: 0, text: 'كلمات ثابتة' }]
  };

  const mockFetch = async () => ({
    ok: true,
    json: async () => payload
  });

  const { NG, TRACKS, localStorage } = loadAppInstance({}, { fetch: mockFetch });
  const track = {
    id: 'sp-identical-lyrics-test',
    title: { ar: 'أغنية مكررة', en: 'Identical Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    source: 'online',
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 180,
    previewDuration: 30
  };
  TRACKS.push(track);

  // First fetch: should write to localStorage
  let setItemCalls = 0;
  const origSetItem = localStorage.setItem;
  localStorage.setItem = function (k, v) {
    setItemCalls++;
    origSetItem.call(localStorage, k, v);
  };

  await new Promise((resolve) => NG.fetchLyricsOnline(track, track.artist, resolve));
  assert.equal(setItemCalls, 1, 'First fetch should write once to localStorage');

  // Second fetch with identical lyrics: change detection guard must prevent writing to localStorage
  await new Promise((resolve) => NG.fetchLyricsOnline(track, track.artist, resolve));
  assert.equal(setItemCalls, 1, 'Identical lyrics must NOT trigger redundant write to localStorage');
});
