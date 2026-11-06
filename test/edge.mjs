/* Edge-case + breakpoint test. */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9334;
const FILE = 'file:///C:/Users/husso/Desktop/7ify/nagham-studio.html';
const PROFILE = 'C:\\Users\\husso\\AppData\\Local\\Temp\\nagham-chrome-edge';
const OUT = 'C:\\Users\\husso\\Desktop\\7ify\\shots';

try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--mute-audio', '--autoplay-policy=no-user-gesture-required', '--allow-file-access-from-files',
  '--window-size=1440,900', `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });

const errors = [];
const checks = [];
const check = (name, ok, info = '') => checks.push({ name, ok, info });

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

async function load() {
  await send('Page.navigate', { url: FILE });
  for (let i = 0; i < 80; i++) {
    if ((await ev('document.readyState')) === 'complete') break;
    await sleep(100);
  }
  await sleep(500);
}

try {
  await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const list = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = list.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id); pending.delete(m.id);
      if (m.error) p.rej(new Error(m.error.message)); else p.res(m.result);
      return;
    }
    if (m.method === 'Runtime.exceptionThrown') {
      const d = m.params.exceptionDetails;
      errors.push((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      errors.push(m.params.args.map((a) => a.value || a.description || '').join(' '));
    }
  };
  await send('Runtime.enable');
  await send('Page.enable');
  await load();

  // breakpoints
  await send('Emulation.setDeviceMetricsOverride', { width: 1024, height: 768, deviceScaleFactor: 1, mobile: false });
  await sleep(350);
  await shot('20-tablet-home');
  check('no overflow 1024', (await ev('document.documentElement.scrollWidth - innerWidth')) <= 0);
  check('rail visible at 1024', (await ev('getComputedStyle(document.querySelector(".rail")).display')) === 'flex');
  check('now panel hidden at 1024', (await ev('getComputedStyle(document.querySelector(".nowpanel")).display')) === 'none');

  await send('Emulation.setDeviceMetricsOverride', { width: 900, height: 760, deviceScaleFactor: 1, mobile: false });
  await sleep(300);
  check('rail hidden at 900', (await ev('getComputedStyle(document.querySelector(".rail")).display')) === 'none');
  check('tabbar visible at 900', (await ev('getComputedStyle(document.querySelector(".tabbar")).display')) === 'grid');

  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false });
  await sleep(350);
  await shot('21-wide-home');
  check('no overflow 1920', (await ev('document.documentElement.scrollWidth - innerWidth')) <= 0);
  check('now panel visible at 1920', (await ev('getComputedStyle(document.querySelector(".nowpanel")).display')) === 'flex');

  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await sleep(300);

  // keyboard: '?' opens shortcuts, Escape closes
  await ev('document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"?",shiftKey:true,bubbles:true,cancelable:true}))');
  await sleep(250);
  check('shortcut ? opens help', await ev('document.getElementById("shortcutsDlg").open'));
  check('focus inside dialog', await ev('document.getElementById("shortcutsDlg").contains(document.activeElement)'));
  await ev('document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",bubbles:true,cancelable:true}))');
  await sleep(200);
  check('escape closes help', !(await ev('document.getElementById("shortcutsDlg").open')));

  // '/' focuses search
  await ev('document.body.dispatchEvent(new KeyboardEvent("keydown",{key:"/",bubbles:true,cancelable:true}))');
  await sleep(200);
  check('slash focuses search', (await ev('document.activeElement.id')) === 'q');
  await ev('document.getElementById("q").blur()');

  // search hyphen normalization & quick suggestions
  check('search hyphen matches', (await ev('window.NG.searchTracks("ويجز - البخت").length')) > 0);
  await ev('document.querySelector("[data-nav=search]").click()');
  await sleep(200);
  check('quick search suggestions render', (await ev('document.querySelectorAll("#view-search .recent-chip").length')) > 0);

  // repeat / shuffle state
  await ev('document.querySelector("#bRepeat").click()');
  await ev('document.querySelector("#bRepeat").click()');
  await sleep(200);
  check('repeat one', (await ev('window.__nagham.state.repeat')) === 'one');
  check('repeat badge visible', await ev('!document.getElementById("repeatBadge").hidden'));
  await ev('document.querySelector("#bShuffle").click()');
  check('shuffle on', (await ev('window.__nagham.state.shuffle')) === true);

  // persist theme + accent + language, then reload
  await ev('document.querySelector("[data-nav=studio]").click()');
  await sleep(250);
  await ev('document.querySelector(`.theme-card[data-id=plum]`).click()');
  await ev('document.querySelector(`.accent-dot[data-id="#F472B6"]`).click()');
  await ev('document.querySelector(`.opt[data-action=lang-set][data-id=en]`).click()');
  await sleep(400);
  check('studio language switch', (await ev('document.documentElement.dir')) === 'ltr');
  await shot('22-studio-english-plum');
  await load();
  check('theme persists', (await ev('document.documentElement.dataset.theme')) === 'plum');
  check('accent persists', (await ev('getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()')) === '#F472B6');
  check('language persists', (await ev('document.documentElement.dir')) === 'ltr');
  check('repeat persists', (await ev('window.__nagham.state.repeat')) === 'one');

  // local audio import through the real file input
  await send('DOM.enable');
  const doc = await send('DOM.getDocument', { depth: -1, pierce: true });
  const inputNode = await send('DOM.querySelector', { nodeId: doc.root.nodeId, selector: '#fileInput' });
  await send('DOM.setFileInputFiles', { nodeId: inputNode.nodeId, files: ['C:\\Users\\husso\\Desktop\\7ify\\test\\tone.wav'] });
  await sleep(1400);
  check('local file plays', (await ev('window.__nagham.state.trackId')).startsWith('local'));
  check('local duration read', (await ev('document.getElementById("pDur").textContent')) !== '0:00');
  check('player shows local file', (await ev('document.getElementById("pTitle").textContent')) === 'tone');
  check('no audio error toast', (await ev('document.querySelectorAll(".toast").length')) < 3);
  await shot('25-local-file');

  // paper home
  await ev('document.querySelector("[data-nav=studio]").click()');
  await sleep(250);
  await ev('document.querySelector(`.theme-card[data-id=paper]`).click()');
  await sleep(250);
  await ev('document.querySelector("[data-nav=home]").click()');
  await sleep(400);
  await shot('23-paper-home');

  // reset restores defaults
  await ev('document.querySelector("[data-nav=studio]").click()');
  await sleep(250);
  await ev('document.querySelector("[data-action=reset-open]").click()');
  await sleep(250);
  await ev('document.querySelector("[data-action=reset-confirm]").click()');
  await sleep(500);
  check('reset theme', (await ev('document.documentElement.dataset.theme')) === 'ink');
  check('reset language', (await ev('document.documentElement.dir')) === 'rtl');
  check('reset accent', (await ev('getComputedStyle(document.documentElement).getPropertyValue("--accent").trim()')) === '#1ED760');
  check('reset playlists', (await ev('window.__nagham.state.playlists.length')) === 5);

  await ev('document.querySelector("[data-nav=home]").click()');
  await sleep(250);
  await ev('document.querySelector(".stage-scroll").scrollTop = 620');
  await sleep(350);
  await shot('26-home-rows');
  await ev('document.querySelector("[data-nav=library]").click()');
  await sleep(250);
  await ev('document.querySelector("[data-action=library-tab][data-tab=artists]").click()');
  await sleep(300);
  await shot('27-library-artists');

  // mobile sheet lyrics + paper
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(300);
  await ev('document.querySelector("[data-nav=home]").click()');
  await ev('document.getElementById("pTitleBtn").click()');
  await sleep(300);
  await ev('document.querySelector("[data-action=sheet-tab][data-tab=lyrics]").click()');
  await sleep(300);
  await shot('24-mobile-sheet-lyrics');
  await ev('document.getElementById("sheet").close()');
  await send('Emulation.setDeviceMetricsOverride', { width: 320, height: 640, deviceScaleFactor: 1, mobile: true });
  await sleep(350);
  await ev('document.querySelector("[data-nav=home]").click()');
  await sleep(300);
  check('no overflow at 320', (await ev('document.documentElement.scrollWidth - innerWidth')) <= 0);
  await shot('28-mobile-320');
  await send('Emulation.clearDeviceMetricsOverride');

  console.log('\nCHECKS');
  let failed = 0;
  for (const c of checks) { if (!c.ok) failed++; console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + (c.ok ? '' : '  << ' + c.info)); }
  console.log(`\n${checks.length - failed}/${checks.length} passed; runtime errors: ${errors.length}`);
  if (errors.length) console.log(errors.join('\n'));
} catch (err) {
  console.error('HARNESS ERROR', err.message);
  console.log('PAGE ERRORS:\n' + errors.join('\n'));
  console.log(checks.map((c) => (c.ok ? 'PASS ' : 'FAIL ') + c.name).join('\n'));
} finally {
  try { if (ws) ws.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(500);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* ignore */ }
}
