import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

function createMockSpotifySDK() {
  const listeners = new Map();
  class MockPlayer {
    constructor(opts) {
      this.name = opts.name;
      this.getOAuthToken = opts.getOAuthToken;
      this.volume = opts.volume;
      this._state = {
        position: 0,
        duration: 200000,
        paused: true
      };
      this._seekTarget = null;
    }
    addListener(event, cb) {
      if (!listeners.has(event)) listeners.set(event, []);
      listeners.get(event).push(cb);
    }
    removeListener(event, cb) {
      if (!listeners.has(event)) return;
      listeners.set(event, listeners.get(event).filter(f => f !== cb));
    }
    emit(event, data) {
      const cbs = listeners.get(event) || [];
      cbs.forEach(cb => cb(data));
    }
    connect() {
      return Promise.resolve(true);
    }
    disconnect() {
      return Promise.resolve(true);
    }
    getCurrentState() {
      return Promise.resolve(this._state);
    }
    pause() {
      this._state.paused = true;
      this.emit('player_state_changed', { ...this._state });
      return Promise.resolve();
    }
    resume() {
      this._state.paused = false;
      this.emit('player_state_changed', { ...this._state });
      return Promise.resolve();
    }
    seek(ms) {
      this._seekTarget = ms;
      this._state.position = ms;
      this.emit('player_state_changed', { ...this._state });
      return Promise.resolve();
    }
  }

  return {
    Player: MockPlayer,
    listeners
  };
}

test('1. Spotify URI وحده لا يسمح بتشغيل الأغنية دون مصادقة المستخدم', async () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;
  const providers = NG.providers;

  providers.setSpotifyAuth(null);
  assert.equal(providers.getProviderStatus().spotify.connected, false);

  const trackWithUri = {
    id: 'trk-unauth-uri',
    title: { ar: 'أغنية غير مصرح بها', en: 'Unauthorized Track' },
    artist: { ar: 'فنان', en: 'Artist' },
    spotifyUri: 'spotify:track:4cOdK2wGLETKBW3PvgPWqT',
    duration: 215,
    preview: null // No preview available
  };

  engine.load(trackWithUri);

  // Calling playSpotifyTrack directly must throw
  await assert.rejects(
    async () => { await NG.playSpotifyTrack(trackWithUri); },
    /spotify_not_authenticated/
  );

  let errorFired = false;
  NG.bus.addEventListener('error', (e) => {
    if (e.detail?.code === 'spotify_playback_failed' || e.detail?.code === 'unavailable') {
      errorFired = true;
    }
  });

  await engine.play();
  assert.equal(engine.playing, false, 'Playback must not start without authentication');
  assert.equal(engine.status !== 'playing', true);
});

test('2. Client Credentials لا يسمحان بتشغيل الأغنية', async () => {
  const mockFetch = async (url) => {
    if (url.includes('/api/provider-match')) {
      return {
        ok: true,
        json: async () => ({
          ok: true,
          matched: true,
          provider: 'spotify',
          track: {
            uri: 'spotify:track:cc123456789',
            id: 'cc123456789',
            title: 'Found Song',
            artist: 'Found Artist',
            duration: 200
          }
        })
      };
    }
    return { ok: false };
  };

  const { NG } = loadAppInstance({}, { fetch: mockFetch });
  NG.providers.setSpotifyAuth(null); // No user token

  const track = {
    id: 'trk-cc-only',
    title: { ar: 'تجربة بيانات فقط', en: 'Catalog Only Track' },
    artist: { ar: 'فنان', en: 'Artist' },
    duration: 200,
    preview: null
  };

  // resolvePlaybackSource without user login should be unavailable
  const resolved = await NG.resolvePlaybackSource(track);
  assert.equal(resolved.type, 'unavailable', 'Client credentials search must not yield full playback');

  await assert.rejects(
    async () => { await NG.playSpotifyTrack({ ...track, spotifyUri: 'spotify:track:cc123456789' }); },
    /spotify_not_authenticated/
  );
});

test('3. الحساب غير Premium لا يحصل على Full Playback', async () => {
  const { NG } = loadAppInstance();
  const providers = NG.providers;

  providers.setSpotifyAuth({
    accessToken: 'free-user-token',
    expiresAt: Date.now() + 3600000,
    user: {
      id: 'free_user_1',
      product: 'free',
      display_name: 'Free Tier User'
    }
  });

  const status = providers.getProviderStatus();
  assert.equal(status.spotify.connected, true);
  assert.equal(status.spotify.isPremium, false, 'Free user must not be marked isPremium');

  const track = {
    id: 'free-trk-1',
    title: { ar: 'أغنية كاملة', en: 'Full Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    spotifyUri: 'spotify:track:free123',
    preview: 'https://cdn.apple.com/preview.mp3',
    previewDuration: 30,
    duration: 180
  };

  const resolved = await NG.resolvePlaybackSource(track);
  assert.equal(resolved.type, 'preview', 'Free account must fall back to preview');
  assert.equal(resolved.isFullTrack, false);
});

test('4. عدم وجود SDK يمنع التشغيل الكامل', async () => {
  const { NG, context } = loadAppInstance();
  context.window.Spotify = undefined; // SDK not present

  NG.providers.setSpotifyAuth({
    accessToken: 'valid-token',
    expiresAt: Date.now() + 3600000,
    user: { id: 'prem_user', product: 'premium' }
  });

  const track = {
    id: 'trk-nosdk',
    spotifyUri: 'spotify:track:nosdk123',
    duration: 180
  };

  NG.engine._spotifyPlayer = null;
  NG.providers.spotify.deviceId = null;

  await assert.rejects(
    async () => { await NG.playSpotifyTrack(track); },
    /spotify_device_not_ready/
  );
});

test('5. عدم وجود Device ID يمنع التشغيل الكامل', async () => {
  const { NG, context } = loadAppInstance();
  const mockSDK = createMockSpotifySDK();
  context.window.Spotify = mockSDK;

  NG.providers.setSpotifyAuth({
    accessToken: 'valid-token',
    expiresAt: Date.now() + 3600000,
    user: { id: 'prem_user', product: 'premium' }
  });

  const player = new mockSDK.Player({ name: 'Test Player', getOAuthToken: (cb) => cb('valid-token') });
  NG.engine._spotifyPlayer = player;
  NG.providers.spotify.deviceId = null; // No device ID yet

  const track = {
    id: 'trk-nodevice',
    spotifyUri: 'spotify:track:nodevice123',
    duration: 190
  };

  await assert.rejects(
    async () => { await NG.playSpotifyTrack(track); },
    /spotify_device_not_ready/
  );
});

test('6. فشل Spotify يؤدي إلى Preview فقط إذا كانت متاحة', async () => {
  let playEndpointCalled = false;
  const mockFetch = async (url, opts) => {
    if (url.includes('/v1/me/player/play')) {
      playEndpointCalled = true;
      return {
        ok: false,
        status: 403,
        text: async () => 'User not registered in developer dashboard'
      };
    }
    return { ok: false, status: 404 };
  };

  const { NG, context } = loadAppInstance({}, { fetch: mockFetch });
  const mockSDK = createMockSpotifySDK();
  context.window.Spotify = mockSDK;

  NG.providers.setSpotifyAuth({
    accessToken: 'valid-token',
    expiresAt: Date.now() + 3600000,
    user: { id: 'prem_user', product: 'premium' }
  });
  NG.engine._spotifyPlayer = new mockSDK.Player({ name: 'Test' });
  NG.providers.spotify.deviceId = 'mock_device_123';

  // Track WITH preview: Should fall back to stream preview
  const trackWithPrev = {
    id: 'trk-fallback',
    title: { ar: 'معاينة بديلة', en: 'Fallback Track' },
    spotifyUri: 'spotify:track:fail123',
    preview: 'https://cdn.apple.com/fallback.mp3',
    previewDuration: 30,
    duration: 210
  };

  NG.engine.load(trackWithPrev);
  NG.engine.mode = 'spotify';

  await NG.engine.play();
  assert.equal(playEndpointCalled, true);
  assert.equal(NG.engine.mode, 'stream', 'Must fall back to stream mode when Spotify fails');
  assert.equal(NG.engine.url, 'https://cdn.apple.com/fallback.mp3');

  // Track WITHOUT preview: Should error
  const trackNoPrev = {
    id: 'trk-noprev',
    title: { ar: 'بدون معاينة', en: 'No Preview Track' },
    spotifyUri: 'spotify:track:fail456',
    preview: null,
    duration: 210
  };

  NG.engine.load(trackNoPrev);
  NG.engine.mode = 'spotify';

  let caughtError = null;
  NG.bus.addEventListener('error', (e) => { caughtError = e.detail; }, { once: true });

  await NG.engine.play();
  assert.equal(NG.engine.playing, false);
  assert.equal(NG.engine.status, 'error');
  assert.equal(caughtError?.code, 'spotify_playback_failed');
});

test('7. الأغنية غير المتاحة لا تظهر على أنها Playing', async () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const unavailableTrack = {
    id: 'trk-unavail',
    title: { ar: 'غير متاحة', en: 'Unavailable' },
    playbackType: 'unavailable',
    preview: null,
    url: null,
    spotifyUri: null
  };

  engine.load(unavailableTrack);
  assert.equal(engine.mode, 'unavailable');
  assert.equal(engine.status, 'unavailable');

  let errorEmitted = false;
  NG.bus.addEventListener('error', (e) => {
    if (e.detail?.code === 'unavailable') errorEmitted = true;
  });

  await engine.play();
  assert.equal(engine.playing, false, 'Unavailable track must never have playing=true');
  assert.equal(engine.status, 'unavailable');
  assert.equal(errorEmitted, true);
});

test('8. التقديم والتأخير يعملان مع Spotify Player', async () => {
  const { NG, context } = loadAppInstance();
  const mockSDK = createMockSpotifySDK();
  context.window.Spotify = mockSDK;

  const player = new mockSDK.Player({ name: 'Test' });
  NG.engine._spotifyPlayer = player;
  NG.engine.mode = 'spotify';
  NG.engine.track = {
    id: 'sp-seek-test',
    duration: 180,
    spotifyUri: 'spotify:track:seek123'
  };

  // Seek forward to 75 seconds
  NG.engine.seek(75);
  assert.equal(player._seekTarget, 75000, 'Seek forward must call player.seek with ms');
  assert.equal(NG.engine.getPosition(), 75);

  // Seek backward to 20 seconds
  NG.engine.seek(20);
  assert.equal(player._seekTarget, 20000, 'Seek backward must call player.seek with ms');
  assert.equal(NG.engine.getPosition(), 20);
});

test('9. تبديل الأغنية لا يسمح لطلب قديم بتشغيل أغنية خاطئة', async () => {
  const pendingResolves = [];
  const mockFetch = async (url) => {
    if (url.includes('/api/provider-match')) {
      await new Promise(r => { pendingResolves.push(r); });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          matched: true,
          provider: 'spotify',
          track: { uri: 'spotify:track:songMatched', duration: 200 }
        })
      };
    }
    return { ok: false };
  };

  const { NG } = loadAppInstance({}, { fetch: mockFetch });
  NG.providers.setSpotifyAuth({
    accessToken: 'valid-token',
    expiresAt: Date.now() + 3600000,
    user: { id: 'prem', product: 'premium' }
  });

  const songA = { id: 'song-a', title: { ar: 'أغنية أ', en: 'Song A' }, artist: { ar: 'فنان', en: 'Artist' } };
  const songB = { id: 'song-b', title: { ar: 'أغنية ب', en: 'Song B' }, artist: { ar: 'فنان', en: 'Artist' }, preview: 'https://cdn/b.mp3' };

  NG.engine.load(songA);
  const pA = NG.engine.play();

  NG.engine.load(songB);
  const pB = NG.engine.play();

  // Release all pending fetches
  pendingResolves.forEach(r => r());

  await pA;
  await pB;

  // Active track must remain Song B, and not accidentally flip to Song A
  assert.equal(NG.engine.track.id, 'song-b', 'Old pending request must not overwrite active song');
  assert.notEqual(NG.engine.track.id, 'song-a');
});

test('10. انتهاء الأغنية يؤدي إلى الانتقال الصحيح', async () => {
  const { NG, context } = loadAppInstance();
  const mockSDK = createMockSpotifySDK();
  context.window.Spotify = mockSDK;

  await NG.initializeSpotifyPlayer('fake-token');
  const player = NG.engine._spotifyPlayer;
  NG.engine.mode = 'spotify';
  NG.engine.track = { id: 'sp-end-trk', duration: 200, spotifyUri: 'spotify:track:end123' };
  NG.engine.playing = true;

  let endedEventFired = false;
  NG.bus.addEventListener('ended', () => {
    endedEventFired = true;
  });

  // Spotify player signals end of track
  player.emit('player_state_changed', {
    position: 200000,
    duration: 200000,
    paused: true
  });

  assert.equal(endedEventFired, true, 'Ended event must fire on Spotify track completion');
  assert.equal(NG.engine.status, 'ended');
  assert.equal(NG.engine.playing, false);
});

test('11. الملفات المحلية لا تتأثر بـ Spotify SDK أو قيود الـ 30 ثانية', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const localFile = {
    id: 'local-file-42',
    source: 'file',
    playbackType: 'local',
    playbackProvider: 'local',
    duration: 320,
    url: 'blob:http://localhost/sample-uuid'
  };

  engine.load(localFile);
  assert.equal(engine.mode, 'file');
  assert.equal(engine.getDuration(), 320, 'Local file must preserve its full 320s duration');
  assert.equal(engine.isFullTrack(), true);
  assert.equal(engine.isAudioPreview(), false);

  // Seeking to 160s (50%)
  engine.seek(160);
  assert.equal(engine.getPosition(), 160);

  // Ensure Spotify player was never initialized or assigned
  assert.equal(engine._spotifyPlayer, null);
});

test('12. تحديث شريط التشغيل يعتمد على Player الحقيقي', async () => {
  const { NG, context } = loadAppInstance();
  const mockSDK = createMockSpotifySDK();
  context.window.Spotify = mockSDK;

  await NG.initializeSpotifyPlayer('real-token');
  const player = NG.engine._spotifyPlayer;
  NG.engine.mode = 'spotify';
  NG.engine.track = { id: 'real-sp', duration: 240, spotifyUri: 'spotify:track:real' };

  let latestTick = null;
  NG.bus.addEventListener('tick', (e) => {
    latestTick = e.detail;
  });

  // State update from Spotify hardware/SDK at 45.5s
  player.emit('player_state_changed', {
    position: 45500,
    duration: 240000,
    paused: false
  });

  assert.equal(NG.engine.getPosition(), 45.5);
  assert.equal(NG.engine.getDuration(), 240);
  assert.equal(latestTick?.pos, 45.5);
  assert.equal(latestTick?.duration, 240);
  assert.equal(NG.engine.playing, true);
  assert.equal(NG.engine.status, 'playing');
});
