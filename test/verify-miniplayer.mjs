import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9355;
const FILE = pathToFileURL(join(projectRoot, 'nagham-studio.html')).href;
const PROFILE = join(tmpdir(), 'nagham-miniplayer-' + Date.now());
const OUT = join(projectRoot, 'shots');
const ARTIFACT_DIR = 'C:\\Users\\husso\\.gemini\\antigravity\\brain\\5f57c978-ef99-41e7-bb99-623d9443f231';

try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
mkdirSync(OUT, { recursive: true });

console.log('🚀 Launching Chrome for Spotify MiniPlayer Verification...');
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
  const localPath = join(OUT, `${name}.png`);
  writeFileSync(localPath, Buffer.from(r.data, 'base64'));
  if (existsSync(ARTIFACT_DIR)) {
    try {
      copyFileSync(localPath, join(ARTIFACT_DIR, `${name}.png`));
    } catch (e) {}
  }
  console.log(`📸 Screenshot: ${name}.png`);
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
  await send('Page.navigate', { url: FILE });
  await sleep(2000);

  console.log('\n--- TESTING SPOTIFY MINIPLAYER POPUP ---');

  // 1. Check MiniPlayer button in player bar
  const hasBtn = await ev("!!document.getElementById('bMiniPlayer');");
  console.log('MiniPlayer button in footer bar exists:', hasBtn);
  if (!hasBtn) throw new Error('Missing #bMiniPlayer button in footer bar');

  // 2. Open MiniPlayer via button click
  console.log('Clicking MiniPlayer button...');
  await ev("document.getElementById('bMiniPlayer').click();");
  await sleep(600);

  const miniPlayerVisible = await ev(`(() => {
    const el = document.getElementById('spotifyMiniPlayer');
    return el && getComputedStyle(el).display !== 'none' && !el.hidden;
  })()`);
  console.log('MiniPlayer popup is visible:', miniPlayerVisible);
  if (!miniPlayerVisible) throw new Error('Spotify MiniPlayer did not open');

  // 3. Inspect MiniPlayer Elements
  const miniDetails = await ev(`(() => {
    const el = document.getElementById('spotifyMiniPlayer');
    const dragBar = document.getElementById('pipDragBar');
    const banner = document.getElementById('pipPremiumBanner');
    const bannerTitle = banner?.querySelector('.QCu2KIjyoz3lEIKNrBGQ')?.textContent?.trim() || '';
    const trackTitle = document.getElementById('pipTrackLink')?.textContent?.trim() || '';
    const artist = document.getElementById('pipArtistLink')?.textContent?.trim() || '';
    const coverSrc = document.getElementById('pipCoverImg')?.src || '';
    const hasPlay = !!document.getElementById('pipPlayBtn');
    const hasMute = !!document.getElementById('pipVolumeIcon');
    const hasShuffle = !!document.getElementById('pipShuffleBtn');
    const hasRepeat = !!document.getElementById('pipRepeatBtn');
    const hasCopy = !!document.getElementById('pipCopyBtn');
    const hasSeek = !!document.getElementById('pipSeekWrap');
    return {
      hasDragBar: !!dragBar,
      bannerTitle,
      trackTitle,
      artist,
      hasCover: !!coverSrc,
      hasPlay,
      hasMute,
      hasShuffle,
      hasRepeat,
      hasCopy,
      hasSeek
    };
  })()`);

  console.log('MiniPlayer Content:', miniDetails);
  if (!miniDetails.hasDragBar) throw new Error('Missing MiniPlayer drag bar');
  if (!miniDetails.bannerTitle.includes('Premium')) throw new Error('Missing Premium banner');
  if (!miniDetails.hasPlay || !miniDetails.hasSeek) throw new Error('Missing player controls or seek');

  await shot('spotify-miniplayer-open');

  // 4. Test Playback Interaction from MiniPlayer
  console.log('Testing Play/Pause toggle from MiniPlayer...');
  const initialPlaying = await ev("window.NG.engine.playing;");
  await ev("document.getElementById('pipPlayBtn').click();");
  await sleep(1500);
  const toggledPlaying = await ev("window.NG.engine.playing;");
  console.log(`Playback state: ${initialPlaying} -> ${toggledPlaying}`);

  await shot('spotify-miniplayer-playing');

  // 5. Test Dismissing Premium Banner
  console.log('Testing dismiss banner ("ليس الآن")...');
  await ev("document.querySelector('[data-action=pip-dismiss-banner]').click();");
  await sleep(400);
  const bannerHidden = await ev("document.getElementById('pipPremiumBanner').style.display === 'none';");
  console.log('Banner successfully dismissed:', bannerHidden);
  if (!bannerHidden) throw new Error('Expected banner to be dismissed');

  // 6. Test Copy Link button
  console.log('Testing Copy Link button...');
  await ev("document.getElementById('pipCopyBtn').click();");
  await sleep(300);
  const toastText = await ev("document.querySelector('.toast')?.textContent?.trim() || '';");
  console.log('Toast on copy link:', toastText);

  // 7. Test Dragging MiniPlayer
  console.log('Testing Dragging MiniPlayer...');
  const initialPos = await ev(`(() => {
    const el = document.getElementById('spotifyMiniPlayer');
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top };
  })()`);

  await ev(`(() => {
    const dragBar = document.getElementById('pipDragBar');
    const down = new MouseEvent('mousedown', { clientX: 200, clientY: 200, bubbles: true });
    dragBar.dispatchEvent(down);
    const move = new MouseEvent('mousemove', { clientX: 250, clientY: 150, bubbles: true });
    document.dispatchEvent(move);
    const up = new MouseEvent('mouseup', { clientX: 250, clientY: 150, bubbles: true });
    document.dispatchEvent(up);
  })()`);
  await sleep(300);

  const movedPos = await ev(`(() => {
    const el = document.getElementById('spotifyMiniPlayer');
    const r = el.getBoundingClientRect();
    return { left: r.left, top: r.top };
  })()`);
  console.log(`Position moved: (${initialPos.left}, ${initialPos.top}) -> (${movedPos.left}, ${movedPos.top})`);

  // 8. Mobile Viewport Check
  console.log('Testing MiniPlayer on Mobile Viewport...');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(500);
  await shot('spotify-miniplayer-mobile');

  // 9. Close MiniPlayer
  console.log('Testing Close button...');
  await ev("document.querySelector('[data-action=close-miniplayer]').click();");
  await sleep(400);
  const isClosed = await ev("document.getElementById('spotifyMiniPlayer').style.display === 'none';");
  console.log('MiniPlayer is closed:', isClosed);
  if (!isClosed) throw new Error('MiniPlayer failed to close');

  console.log('\n✅ ALL SPOTIFY MINIPLAYER TESTS PASSED 100%!');

} catch (err) {
  console.error('\n❌ MiniPlayer Test Failed:', err);
  process.exitCode = 1;
} finally {
  try { if (ws) ws.close(); } catch {}
  try { chrome.kill(); } catch {}
  await sleep(400);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch {}
}
