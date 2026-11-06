import { spawnSync, fork } from 'node:child_process';
import { resolve } from 'node:path';

console.log('====================================================');
console.log('       7ify NAGHAM STUDIO — TEST RUNNER             ');
console.log('====================================================\n');

// 1. Build Verification
console.log('Step 1: Building project bundle via build.mjs...');
const buildRes = spawnSync(process.execPath, ['build.mjs'], { stdio: 'inherit' });
if (buildRes.status !== 0) {
  console.error('\n❌ Build failed!');
  process.exit(1);
}
console.log('✅ Build successful.\n');

// 2. Unit & Logic Verification
console.log('Step 2: Testing Serverless & Core APIs logic...');

// Test 2.1: api/search.js validation
import searchHandler from '../api/search.js';

let resData = null;
let resStatus = 200;
const mockRes = {
  setHeader: () => mockRes,
  status: (code) => { resStatus = code; return mockRes; },
  json: (data) => { resData = data; return mockRes; },
  end: () => mockRes
};

// Short query should return empty without hitting upstream
await searchHandler({ method: 'GET', query: { q: 'a' } }, mockRes);
if (!resData || resData.results.length !== 0) {
  console.error('❌ Expected empty results for short query < 2 chars');
  process.exit(1);
}
console.log('✅ Search short query check passed.');

// Test 2.2: api/lyrics.js plain vs synced distinction
import lyricsHandler from '../api/lyrics.js';
resData = null;
await lyricsHandler({ method: 'GET', query: {} }, mockRes);
if (resStatus !== 400 || resData.synced !== false) {
  console.error('❌ Expected 400 for empty track name');
  process.exit(1);
}
console.log('✅ Lyrics parameter check passed.');

// 3. Automated Browser UI & Page Tests
const tests = [
  { name: 'Spotify Track Page Verification', file: 'test/verify-song-page.mjs' },
  { name: 'Dedicated Pages (Playlist/Artist/Album/Library) Verification', file: 'test/verify-pages.mjs' },
  { name: 'Edge Cases & Breakpoints Verification', file: 'test/edge.mjs' }
];

let failed = 0;
for (const t of tests) {
  console.log(`\n----------------------------------------------------`);
  console.log(`Running: ${t.name} (${t.file})...`);
  console.log(`----------------------------------------------------`);
  const r = spawnSync(process.execPath, [t.file], { stdio: 'inherit' });
  if (r.status !== 0) {
    console.error(`\n❌ Test failed: ${t.name}`);
    failed++;
  } else {
    console.log(`\n✅ Passed: ${t.name}`);
  }
}

console.log('\n====================================================');
if (failed === 0) {
  console.log('🎉 ALL TESTS PASSED SUCCESSFULLY! (100% PASS RATE)');
  console.log('====================================================');
  process.exit(0);
} else {
  console.error(`💥 ${failed} TEST SUITE(S) FAILED.`);
  console.log('====================================================');
  process.exit(1);
}
