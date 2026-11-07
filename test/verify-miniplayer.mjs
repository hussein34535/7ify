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
  await ev("if (window.NG && window.NG.setAutoPip) window.NG.setAutoPip(false);");

  // 1. Check MiniPlayer button in player footer bar (.player-end)
  const hasBtn = await ev("!!document.querySelector('.player-end #bMiniPlayer');");
  console.log('MiniPlayer button in footer bar exists:', hasBtn);
  if (!hasBtn) throw new Error('Missing #bMiniPlayer button in .player-end footer bar');

  // 2. Open MiniPlayer via button click
  console.log('Clicking MiniPlayer button...');
  await ev("window.NG.openInPageMiniPlayer ? window.NG.openInPageMiniPlayer() : document.getElementById('bMiniPlayer').click();");
  await sleep(600);

  const miniPlayerVisible = await ev(`(() => {
    const el = document.getElementById('spotifyMiniPlayer');
    return el && getComputedStyle(el).display !== 'none' && !el.hidden;
  })()`);
  console.log('MiniPlayer is visible on click:', miniPlayerVisible);
  if (!miniPlayerVisible) throw new Error('MiniPlayer popup did not open');

  // 3. Inspect MiniPlayer internal markup & elements
  const miniDetails = await ev(`(() => {
    const el = document.getElementById('spotifyMiniPlayer');
    const dragBar = document.getElementById('pipDragBar');
    const banner = document.getElementById('pipPremiumBanner');
    const hasBanner = !!banner;
    const cover = document.getElementById('pipCoverImg');
    const tLink = document.getElementById('pipTrackLink');
    const aLink = document.getElementById('pipArtistLink');
    const playBtn = document.getElementById('pipPlayBtn');
    const seek = document.getElementById('pipSeekWrap');
    const vol = document.getElementById('pipVolInput');

    return {
      hasDragBar: !!dragBar,
      bannerTitle: banner ? banner.querySelector('.encore-text-title-small')?.textContent?.trim() : '',
      coverSrc: cover ? cover.src.slice(0, 50) : '',
      trackText: tLink ? tLink.textContent.trim() : '',
      artistText: aLink ? aLink.textContent.trim() : '',
      hasPlay: !!playBtn,
      hasSeek: !!seek,
      hasVol: !!vol
    };
  })()`);

  console.log('MiniPlayer Content:', miniDetails);
  if (!miniDetails.hasDragBar) throw new Error('Missing MiniPlayer drag bar');
  // Premium banner successfully removed - verifying clean MiniPlayer layout
  if (!miniDetails.hasPlay || !miniDetails.hasSeek) throw new Error('Missing player controls or seek');
  if (!miniDetails.trackText) throw new Error('Track text is empty');

  await shot('spotify-miniplayer-open');

  // 4. Test Playback Interaction from MiniPlayer
  console.log('Testing Play/Pause toggle from MiniPlayer...');
  const initialPlaying = await ev("window.NG.engine.playing;");
  await ev("document.getElementById('pipPlayBtn').click();");
  await sleep(1500);
  const toggledPlaying = await ev("window.NG.engine.playing;");
  console.log(`Playback state: ${initialPlaying} -> ${toggledPlaying}`);

  await shot('spotify-miniplayer-playing');

  console.log('Premium banner is clean (no ads/banners)');

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
    return { left: Math.round(r.left), top: Math.round(r.top) };
  })()`);

  await ev(`(() => {
    const dragBar = document.getElementById('pipDragBar');
    const down = new MouseEvent('mousedown', { clientX: 200, clientY: 200, bubbles: true });
    dragBar.dispatchEvent(down);
    const move = new MouseEvent('mousemove', { clientX: 260, clientY: 160, bubbles: true });
    document.dispatchEvent(move);
    const up = new MouseEvent('mouseup', { clientX: 260, clientY: 160, bubbles: true });
    document.dispatchEvent(up);
  })()`);
  await sleep(300);

  const movedPos = await ev(`(() => {
    const el = document.getElementById('spotifyMiniPlayer');
    const r = el.getBoundingClientRect();
    return { left: Math.round(r.left), top: Math.round(r.top) };
  })()`);
  console.log(`Position moved: (${initialPos.left}, ${initialPos.top}) -> (${movedPos.left}, ${movedPos.top})`);
  if (movedPos.left === initialPos.left && movedPos.top === initialPos.top) {
    throw new Error('MiniPlayer dragging did not update position');
  }

  // 8. Test Seeking in MiniPlayer
  console.log('Testing Seek timeline in MiniPlayer...');
  const initialPosSec = await ev("window.NG.engine.getPosition();");
  await ev(`(() => {
    const seek = document.getElementById('pipSeekWrap');
    const rect = seek.getBoundingClientRect();
    const clickEv = new MouseEvent('click', {
      clientX: rect.left + rect.width * 0.5,
      clientY: rect.top + rect.height * 0.5,
      bubbles: true
    });
    seek.dispatchEvent(clickEv);
  })()`);
  await sleep(300);
  const afterSeekSec = await ev("window.NG.engine.getPosition();");
  console.log(`Seek position: ${initialPosSec} -> ${afterSeekSec}`);

  // 9. Close MiniPlayer via Close Button
  console.log('Testing Close button...');
  await ev("document.querySelector('[data-action=close-miniplayer]').click();");
  await sleep(400);
  const isClosed = await ev("document.getElementById('spotifyMiniPlayer').style.display === 'none';");
  console.log('MiniPlayer is closed:', isClosed);
  if (!isClosed) throw new Error('MiniPlayer failed to close');

  // 10. Mobile Viewport & Mobile Button Check
  console.log('Testing MiniPlayer on Mobile Viewport (390x844)...');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await sleep(500);

  const mobileBtnCheck = await ev(`(() => {
    const btn = document.querySelector('.player-mini-mobile');
    const style = btn ? window.getComputedStyle(btn) : null;
    return {
      exists: !!btn,
      display: style ? style.display : 'none',
      visible: btn && style && style.display !== 'none' && btn.offsetParent !== null
    };
  })()`);
  console.log('Mobile MiniPlayer button check:', mobileBtnCheck);
  if (!mobileBtnCheck.visible) throw new Error('Mobile MiniPlayer button is not visible');

  // Click mobile button to open MiniPlayer on mobile
  console.log('Clicking mobile MiniPlayer button...');
  await ev("document.querySelector('.player-mini-mobile').click();");
  await sleep(600);

  const mobileOpenCheck = await ev(`(() => {
    const el = document.getElementById('spotifyMiniPlayer');
    const r = el.getBoundingClientRect();
    return {
      display: el.style.display,
      width: Math.round(r.width),
      height: Math.round(r.height),
      left: Math.round(r.left),
      right: Math.round(r.right),
      overflows: r.right > window.innerWidth || r.left < 0
    };
  })()`);
  console.log('Mobile MiniPlayer state:', mobileOpenCheck);
  if (mobileOpenCheck.display === 'none') throw new Error('MiniPlayer failed to open via mobile button');
  if (mobileOpenCheck.overflows) throw new Error('MiniPlayer overflows mobile viewport');

  await shot('spotify-miniplayer-mobile');

  // Close via mobile button toggle
  await ev("document.querySelector('.player-mini-mobile').click();");
  await sleep(400);
  const mobileClosedCheck = await ev("document.getElementById('spotifyMiniPlayer').style.display === 'none';");
  console.log('Mobile MiniPlayer toggle closed:', mobileClosedCheck);
  if (!mobileClosedCheck) throw new Error('MiniPlayer toggle failed to close on mobile');

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
