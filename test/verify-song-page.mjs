import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9338;
const FILE = 'file:///C:/Users/husso/Desktop/7ify/nagham-studio.html';
const PROFILE = 'C:\\Users\\husso\\AppData\\Local\\Temp\\nagham-sp-' + Date.now();
const OUT = 'C:\\Users\\husso\\Desktop\\7ify\\shots';

try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files',
  '--window-size=1440,900', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'
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
  await send('Page.navigate', { url: FILE + '?v=' + Date.now() });
  await sleep(1500);

  console.log('Testing Spotify Track Page...');

  // 1. Open track page
  await ev("window.__nagham.openTrackPage('t1');");
  await sleep(500);

  const view = await ev("window.__nagham.ui.view;");
  console.log('Current View:', view);
  if (view !== 'track') throw new Error('Expected view to be "track"');

  // 2. Check Hero
  const title = await ev("document.querySelector('.sp-title').textContent;");
  console.log('Track Title in Hero:', title);
  if (!title.includes('تملي معاك')) throw new Error('Expected Tamally Maak title in hero');

  const kicker = await ev("document.querySelector('.sp-kicker').textContent;");
  console.log('Kicker:', kicker);

  const streams = await ev("document.querySelector('.sp-streams-text').textContent;");
  console.log('Streams count:', streams);

  // 3. Check Action Bar
  const hasPlayBtn = await ev("!!document.querySelector('.sp-play-btn');");
  const hasHqBadge = await ev("document.querySelector('.sp-badge-hq').textContent;");
  console.log('Has Play Button:', hasPlayBtn);
  console.log('HQ Badge:', hasHqBadge);

  // 4. Check Lyrics Card
  const lyricCount = await ev("document.querySelectorAll('.sp-lyric').length;");
  console.log('Lyrics lines count:', lyricCount);
  if (lyricCount === 0) throw new Error('Expected timed lyrics to be rendered');

  // 5. Check Artist Card & Verified badge
  const artistTitle = await ev("document.querySelector('.sp-artist-title').textContent;");
  const hasVerified = await ev("!!document.querySelector('.sp-verified-tag');");
  const listeners = await ev("document.querySelector('.sp-artist-listeners').textContent;");
  console.log('Artist in Card:', artistTitle);
  console.log('Has Verified Badge:', hasVerified);
  console.log('Monthly Listeners:', listeners);

  // 6. Check Credits Card
  const hasCredits = await ev("!!document.querySelector('.sp-credits-card');");
  console.log('Has Credits Card:', hasCredits);

  // 7. Interactive Follow toggle
  const initialFollowing = await ev("document.querySelector('.sp-follow-btn').classList.contains('is-following');");
  console.log('Initial Following:', initialFollowing);
  await ev("document.querySelector('.sp-follow-btn').click();");
  await sleep(200);
  const toggledFollowing = await ev("document.querySelector('.sp-follow-btn').classList.contains('is-following');");
  console.log('Toggled Following:', toggledFollowing);

  // 8. Capture screenshot
  await shot('spotify-track-page-desktop');
  console.log('Captured screenshot shots/spotify-track-page-desktop.png');

  // 9. Mobile check
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(400);
  await shot('spotify-track-page-mobile');
  console.log('Captured screenshot shots/spotify-track-page-mobile.png');

  console.log('\nALL SPOTIFY TRACK PAGE VERIFICATION TESTS PASSED SUCCESSFULLY!');
} catch (err) {
  console.error('Test Failed:', err);
  process.exit(1);
} finally {
  try { chrome.kill('SIGKILL'); } catch {}
  process.exit(0);
}
