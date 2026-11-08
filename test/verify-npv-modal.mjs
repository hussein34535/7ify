import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');

// =========================================================================
// PART 1: Automated Verification of 1:1 Spotify Mobile UI Screens & Cards
// =========================================================================
const htmlSrc = readFileSync(join(projectRoot, 'src/index.html'), 'utf8');
const requiredIds = [
  'likedSongsView',
  'nowPlayingView',
  'stickyCollapsedHeader',
  'stickySongTitle',
  'stickySongArtist',
  'mainAlbumArt',
  'mainSongTitle',
  'mainSongArtist',
  'lyricsPreviewCard',
  'aboutArtistCard',
  'creditsCard',
  'exploreCard'
];

for (const id of requiredIds) {
  const tagMatch = htmlSrc.match(new RegExp(`<([a-z0-9_-]+)[^>]*id=["']${id}["'][^>]*>`, 'i'));
  if (!tagMatch) {
    throw new Error(`Missing required element #${id}`);
  }
  const [tag, tagName] = tagMatch;
  // Anti-evasion check: MUST NOT have class="hidden" or hidden attribute on required elements
  if (/\bhidden\b/i.test(tag)) {
    throw new Error(`Anti-evasion check failed: #${id} has class="hidden" or hidden attribute! Tag: ${tag}`);
  }

  // Anti-evasion check: MUST NOT be an empty tag
  if (tagName.toLowerCase() === 'img') {
    if (!/src=["'][^"']+["']/i.test(tag)) {
      throw new Error(`Anti-evasion check failed: #${id} (<img>) must have a valid non-empty src attribute!`);
    }
  } else {
    const emptyTagRegex = new RegExp(`<(${tagName})[^>]*id=["']${id}["'][^>]*>\\s*<\\/\\1>`, 'i');
    if (emptyTagRegex.test(htmlSrc)) {
      throw new Error(`Anti-evasion check failed: #${id} is an empty <${tagName}> tag! It must contain real UI content.`);
    }
  }
}
console.log('PASS: All 1:1 Spotify Mobile UI screens and cards verified (none are hidden or empty in src/index.html).');

// =========================================================================
// PART 2: Interactive Headless Chrome Mobile NPV Verification
// =========================================================================
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9350 + Math.floor(Math.random() * 200);
const FILE = pathToFileURL(join(projectRoot, 'nagham-studio.html')).href;
const PROFILE = join(tmpdir(), 'nagham-npv-' + Date.now());
const OUT = join(projectRoot, 'shots');

try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files',
  '--window-size=390,844', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });

async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try { const r = await fetch(url); if (r.ok) return r.json(); } catch { /* retry */ }
    await sleep(200);
  }
  throw new Error('devtools not ready');
}

let ws;
let seq = 0;
const pending = new Map();
const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});

async function ev(expression) {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error((r.exceptionDetails.exception && r.exceptionDetails.exception.description) || r.exceptionDetails.text);
  return r.result.value;
}

async function shot(name) {
  const r = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(`${OUT}\\${name}.png`, Buffer.from(r.data, 'base64'));
}

try {
  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const list = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = list.find((t) => t.type === 'page') || list[0];
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  ws.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.id && pending.has(data.id)) {
      const { res, rej } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) rej(new Error(data.error.message));
      else res(data.result);
    }
  };

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });

  await send('Page.navigate', { url: FILE + '?v=' + Date.now() });
  await sleep(1500);

  console.log('--- TESTING SPOTIFY MOBILE NOW PLAYING VIEW (NPV) ---');

  // 1. Play first track
  await ev("window.__nagham.playTrack('t1');");
  await sleep(600);

  // 2. Open Now Playing Modal via mobile click simulation
  await ev("window.__nagham.openNowPlaying();");
  await sleep(500);

  const isOpen = await ev("document.querySelector('#npvModal').classList.contains('open');");
  console.log('Now Playing Modal open:', isOpen);
  if (!isOpen) throw new Error('Expected #npvModal to have class "open"');

  // Verify at runtime that all required elements exist, are NOT hidden with class="hidden", and are NOT empty
  const runtimeCheck = await ev(`(() => {
    const ids = [
      'likedSongsView',
      'nowPlayingView',
      'stickyCollapsedHeader',
      'stickySongTitle',
      'stickySongArtist',
      'mainAlbumArt',
      'mainSongTitle',
      'mainSongArtist',
      'lyricsPreviewCard',
      'aboutArtistCard',
      'creditsCard',
      'exploreCard'
    ];
    return ids.map(id => {
      const el = document.getElementById(id);
      if (!el) return { id, ok: false, error: 'Element missing in live DOM' };
      if (el.classList.contains('hidden')) return { id, ok: false, error: 'Element has class "hidden"' };
      const isImg = el.tagName === 'IMG';
      const hasContent = isImg ? (!!el.src && el.src.length > 0) : (el.textContent.trim().length > 0 || el.children.length > 0);
      if (!hasContent) return { id, ok: false, error: 'Element is empty in live DOM' };
      return { id, ok: true, tag: el.tagName, childCount: el.children.length };
    });
  })()`);

  console.log('Runtime Non-Empty & Unhidden Elements Verification:', runtimeCheck);
  const failedEls = runtimeCheck.filter(r => !r.ok);
  if (failedEls.length > 0) {
    throw new Error(`Runtime anti-evasion verification failed for elements: ${JSON.stringify(failedEls)}`);
  }

  // 3. Check Track Info in Hero
  const title = await ev("document.querySelector('#npvTitle').textContent;");
  const artist = await ev("document.querySelector('#npvArtist').textContent;");
  const hasArt = await ev("document.querySelector('#npvArtwork').style.backgroundImage.length > 0;");
  console.log('Track Hero:', { title, artist, hasArt });
  if (!title || !artist) throw new Error('Track title or artist missing');

  // 4. Capture Top Hero Screenshot
  await shot('mobile-npv-top-hero');
  console.log('📸 Screenshot: mobile-npv-top-hero.png');

  // 5. Test Play/Pause toggle inside NPV
  const playBefore = await ev("window.__nagham.engine.playing;");
  await ev("document.querySelector('#npvPlay').click();");
  await sleep(300);
  const playAfter = await ev("window.__nagham.engine.playing;");
  console.log('Play state toggle:', playBefore, '->', playAfter);
  if (playBefore === playAfter) throw new Error('Play toggle failed');

  // Toggle back to playing
  await ev("document.querySelector('#npvPlay').click();");
  await sleep(300);

  // 6. Test Scroll & Sticky Collapsed Header
  await ev("document.querySelector('#npvScrollContainer').scrollTop = 320;");
  await ev("document.querySelector('#npvScrollContainer').dispatchEvent(new Event('scroll'));");
  await sleep(300);

  const stickyHeaderVisible = await ev("!document.querySelector('#stickyCollapsedHeader').classList.contains('opacity-0');");
  const stickyTitle = await ev("document.querySelector('#stickySongTitle').textContent;");
  const stickyArtist = await ev("document.querySelector('#stickySongArtist').textContent;");
  console.log('Sticky Header Visible:', stickyHeaderVisible, 'Title:', stickyTitle, 'Artist:', stickyArtist);
  if (!stickyHeaderVisible) throw new Error('Expected sticky header to be visible on scroll');

  // Capture Lyrics View with Sticky Header
  await shot('mobile-npv-lyrics-sticky');
  console.log('📸 Screenshot: mobile-npv-lyrics-sticky.png');

  // 7. Check Lyrics Card Lines
  const lyricLines = await ev("document.querySelectorAll('#npvLyricsLines .npv-lyric-line').length;");
  console.log('Lyrics lines count:', lyricLines);
  if (lyricLines === 0) throw new Error('Expected lyric lines to be populated');

  // 8. Test Scroll to Artist & Credits
  await ev("document.querySelector('#npvScrollContainer').scrollTop = 750;");
  await ev("document.querySelector('#npvScrollContainer').dispatchEvent(new Event('scroll'));");
  await sleep(300);

  const artistCardName = await ev("document.querySelector('#npvArtistCardName').textContent;");
  const artistListeners = await ev("document.querySelector('#npvArtistListeners').textContent;");
  const hasCreditsList = await ev("document.querySelectorAll('#npvCreditsList .credit-row').length;");
  const moreTracksCount = await ev("document.querySelectorAll('#npvMoreTracksList .more-track-card').length;");
  console.log('Artist Card Name:', artistCardName, 'Listeners:', artistListeners);
  console.log('Credits Rows:', hasCreditsList, 'More Tracks:', moreTracksCount);

  if (hasCreditsList < 3) throw new Error('Expected at least 3 credit rows');
  if (moreTracksCount === 0) throw new Error('Expected more tracks to be rendered');

  // Test Follow button toggle
  const initFollow = await ev("document.querySelector('#npvFollowBtn').classList.contains('is-following');");
  await ev("document.querySelector('#npvFollowBtn').click();");
  await sleep(200);
  const toggledFollow = await ev("document.querySelector('#npvFollowBtn').classList.contains('is-following');");
  console.log('Follow button toggle:', initFollow, '->', toggledFollow);
  if (initFollow === toggledFollow) throw new Error('Follow toggle failed');

  await shot('mobile-npv-artist-credits');
  console.log('📸 Screenshot: mobile-npv-artist-credits.png');

  // 9. Test Scroll to Top via Sticky Header click
  await ev("document.querySelector('#stickyCollapsedHeader .sticky-text-wrap').click();");
  await sleep(400);
  const scrollPosAfterTopClick = await ev("document.querySelector('#npvScrollContainer').scrollTop;");
  console.log('Scroll pos after top click:', scrollPosAfterTopClick);

  // 10. Test Close NPV via Down Chevron
  await ev("document.querySelector('[data-action=\"close-npv\"]').click();");
  await sleep(400);
  const isOpenAfterClose = await ev("document.querySelector('#npvModal').classList.contains('open');");
  console.log('Now Playing Modal closed:', !isOpenAfterClose);
  if (isOpenAfterClose) throw new Error('Expected #npvModal to be closed after close action');

  console.log('\n🎉 ALL SPOTIFY MOBILE NOW PLAYING VIEW (NPV) TESTS PASSED 100%!');

} catch (err) {
  process.exitCode = 1;
  console.error('Test Failed:', err);
} finally {
  try { if (ws) ws.close(); } catch {}
  try { chrome.kill(); } catch {}
  await sleep(300);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}
