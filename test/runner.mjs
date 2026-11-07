import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

console.log('====================================================');
console.log('       7ify NAGHAM STUDIO — TEST RUNNER             ');
console.log('====================================================\n');

let failed = 0;

// 1. Build Verification
console.log('Step 1: Building project bundle via build.mjs...');
const buildRes = spawnSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
if (buildRes.status !== 0) {
  console.error('\n❌ Build failed!');
  process.exit(1);
}
console.log('✅ Build successful.\n');

// 2. Unit Tests
console.log('----------------------------------------------------');
console.log('Step 2: Running Unit Tests (node --test test/unit/*.test.mjs)...');
console.log('----------------------------------------------------');
const unitRes = spawnSync(process.execPath, [
  '--test',
  'test/unit/lrc.test.mjs',
  'test/unit/metadata.test.mjs',
  'test/unit/state.test.mjs',
  'test/unit/lyrics-search.test.mjs',
  'test/unit/race.test.mjs',
  'test/unit/timeline.test.mjs',
  'test/unit/lyrics-persistence.test.mjs',
  'test/unit/provider-sources.test.mjs',
  'test/unit/spotify-playback.test.mjs',
  'test/unit/track-matching.test.mjs',
  'test/unit/end-of-track.test.mjs',
  'test/unit/multi-source-engine.test.mjs',
  'test/unit/normalization.test.mjs',
  'test/unit/local-scoring.test.mjs',
  'test/unit/autocomplete-search.test.mjs',
  'test/unit/spotify-library-sync.test.mjs'
], { stdio: 'inherit' });
if (unitRes.status !== 0) {
  console.error('\n❌ Unit tests failed!');
  failed++;
} else {
  console.log('✅ All Unit Tests passed.\n');
}

// 3. API Contract & Security Tests
console.log('----------------------------------------------------');
console.log('Step 3: Running API Security & Contract Tests...');
console.log('----------------------------------------------------');
const apiRes = spawnSync(process.execPath, [
  '--test',
  'test/api/search.test.mjs',
  'test/api/lyrics.test.mjs',
  'test/api/stream.test.mjs',
  'test/api/provider-match.test.mjs',
  'test/api/search-multi.test.mjs'
], { stdio: 'inherit' });
if (apiRes.status !== 0) {
  console.error('\n❌ API tests failed!');
  failed++;
} else {
  console.log('✅ All API tests passed.\n');
}

// 4. Automated Browser UI & Page Tests
const browserTests = [
  { name: 'Spotify Track Page Verification', file: 'test/verify-song-page.mjs' },
  { name: 'Dedicated Pages (Playlist/Artist/Album/Library) Verification', file: 'test/verify-pages.mjs' },
  { name: 'Edge Cases & Breakpoints Verification', file: 'test/edge.mjs' },
  { name: 'Spotify MiniPlayer Popup Verification', file: 'test/verify-miniplayer.mjs' },
  { name: 'Spotify Mobile Now Playing View Verification', file: 'test/verify-npv-modal.mjs' },
  { name: 'Document Picture-in-Picture & MediaSession Verification', file: 'test/verify-doc-pip.mjs' }
];

for (const t of browserTests) {
  console.log(`----------------------------------------------------`);
  console.log(`Running: ${t.name} (${t.file})...`);
  console.log(`----------------------------------------------------`);
  const r = spawnSync(process.execPath, [t.file], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n❌ Test failed: ${t.name}`);
    failed++;
  } else {
    console.log(`\n✅ Passed: ${t.name}\n`);
  }
}

console.log('====================================================');
if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! (100% PASS RATE)');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error(`💥 ${failed} TEST SUITE(S) FAILED.`);
  console.log('====================================================');
  process.exit(1);
}
