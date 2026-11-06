import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

test('engine.play() supersedes previous play promises without race condition', async () => {
  const { NG } = loadAppInstance();
  const engine = NG.engine;

  // Track 1 and Track 2
  const t1 = NG.getTrack('t1');
  const t2 = NG.getTrack('t2');

  assert.ok(t1 && t2);

  // Hook the audio element play with simulated async delay
  engine.el.play = function () {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve();
      }, 50);
    });
  };

  // Trigger rapid playback of track 1 then track 2 immediately
  engine.load(t1);
  const p1 = engine.play();

  engine.load(t2);
  const p2 = engine.play();

  await Promise.all([p1, p2]);

  // Current track must be t2, not overwritten by resolving t1 promise
  assert.equal(engine.track.id, 't2');
  assert.equal(engine.playing, true);
});

test('search empty state does not fabricate synthetic fallback track', () => {
  const { NG, TRACKS } = loadAppInstance();
  const initialTrackCount = TRACKS.length;

  const results = NG.searchTracks('random_nonexistent_query_xyz_999');
  assert.equal(results.length, 0);

  // Assert TRACKS was NOT polluted with any fake "Studio Edition" track
  assert.equal(TRACKS.length, initialTrackCount);
  const fakeFound = TRACKS.find(t => String(t.title?.ar || '').includes('random_nonexistent_query_xyz_999'));
  assert.equal(fakeFound, undefined);
});
