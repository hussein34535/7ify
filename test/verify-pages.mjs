import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9339;
const FILE = 'file:///C:/Users/husso/Desktop/7ify/nagham-studio.html';
const PROFILE = 'C:\\Users\\husso\\AppData\\Local\\Temp\\nagham-pages-' + Date.now();
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
  await send('Page.navigate', { url: FILE + '?v=' + Date.now() });
  await sleep(1500);

  console.log('--- TESTING DEDICATED SPOTIFY PAGES ---');

  // 1. Test Playlist Page
  console.log('Testing Playlist Page...');
  await ev("window.__nagham.openPlaylistPage('p1');");
  await sleep(500);
  const viewPl = await ev("window.__nagham.ui.view;");
  console.log('Current View:', viewPl);
  if (viewPl !== 'playlist') throw new Error('Expected view to be "playlist"');

  const plTitle = await ev("document.querySelector('.pl-title').textContent;");
  console.log('Playlist Title:', plTitle);
  const plRows = await ev("document.querySelectorAll('.pl-row').length;");
  console.log('Playlist Track Rows:', plRows);
  if (plRows === 0) throw new Error('Expected playlist tracks');
  await shot('spotify-playlist-page');

  // 2. Test Artist Page
  console.log('Testing Artist Page...');
  await ev("window.__nagham.openArtistPage('عمرو دياب');");
  await sleep(500);
  const viewArt = await ev("window.__nagham.ui.view;");
  console.log('Current View:', viewArt);
  if (viewArt !== 'artist') throw new Error('Expected view to be "artist"');

  const artistName = await ev("document.querySelector('.artist-hero-name').textContent;");
  console.log('Artist Name:', artistName);
  if (!artistName.includes('عمرو دياب')) throw new Error('Expected Amr Diab on artist page');
  const artistRows = await ev("document.querySelectorAll('#view-artist .row').length;");
  console.log('Artist Top Tracks count:', artistRows);
  await shot('spotify-artist-page');

  // 3. Test Album Page
  console.log('Testing Album Page...');
  await ev("window.__nagham.openAlbumPage('تملي معاك');");
  await sleep(500);
  const viewAlb = await ev("window.__nagham.ui.view;");
  console.log('Current View:', viewAlb);
  if (viewAlb !== 'album') throw new Error('Expected view to be "album"');

  const albumTitle = await ev("document.querySelector('#view-album .pl-title').textContent;");
  console.log('Album Title:', albumTitle);
  const albumRows = await ev("document.querySelectorAll('#view-album .pl-row').length;");
  console.log('Album Tracks count:', albumRows);
  await shot('spotify-album-page');

  // 4. Test Library Albums Tab
  console.log('Testing Library Albums Tab...');
  await ev("document.querySelector('[data-nav=library]').click();");
  await sleep(300);
  await ev("document.querySelector('[data-action=library-tab][data-tab=albums]').click();");
  await sleep(300);
  const libAlbums = await ev("document.querySelectorAll('#view-library .card').length;");
  console.log('Library Albums Count:', libAlbums);
  if (libAlbums === 0) throw new Error('Expected albums in library');
  await shot('spotify-library-albums');

  // 5. Test Home Page
  console.log('Testing Home Page with all Spotify sections...');
  await ev("document.querySelector('[data-nav=home]').click();");
  await sleep(500);
  await shot('spotify-home-redesign');

  console.log('\nALL SPOTIFY DEDICATED PAGES TESTS PASSED SUCCESSFULLY!');
} catch (err) {
  console.error('Test Failed:', err);
  process.exit(1);
} finally {
  try { chrome.kill('SIGKILL'); } catch {}
  process.exit(0);
}
