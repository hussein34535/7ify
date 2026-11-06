import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

test('1. online preview with fullDuration=210 and previewDuration=30 uses playable 30s timeline and 50% seek targets 15s', () => {
  const { NG, TRACKS } = loadAppInstance();
  const track = {
    id: 'sp-apple-test-1',
    title: { ar: 'أغنية معاينة', en: 'Preview Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 210,
    fullDuration: 210,
    previewDuration: 30,
    playbackType: 'preview',
    isAudioPreview: true,
    source: 'online'
  };
  TRACKS.push(track);

  NG.engine.load(track);

  // Playable timeline duration must be 30 seconds, not 210
  const playableDur = NG.engine.getDuration();
  assert.equal(playableDur, 30);
  assert.equal(NG.getPlayableDuration(track), 30);

  // Catalog duration is still preserved
  assert.equal(track.duration, 210);
  assert.equal(track.fullDuration, 210);

  // 50% seek must target 15 seconds, not 105 seconds
  const ratio = 0.5;
  NG.engine.seek(ratio * NG.engine.getDuration());

  const currentPos = NG.engine.getPosition();
  assert.equal(currentPos, 15);

  // Progress at 15 seconds out of 30 seconds must be exactly 50%
  const progressPct = (currentPos / playableDur) * 100;
  assert.equal(progressPct, 50);
});

test('2. online item without a preview URL remains unavailable without seekable timeline', () => {
  const { NG, TRACKS } = loadAppInstance();
  const unavailTrack = {
    id: 'sp-apple-unavail',
    title: { ar: 'أغنية غير متاحة', en: 'Unavailable Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    preview: '',
    duration: 180,
    fullDuration: 180,
    previewDuration: null,
    playbackType: 'unavailable',
    isAudioPreview: false,
    source: 'online'
  };
  TRACKS.push(unavailTrack);

  NG.engine.load(unavailTrack);

  assert.equal(NG.engine.mode, 'unavailable');
  assert.equal(NG.engine.status, 'unavailable');
  assert.equal(NG.engine.getDuration(), 0);
  assert.equal(NG.getPlayableDuration(unavailTrack), 0);

  // Seek on unavailable audio must be a no-op
  NG.engine.seek(50);
  assert.equal(NG.engine.getPosition(), 0);
});

test('3. local file with duration=240 maintains full 240s timeline and 50% seek targets 120s', () => {
  const { NG, TRACKS } = loadAppInstance();
  const localTrack = {
    id: 'local-tone-file',
    title: { ar: 'ملف محلي', en: 'Local File' },
    artist: { ar: 'جهازي', en: 'My Device' },
    url: 'blob:http://localhost/test-blob',
    duration: 240,
    source: 'file'
  };
  TRACKS.push(localTrack);

  NG.engine.load(localTrack);

  // Playable timeline for local file must remain 240 seconds, NOT 30 seconds
  assert.equal(NG.engine.getDuration(), 240);
  assert.equal(NG.getPlayableDuration(localTrack), 240);

  // 50% seek targets 120 seconds
  const ratio = 0.5;
  NG.engine.seek(ratio * NG.engine.getDuration());
  assert.equal(NG.engine.getPosition(), 120);

  const progressPct = (NG.engine.getPosition() / NG.engine.getDuration()) * 100;
  assert.equal(progressPct, 50);
});

test('4. loaded media metadata duration takes precedence when valid and positive', () => {
  const { NG, TRACKS } = loadAppInstance();
  const track = {
    id: 'sp-apple-exact-dur',
    title: { ar: 'معاينة متغيرة', en: 'Variable Preview' },
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 250,
    previewDuration: 30,
    playbackType: 'preview',
    source: 'online'
  };
  TRACKS.push(track);

  NG.engine.load(track);

  // Before media loads, falls back to previewDuration (30)
  assert.equal(NG.engine.getDuration(), 30);

  // Simulate loadedmetadata event from audio element with actual media duration 29.84s
  NG.engine.el.duration = 29.84;
  NG.engine.el.trigger('loadedmetadata');

  // Loaded media duration takes precedence
  assert.equal(NG.engine.getDuration(), 29.84);

  // Seek uses the exact media duration
  NG.engine.seek(0.5 * NG.engine.getDuration());
  assert.equal(NG.engine.getPosition(), 14.92);
});

test('5. invalid media duration values (NaN, Infinity, 0, negative) safely fall back to policy', () => {
  const { NG, TRACKS } = loadAppInstance();
  const previewTrack = {
    id: 'sp-apple-invalid-test',
    title: { ar: 'فحص الحالات الشاذة', en: 'Invalid Dur Test' },
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 190,
    previewDuration: 30,
    playbackType: 'preview',
    source: 'online'
  };
  TRACKS.push(previewTrack);

  NG.engine.load(previewTrack);

  // Case NaN
  NG.engine.el.duration = NaN;
  assert.equal(NG.engine.getDuration(), 30);

  // Case Infinity
  NG.engine.el.duration = Infinity;
  assert.equal(NG.engine.getDuration(), 30);

  // Case 0
  NG.engine.el.duration = 0;
  assert.equal(NG.engine.getDuration(), 30);

  // Case negative
  NG.engine.el.duration = -15;
  assert.equal(NG.engine.getDuration(), 30);
});

test('6. main player and sheet player use the same playable timeline duration policy', () => {
  const { NG, TRACKS } = loadAppInstance();
  const track = {
    id: 'sp-apple-consistency-test',
    title: { ar: 'أغنية متطابقة', en: 'Consistent Song' },
    preview: 'https://audio-ssl.itunes.apple.com/preview.m4a',
    duration: 215,
    previewDuration: 30,
    playbackType: 'preview',
    source: 'online'
  };
  TRACKS.push(track);

  NG.engine.load(track);

  const mainDuration = NG.engine.getDuration();
  const sheetDuration = NG.getPlayableDuration(track);

  assert.equal(mainDuration, sheetDuration);
  assert.equal(mainDuration, 30);

  // Seeking from main player ratio
  const mainTarget = 0.5 * mainDuration;
  // Seeking from sheet player ratio
  const sheetTarget = 0.5 * sheetDuration;

  assert.equal(mainTarget, 15);
  assert.equal(sheetTarget, 15);
  assert.equal(mainTarget, sheetTarget);
});
