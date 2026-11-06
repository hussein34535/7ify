import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  '--remote-debugging-port=9348', 'about:blank'
], { stdio: 'ignore' });

await sleep(1000);
const list = await fetch('http://127.0.0.1:9348/json/list').then(r=>r.json());
const page = list.find(t => t.type === 'page') || list[0];
const ws = new globalThis.WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.onopen = r);

let seq = 0;
const pending = new Map();
const logs = [];
const errors = [];

ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) {
    const p = pending.get(m.id); pending.delete(m.id);
    if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
  }
  if (m.method === 'Runtime.consoleAPICalled') {
    logs.push('[console.' + m.params.type + '] ' + m.params.args.map(a => a.value || a.description).join(' '));
  }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push('[exception] ' + m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
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
await sleep(3000);

const playRes = await send('Runtime.evaluate', {
  expression: `
    new Promise((resolve) => {
      const e = window.NG.engine;
      let states = [];
      e._ytPlayer.addEventListener('onStateChange', (ev) => {
        states.push(ev.data);
      });
      e._ytPlayer.addEventListener('onError', (ev) => {
        states.push('error:' + ev.data);
      });
      e._ytPlayer.loadVideoById('EgmXTmj62ic');
      setTimeout(() => {
        resolve({
          states,
          stateNow: e._ytPlayer.getPlayerState ? e._ytPlayer.getPlayerState() : null
        });
      }, 4000);
    })
  `,
  awaitPromise: true,
  returnByValue: true
});

console.log('PLAY RES:', playRes?.result?.value);
console.log('LOGS AFTER PLAY:', logs);
console.log('ERRORS AFTER PLAY:', errors);

ws.close();
chrome.kill();
