import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

test('1. Source selection: Full authorized online track (Spotify/Direct)', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const fullTrack = {
    id: 'sp-full-1',
    title: { ar: 'أغنية كاملة', en: 'Full Song' },
    artist: { ar: 'فنان معتمد', en: 'Verified Artist' },
    source: 'online',
    playbackType: 'full',
    playbackProvider: 'spotify',
    spotifyUri: 'spotify:track:abc123456789',
    duration: 245,
    fullDuration: 245,
    isFullTrack: true,
    isPreview: false,
    availability: 'available'
  };

  engine.load(fullTrack);
  assert.equal(engine.mode, 'spotify');
  assert.equal(engine.getDuration(), 245, 'Full authorized track should report full 245s playable duration');
  assert.equal(engine.isFullTrack(), true);
  assert.equal(engine.isAudioPreview(), false);

  // Seek 50% must target 122.5s
  engine.seek(122.5);
  assert.equal(engine.getPosition(), 122.5);
});

test('2. Source selection: Preview-only online track', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const previewTrack = {
    id: 'sp-prev-1',
    title: { ar: 'معاينة تجريبية', en: 'Preview Track' },
    artist: { ar: 'عمرو دياب', en: 'Amr Diab' },
    source: 'online',
    playbackType: 'preview',
    playbackProvider: 'apple-preview',
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 210,
    fullDuration: 210,
    previewDuration: 30,
    isFullTrack: false,
    isPreview: true,
    availability: 'preview_only'
  };

  engine.load(previewTrack);
  assert.equal(engine.mode, 'stream');
  assert.equal(engine.getDuration(), 30, 'Preview-only track must report 30s playable duration');
  assert.equal(engine.getFullDuration(), 210, 'Full duration in catalog remains 210s');
  assert.equal(engine.isAudioPreview(), true);
  assert.equal(engine.isFullTrack(), false);

  // Seek 50% must target 15s
  engine.seek(15);
  assert.equal(engine.getPosition(), 15);
});

test('3. Source selection: Local audio file', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const localTrack = {
    id: 'local-test-123',
    source: 'file',
    playbackType: 'local',
    playbackProvider: 'local',
    url: 'blob:http://localhost/local-audio-1',
    duration: 185,
    fullDuration: 185,
    isFullTrack: true,
    isPreview: false,
    availability: 'available'
  };

  engine.load(localTrack);
  assert.equal(engine.mode, 'file');
  assert.equal(engine.getDuration(), 185, 'Local file must report its full audio duration (185s)');
  assert.equal(engine.isFullTrack(), true);
  assert.equal(engine.isAudioPreview(), false);

  // Seek 50% must target 92.5s
  engine.seek(92.5);
  assert.equal(engine.getPosition(), 92.5);
});

test('4. Source selection: Unavailable track (no preview, no stream)', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const unavailTrack = {
    id: 'sp-unavail',
    title: { ar: 'غير متاح', en: 'Unavailable' },
    source: 'online',
    playbackType: 'unavailable',
    playbackProvider: 'none',
    duration: 190,
    fullDuration: 190,
    preview: '',
    url: '',
    isFullTrack: false,
    isPreview: false,
    availability: 'unavailable'
  };

  engine.load(unavailTrack);
  assert.equal(engine.mode, 'unavailable');
  assert.equal(engine.status, 'unavailable');
  assert.equal(engine.getDuration(), 0, 'Unavailable track must have 0 playable duration');

  engine.seek(50);
  assert.equal(engine.getPosition(), 0, 'Unavailable track cannot be seeked');
});

test('5. Switching sources prevents simultaneous playback and stops previous driver', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const track1 = {
    id: 't1',
    source: 'file',
    playbackType: 'local',
    url: 'blob:audio1',
    duration: 100
  };
  const track2 = {
    id: 't2',
    source: 'online',
    playbackType: 'preview',
    preview: 'https://audio-ssl.itunes.apple.com/preview2.m4a',
    duration: 200,
    previewDuration: 30
  };

  engine.load(track1);
  assert.equal(engine.mode, 'file');
  assert.equal(engine.getDuration(), 100);

  // Switch to preview
  engine.load(track2);
  assert.equal(engine.mode, 'stream');
  assert.equal(engine.getDuration(), 30);
  assert.equal(engine.el.src, track2.preview);
});
