import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9345;
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=' + PORT, 'about:blank'
], { stdio: 'ignore' });

await sleep(1000);
const list = await fetch('http://127.0.0.1:' + PORT + '/json/list').then(r=>r.json());
const page = list.find(t => t.type === 'page') || list[0];
const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);

await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

let seq = 0;
const pending = new Map();
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
  }
};

const send = (method, params = {}) => new Promise((res, rej) => {
  const id = ++seq;
  pending.set(id, { res, rej });
  ws.send(JSON.stringify({ id, method, params }));
});

await send('Runtime.enable');
await send('Page.enable');
await send('Page.navigate', { url: 'http://127.0.0.1:8787/nagham-studio.html' });
await sleep(2500);

// Click play on home hero
await send('Runtime.evaluate', { expression: 'document.querySelector(".hero-play").click()' });
await sleep(3000);

const homePlayState = await send('Runtime.evaluate', {
  expression: `
    JSON.stringify({
      title: document.getElementById('pTitle')?.textContent,
      dur: document.getElementById('pDur')?.textContent,
      playing: window.NG.engine.playing,
      ytActive: window.NG.engine._ytActive,
      ytId: window.NG.engine.track?.ytId
    })
  `,
  returnByValue: true
});

console.log('HOME HERO PLAY STATE:');
console.log(JSON.parse(homePlayState?.result?.value || '{}'));

// Search Adele and click
await send('Runtime.evaluate', {
  expression: `
    new Promise((resolve) => {
      const q = document.getElementById('q');
      q.value = 'Adele Hello';
      q.dispatchEvent(new Event('input', { bubbles: true }));
      setTimeout(() => {
        const top = document.querySelector('#view-search .top-result');
        if (top) top.click();
        resolve(true);
      }, 1800);
    });
  `,
  awaitPromise: true
});

await sleep(3500);

const adelePlayState = await send('Runtime.evaluate', {
  expression: `
    JSON.stringify({
      title: document.getElementById('pTitle')?.textContent,
      dur: document.getElementById('pDur')?.textContent,
      playing: window.NG.engine.playing,
      ytActive: window.NG.engine._ytActive,
      ytId: window.NG.engine.track?.ytId
    })
  `,
  returnByValue: true
});

console.log('\nADELE PLAY STATE:');
console.log(JSON.parse(adelePlayState?.result?.value || '{}'));

ws.close();
chrome.kill();
