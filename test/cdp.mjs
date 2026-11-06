/* Headless Chrome smoke test over CDP (no deps). */
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';

const CHROME = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const PORT = 9333;
const FILE = 'file:///C:/Users/husso/Desktop/7ify/nagham-studio.html';
const PROFILE = 'C:\\Users\\husso\\AppData\\Local\\Temp\\nagham-chrome-profile';
const OUT = 'C:\\Users\\husso\\Desktop\\7ify\\shots';

rmSync(PROFILE, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--disable-extensions', '--mute-audio', '--autoplay-policy=no-user-gesture-required',
  '--allow-file-access-from-files', '--window-size=1440,900',
  `--user-data-dir=${PROFILE}`, `--remote-debugging-port=${PORT}`, 'about:blank'
], { stdio: 'ignore', windowsHide: true });

const errors = [];
const logs = [];

async function waitJson(url, tries = 60) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.json();
    } catch { /* retry */ }
    await sleep(200);
  }
  throw new Error('devtools not ready');
}

let ws;
let seq = 0;
const pending = new Map();

function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });
}

async function evaluate(expression) {
  const res = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (res.exceptionDetails) {
    const msg = res.exceptionDetails.exception && res.exceptionDetails.exception.description;
    throw new Error('page exception: ' + (msg || res.exceptionDetails.text));
  }
  return res.result.value;
}

async function shot(name) {
  const res = await send('Page.captureScreenshot', { format: 'png', fromSurface: true });
  writeFileSync(`${OUT}\\${name}.png`, Buffer.from(res.data, 'base64'));
}

const checks = [];
function check(name, ok, info = '') { checks.push({ name, ok, info }); }

try {
  const version = await waitJson(`http://127.0.0.1:${PORT}/json/version`);
  const list = await waitJson(`http://127.0.0.1:${PORT}/json/list`);
  const page = list.find((t) => t.type === 'page');
  ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(msg.error.message));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      errors.push((d.exception && (d.exception.description || d.exception.value)) || d.text);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push('console.error: ' + msg.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') {
      logs.push(msg.params.entry.text + ' ' + (msg.params.entry.url || ''));
    }
  };

  await send('Runtime.enable');
  await send('Log.enable');
  await send('Page.enable');
  await send('Page.navigate', { url: FILE });

  for (let i = 0; i < 80; i++) {
    const ready = await evaluate('document.readyState');
    if (ready === 'complete') break;
    await sleep(100);
  }
  await sleep(600);

  check('app booted', await evaluate('!!document.querySelector("#view-home .hero")'));
  const dupIds = await evaluate(`(()=>{const m={};document.querySelectorAll('[id]').forEach(e=>{m[e.id]=(m[e.id]||0)+1});return JSON.stringify(Object.keys(m).filter(k=>m[k]>1))})()`);
  check('no duplicate ids', dupIds === '[]', dupIds);
  const missingAr = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-i18n]')].filter(e=>e.textContent.trim()===e.dataset.i18n).map(e=>e.dataset.i18n))`);
  check('all static i18n keys resolve (ar)', missingAr === '[]', missingAr);
  const brokenLabels = await evaluate(`JSON.stringify([...document.querySelectorAll('[aria-labelledby]')].filter(e=>!e.getAttribute('aria-labelledby').split(' ').every(id=>document.getElementById(id))).map(e=>e.id))`);
  check('aria-labelledby targets exist', brokenLabels === '[]', brokenLabels);
  check('genre chips', (await evaluate('document.querySelectorAll("#genreChips .chip").length')) === 7);
  check('no page errors after boot', errors.length === 0, errors.join(' | '));

  const names = await evaluate(`JSON.stringify([...document.querySelectorAll('button')].filter(b=>!(b.textContent||'').trim() && !b.getAttribute('aria-label')).map(b=>b.outerHTML.slice(0,90)))`);
  check('all buttons named', JSON.parse(names).length === 0, names);

  await evaluate('document.querySelector(".hero-play").click()');
  await sleep(700);
  check('play starts', (await evaluate('document.querySelector("#pPlayIcon use").getAttribute("href")')) === '#i-pause');
  check('duration shown', (await evaluate('document.getElementById("pDur").textContent')) === '3:48');
  const energy = await evaluate('(()=>{const e=window.NG.engine;const d=e.levels();if(!d)return -1;let s=0;for(let i=0;i<24;i++)s+=d[i];return s;})()');
  check('synth produces signal', energy > 0, String(energy));
  await shot('01-home-desktop');

  await evaluate('document.querySelector("[data-action=next]").click()');
  await sleep(500);
  check('next changes track', (await evaluate('document.getElementById("pTitle").textContent')).includes('سراب'));

  await evaluate(`
    const q = document.getElementById('q');
    q.value = 'عمرو';
    q.dispatchEvent(new Event('input', {bubbles:true}));
  `);
  await sleep(300);
  check('search opens', await evaluate('!document.getElementById("view-search").hidden'));
  check('search finds Amr Diab', (await evaluate('document.querySelectorAll("#view-search .rows .row").length')) > 0);
  await shot('02-search');

  await evaluate('document.querySelector("#view-search [data-action=clear-search]").click()');
  await sleep(200);
  check('search cleared', (await evaluate('document.getElementById("q").value')) === '');

  await evaluate('document.querySelector("[data-nav=library]").click()');
  await sleep(300);
  check('library view', await evaluate('!document.getElementById("view-library").hidden'));
  await shot('03-library');

  await evaluate('document.querySelector("[data-action=library-tab][data-tab=liked]").click()');
  await sleep(200);
  const favRows = await evaluate('document.querySelectorAll("#view-library .rows .row").length');
  check('liked rows match favorites', favRows === 4, String(favRows));

  await evaluate('document.querySelector("[data-nav=studio]").click()');
  await sleep(300);
  check('studio themes', (await evaluate('document.querySelectorAll(".theme-card").length')) === 6);
  await evaluate('document.querySelector(`.theme-card[data-id=paper]`).click()');
  await sleep(250);
  check('paper theme applied', (await evaluate('document.documentElement.dataset.theme')) === 'paper');
  check('paper contrast token', (await evaluate('getComputedStyle(document.documentElement).getPropertyValue("--accent-text").trim()')).startsWith('#'));
  await shot('04-studio-paper');
  await evaluate('document.querySelector(`.theme-card[data-id=ink]`).click()');
  await sleep(250);

  await evaluate('document.getElementById("langBtn").click()');
  await sleep(400);
  check('language switch', (await evaluate('document.documentElement.dir')) === 'ltr');
  check('english nav', (await evaluate('document.querySelector("[data-nav=home]").textContent.trim()')) === 'Home');
  const missingEn = await evaluate(`JSON.stringify([...document.querySelectorAll('[data-i18n]')].filter(e=>e.textContent.trim()===e.dataset.i18n).map(e=>e.dataset.i18n))`);
  check('all static i18n keys resolve (en)', missingEn === '[]', missingEn);
  await shot('05-english-studio');
  await evaluate('document.getElementById("langBtn").click()');
  await sleep(400);
  check('back to arabic', (await evaluate('document.documentElement.dir')) === 'rtl');

  await evaluate('document.querySelector("[data-nav=home]").click()');
  await sleep(200);
  await evaluate('document.getElementById("pTitleBtn").click()');
  await sleep(400);
  check('sheet opens', await evaluate('document.getElementById("sheet").open'));
  await shot('06-sheet');
  await evaluate('document.querySelector("[data-action=sheet-tab][data-tab=lyrics]").click()');
  await sleep(250);
  check('sheet lyrics', (await evaluate('document.querySelectorAll("#sheetPanel .lyric").length')) > 0);
  await shot('07-sheet-lyrics');
  await evaluate('document.querySelector("[data-action=sheet-tab][data-tab=queue]").click()');
  await sleep(200);
  const qBefore = await evaluate('window.__nagham.state.queue.length');
  await evaluate('document.querySelector("#sheetPanel .q-remove").click()');
  await sleep(250);
  const qAfter = await evaluate('window.__nagham.state.queue.length');
  check('queue remove works', qAfter === qBefore - 1, `${qBefore}->${qAfter}`);
  await evaluate('document.getElementById("sheet").close()');
  await sleep(200);

  await evaluate('document.getElementById("pLike").click()');
  await sleep(250);
  const likedNow = await evaluate('document.getElementById("pLike").getAttribute("aria-pressed")');
  await evaluate('document.getElementById("pLike").click()');
  await sleep(200);
  check('like toggles', likedNow === 'true');

  await evaluate('document.getElementById("pSeek").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true,cancelable:true}))');
  await sleep(200);
  check('seek keyboard', (await evaluate('document.getElementById("pCur").textContent')) !== '0:00');

  await evaluate('document.querySelector("[data-action=new-playlist]").click()');
  await sleep(250);
  check('new playlist dialog', await evaluate('document.getElementById("newPlDlg").open'));
  await evaluate('document.getElementById("newPlName").value = "اختبار"');
  await evaluate('document.getElementById("newPlForm").requestSubmit()');
  await sleep(300);
  check('playlist created', (await evaluate('window.__nagham.state.playlists[0].name.ar')) === 'اختبار');
  await shot('08-library-after-playlist');

  // layout / overflow checks
  const overflow = await evaluate(`JSON.stringify({
    doc: document.documentElement.scrollWidth - window.innerWidth,
    stage: (()=>{const s=document.querySelector('.stage-scroll'); return s.scrollWidth - s.clientWidth;})(),
    top: (()=>{const t=document.querySelector('.topbar'); return t.scrollWidth - t.clientWidth;})()
  })`);
  check('no horizontal overflow (desktop)', JSON.parse(overflow).doc <= 0 && JSON.parse(overflow).stage <= 0, overflow);

  check('no runtime errors (desktop)', errors.length === 0, errors.slice(0, 4).join(' | '));

  // extra visual states
  await evaluate(`document.getElementById('q').value='ال';document.getElementById('q').dispatchEvent(new Event('input',{bubbles:true}));`);
  await sleep(300);
  await shot('12-search-multi');
  await evaluate(`document.getElementById('q').value='zzzzzz';document.getElementById('q').dispatchEvent(new Event('input',{bubbles:true}));`);
  await sleep(300);
  await shot('13-search-empty');
  await evaluate('document.querySelector("#view-search [data-action=clear-search]").click()');
  await evaluate('document.querySelector("[data-nav=library]").click()');
  await sleep(200);
  await evaluate('document.querySelector("[data-action=library-tab][data-tab=liked]").click()');
  await sleep(250);
  await shot('14-liked');
  await evaluate('document.querySelector("[data-action=shortcuts]").click()');
  await sleep(250);
  await shot('15-shortcuts');
  await evaluate('document.getElementById("shortcutsDlg").close()');

  // mobile
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(400);
  await evaluate('document.querySelector("[data-nav=home]").click()');
  await sleep(300);
  await evaluate('document.querySelector(".stage-scroll").scrollTop = 0');
  await shot('09-home-mobile');
  const mOverflow = await evaluate('document.documentElement.scrollWidth - window.innerWidth');
  check('no horizontal overflow (mobile)', mOverflow <= 0, String(mOverflow));
  check('mobile tabbar visible', (await evaluate('getComputedStyle(document.querySelector(".tabbar")).display')) === 'grid');
  check('mobile rail hidden', (await evaluate('getComputedStyle(document.querySelector(".rail")).display')) === 'none');
  console.log('TOPBAR', await evaluate(`JSON.stringify([...document.querySelector('.topbar').children].map(c=>{const r=c.getBoundingClientRect();return {c:c.className,x:Math.round(r.x),w:Math.round(r.width)}}))`));
  console.log('JUMP', await evaluate(`JSON.stringify([...document.querySelector('.jump').children].map(c=>{const r=c.getBoundingClientRect();return [c.className.slice(0,18),Math.round(r.left),Math.round(r.width)]}))`));

  await evaluate('document.querySelector(".hero-play").click()');
  await sleep(400);
  await evaluate('document.getElementById("pTitleBtn").click()');
  await sleep(400);
  await shot('10-sheet-mobile');
  await evaluate('document.getElementById("sheet").close()');
  await sleep(200);
  await shot('11-home-mobile-playing');

  await evaluate('document.querySelector("[data-nav=library]").click()');
  await sleep(300);
  await shot('16-mobile-library');
  await evaluate('document.querySelector("[data-nav=studio]").click()');
  await sleep(300);
  await evaluate('document.querySelector(`.theme-card[data-id=paper]`).click()');
  await sleep(300);
  await shot('17-mobile-paper-studio');
  await evaluate('document.querySelector(`.theme-card[data-id=ink]`).click()');
  await sleep(200);
  await evaluate('document.querySelector("[data-nav=search]").click()');
  await sleep(300);
  await shot('18-mobile-search-empty');
  await evaluate(`document.getElementById('q').value='فيروز';document.getElementById('q').dispatchEvent(new Event('input',{bubbles:true}));`);
  await sleep(300);
  await shot('19-mobile-search');

  await send('Emulation.clearDeviceMetricsOverride');

  console.log('\nCHECKS');
  let failed = 0;
  for (const c of checks) {
    if (!c.ok) failed++;
    console.log((c.ok ? 'PASS ' : 'FAIL ') + c.name + (c.ok ? '' : '  << ' + c.info));
  }
  if (logs.filter(Boolean).length) {
    console.log('\nNETWORK/LOG ERRORS');
    [...new Set(logs)].slice(0, 12).forEach((l) => console.log(' - ' + l));
  }
  console.log(`\n${checks.length - failed}/${checks.length} passed; runtime errors: ${errors.length}`);
  if (errors.length) console.log(errors.join('\n'));
} catch (err) {
  console.error('HARNESS ERROR', err.message);
  try { console.log('PAGE ERRORS:\n' + errors.join('\n')); } catch { /* ignore */ }
  try { console.log('CHECKS SO FAR:\n' + checks.map((c) => (c.ok ? 'PASS ' : 'FAIL ') + c.name + ' ' + c.info).join('\n')); } catch { /* ignore */ }
  try { console.log('HOME LEN', await evaluate('document.getElementById("view-home").innerHTML.length')); } catch { /* ignore */ }
  try { console.log('HOME HEAD', await evaluate('document.getElementById("view-home").innerHTML.slice(0,180)')); } catch { /* ignore */ }
  try { console.log('BODY', await evaluate('document.body.className + " | " + document.querySelectorAll("[data-view-section]").length')); } catch { /* ignore */ }
} finally {
  try { if (ws) ws.close(); } catch { /* ignore */ }
  chrome.kill();
  await sleep(600);
  try { rmSync(PROFILE, { recursive: true, force: true }); } catch { /* chrome may still hold files */ }
}
