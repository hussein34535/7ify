import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

test('1. musicProviders registry lists all supported music providers', () => {
  const { NG } = loadAppInstance();
  assert.ok(NG.musicProviders, 'musicProviders registry must be exported');
  const providers = NG.musicProviders.list();
  assert.ok(Array.isArray(providers));

  const providerIds = providers.map(p => p.id);
  assert.ok(providerIds.includes('youtube'), 'Must include youtube provider');
  assert.ok(providerIds.includes('spotify'), 'Must include spotify provider');
  assert.ok(providerIds.includes('jamendo'), 'Must include jamendo provider');
  assert.ok(providerIds.includes('archive'), 'Must include archive provider');
  assert.ok(providerIds.includes('apple-preview'), 'Must include apple-preview provider');
  assert.ok(providerIds.includes('local'), 'Must include local provider');
});

test('2. Playable duration logic cleanly distinguishes FULL/EMBED vs PREVIEW sources', () => {
  const { NG } = loadAppInstance();

  // Full YouTube embed track
  const ytTrack = {
    id: 'yt-1',
    title: { ar: 'أغنية يوتيوب', en: 'YouTube Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    duration: 245,
    fullDuration: 245,
    playbackProvider: 'youtube',
    playbackType: 'embed',
    youtubeId: 'dQw4w9WgXcQ'
  };
  assert.equal(NG.getPlayableDuration(ytTrack), 245, 'YouTube embed must report full track duration');

  // Full Jamendo track
  const jamTrack = {
    id: 'jam-1',
    title: { ar: 'أغنية جاميندو', en: 'Jamendo Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    duration: 180,
    playbackProvider: 'jamendo',
    playbackType: 'full',
    audioUrl: 'https://example.com/jamendo.mp3'
  };
  assert.equal(NG.getPlayableDuration(jamTrack), 180, 'Jamendo full stream must report full track duration');

  // Apple Music Preview track
  const applePreviewTrack = {
    id: 'ap-1',
    title: { ar: 'معاينة آبل', en: 'Apple Preview' },
    artist: { ar: 'فنان', en: 'Artist' },
    duration: 210, // Original catalog duration
    previewDuration: 30,
    playbackProvider: 'apple-preview',
    playbackType: 'preview',
    previewUrl: 'https://audio-ssl.itunes.apple.com/preview.m4a'
  };
  assert.equal(NG.getPlayableDuration(applePreviewTrack), 30, 'Apple preview must report 30s preview duration');

  // Local file track
  const localTrack = {
    id: 'loc-1',
    title: 'Local File',
    artist: 'Me',
    duration: 320,
    source: 'file',
    playbackType: 'local'
  };
  assert.equal(NG.getPlayableDuration(localTrack), 320, 'Local file must report true file duration');
});

test('3. Audio driver isolation prevents overlapping playback across drivers', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  let htmlAudioPaused = false;
  engine.el.pause = () => { htmlAudioPaused = true; };

  let ytPaused = false;
  NG.ytDriver.pause = () => { ytPaused = true; };

  // When switching to YouTube driver, HTML Audio must be paused
  engine.stopDrivers('youtube');
  assert.equal(htmlAudioPaused, true, 'HTML Audio must be paused when YouTube driver activates');

  // When switching to Audio driver, YouTube driver must be stopped/paused
  htmlAudioPaused = false;
  engine.stopDrivers('audio');
  assert.equal(ytPaused, true, 'YouTube driver must be stopped when Audio driver activates');
});

test('4. Fallback chain cascades smoothly to next available source when primary source fails', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const multiSourceTrack = {
    id: 'multi-1',
    title: { ar: 'أغنية متعددة المصادر', en: 'Multi Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    duration: 220,
    playbackProvider: 'youtube',
    playbackType: 'embed',
    sources: [
      { provider: 'youtube', mode: 'embed', duration: 220, id: 'yt-broken' },
      { provider: 'archive', mode: 'full', duration: 220, audioUrl: 'https://archive.org/audio.mp3' },
      { provider: 'apple', mode: 'preview', duration: 30, previewUrl: 'https://apple.com/preview.m4a' }
    ]
  };

  engine.load(multiSourceTrack);
  assert.equal(engine.track.playbackProvider, 'youtube');

  let fallbackEventFired = false;
  let fallbackDetail = null;
  NG.bus.addEventListener('fallback', (e) => {
    fallbackEventFired = true;
    fallbackDetail = e.detail;
  });

  // Simulate YouTube playback failure
  engine.handlePlaybackFallback('youtube', new Error('Embed error 150'));

  assert.equal(fallbackEventFired, true, 'Fallback event must be emitted');
  assert.equal(fallbackDetail.from, 'youtube');
  assert.equal(fallbackDetail.to, 'archive');
  assert.equal(engine.track.playbackProvider, 'archive', 'Engine must switch to archive provider');
  assert.equal(engine.track.playbackType, 'full');
});

test('5. Manual source switching via engine.switchSource updates active provider and plays', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const multiSourceTrack = {
    id: 'multi-switch',
    title: { ar: 'أغنية تجربة التبديل', en: 'Switch Song' },
    artist: { ar: 'فنان', en: 'Artist' },
    duration: 215,
    playbackProvider: 'youtube',
    playbackType: 'embed',
    sources: [
      { provider: 'youtube', mode: 'embed', duration: 215, id: 'yt-123' },
      { provider: 'jamendo', mode: 'full', duration: 215, audioUrl: 'https://jamendo.com/stream.mp3' }
    ]
  };

  engine.load(multiSourceTrack);
  assert.equal(engine.track.playbackProvider, 'youtube');

  // Switch to Jamendo
  const switched = engine.switchSource('jamendo');
  assert.equal(switched, true, 'switchSource must return true when source exists');
  assert.equal(engine.track.playbackProvider, 'jamendo');
  assert.equal(engine.track.playbackType, 'full');
  assert.equal(engine.track.src, 'https://jamendo.com/stream.mp3');
});
