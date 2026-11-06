import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

test('1. End-of-track: pauseAtEnd holds progress at 100% and does NOT snap back to 0:00', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const track = {
    id: 't-end-1',
    source: 'online',
    playbackType: 'preview',
    preview: 'https://audio-ssl.itunes.apple.com/test.m4a',
    duration: 180,
    previewDuration: 30
  };

  engine.load(track);
  assert.equal(engine.getDuration(), 30);

  // Trigger track end
  engine.pauseAtEnd();

  assert.equal(engine.status, 'ended');
  assert.equal(engine.playing, false);
  assert.equal(engine.getPosition(), 30, 'Position must remain at full duration (30s), not 0:00');
});

test('2. Play clicked while track is ended smoothly restarts from 0:00', async () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const track = {
    id: 't-end-2',
    source: 'file',
    playbackType: 'local',
    url: 'blob:audio-end',
    duration: 120
  };

  engine.load(track);
  engine.pauseAtEnd();
  assert.equal(engine.status, 'ended');
  assert.equal(engine.getPosition(), 120);

  // Click play again
  await engine.play();
  assert.equal(engine.status, 'playing');
  assert.equal(engine.playing, true);
  assert.equal(engine.getPosition(), 0, 'Playback must restart smoothly from 0 after completion');
});

test('3. Seeking while ended sets position accurately and clears ended status to paused', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const track = {
    id: 't-end-3',
    source: 'online',
    playbackType: 'preview',
    preview: 'https://audio-ssl.itunes.apple.com/test3.m4a',
    duration: 210,
    previewDuration: 30
  };

  engine.load(track);
  engine.pauseAtEnd();
  assert.equal(engine.status, 'ended');
  assert.equal(engine.getPosition(), 30);

  // User seeks to 10s
  engine.seek(10);
  assert.equal(engine.status, 'paused');
  assert.equal(engine.getPosition(), 10);
});

test('4. End-of-track on 240s local file holds 240s without jumping to 0', () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  const localTrack = {
    id: 'local-full-track',
    source: 'file',
    playbackType: 'local',
    url: 'blob:full-local',
    duration: 240
  };

  engine.load(localTrack);
  assert.equal(engine.getDuration(), 240);

  engine.pauseAtEnd();
  assert.equal(engine.status, 'ended');
  assert.equal(engine.getPosition(), 240, 'Must hold 240 seconds at completion');
});
