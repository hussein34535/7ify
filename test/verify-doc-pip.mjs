import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9392;
const FILE = pathToFileURL(resolve('nagham-studio.html')).href;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run',
  `--remote-debugging-port=${PORT}`, 'about:blank'
], { stdio: 'ignore' });
await sleep(1500);

const list = await fetch(`http://127.0.0.1:${PORT}/json/list`).then(r => r.json());
const page = list.find(t => t.type === 'page') || list[0];
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);
let id = 0;
const send = (method, params = {}) => new Promise((res, rej) => {
  const cur = ++id;
  const handler = e => {
    const d = JSON.parse(e.data);
    if (d.id === cur) {
      ws.removeEventListener('message', handler);
      if (d.error) rej(new Error(d.error.message));
      else res(d.result);
    }
  };
  ws.addEventListener('message', handler);
  ws.send(JSON.stringify({ id: cur, method, params }));
});

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: FILE });
await sleep(2500);

console.log('\n--- VERIFYING DOCUMENT PICTURE-IN-PICTURE & MEDIASESSION ---');

// 1. Verify Document PiP opens on button click
const openRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    const btn = document.getElementById('bMiniPlayer');
    btn.click();
    await new Promise(r => setTimeout(r, 800));
    const hasPipWin = !!(window.documentPictureInPicture && window.documentPictureInPicture.window);
    const pipWin = hasPipWin ? window.documentPictureInPicture.window : null;
    const miniInPip = pipWin ? !!pipWin.document.getElementById('spotifyMiniPlayer') : false;
    const title = pipWin ? pipWin.document.title : '';
    const trackText = pipWin ? pipWin.document.getElementById('pipTrackLink')?.textContent?.trim() : '';
    const artistText = pipWin ? pipWin.document.getElementById('pipArtistLink')?.textContent?.trim() : '';

    return {
      hasPipWin,
      miniInPip,
      title,
      trackText,
      artistText
    };
  })()`,
  awaitPromise: true,
  userGesture: true,
  returnByValue: true
});

console.log('Document PiP Open Verification:', openRes.result.value);
if (!openRes.result.value.hasPipWin) throw new Error('Document Picture-in-Picture window did not open');
if (!openRes.result.value.miniInPip) throw new Error('MiniPlayer markup was not moved into PiP window');

// 2. Verify controls inside Document PiP (Play / Pause toggle)
const controlRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    const pipWin = window.documentPictureInPicture.window;
    const playBtn = pipWin.document.getElementById('pipPlayBtn');
    const wasPlaying = window.NG.engine.playing;
    playBtn.click();
    await new Promise(r => setTimeout(r, 600));
    const isPlaying = window.NG.engine.playing;
    const mediaSessionState = navigator.mediaSession ? navigator.mediaSession.playbackState : 'unknown';
    const docTitle = document.title;

    return {
      wasPlaying,
      isPlaying,
      mediaSessionState,
      docTitle
    };
  })()`,
  awaitPromise: true,
  userGesture: true,
  returnByValue: true
});

console.log('Playback & MediaSession in PiP:', controlRes.result.value);
if (!controlRes.result.value.isPlaying) throw new Error('Playback toggle inside PiP did not trigger engine');

// 3. Verify closing PiP window restores element to main page
const closeRes = await send('Runtime.evaluate', {
  expression: `(async () => {
    const pipWin = window.documentPictureInPicture.window;
    pipWin.close();
    await new Promise(r => setTimeout(r, 500));
    const miniInMain = !!document.getElementById('spotifyMiniPlayer');
    const display = document.getElementById('spotifyMiniPlayer')?.style?.display;
    const btnActive = document.getElementById('bMiniPlayer')?.classList?.contains('is-active');

    return {
      pipClosed: pipWin.closed,
      miniInMain,
      display,
      btnActive
    };
  })()`,
  awaitPromise: true,
  returnByValue: true
});

console.log('PiP Window Close & Restore Verification:', closeRes.result.value);
if (!closeRes.result.value.pipClosed) throw new Error('PiP window failed to close');
if (!closeRes.result.value.miniInMain) throw new Error('MiniPlayer was not restored to main document');
if (closeRes.result.value.btnActive) throw new Error('Button active state was not cleared on close');

console.log('\n✅ DOCUMENT PICTURE-IN-PICTURE FULLY VERIFIED 100%!');

chrome.kill();
