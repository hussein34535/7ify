import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const appPath = resolve(here, '..', '..', 'src', 'app.js');
const uiPath = resolve(here, '..', '..', 'src', 'ui.js');
const appCode = readFileSync(appPath, 'utf8');
const uiCode = readFileSync(uiPath, 'utf8');

export function loadAppInstance(initialStorage = {}, options = {}) {
  const store = new Map(Object.entries(initialStorage));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  const sessionStore = new Map();
  const sessionStorage = {
    getItem: (k) => (sessionStore.has(k) ? sessionStore.get(k) : null),
    setItem: (k, v) => sessionStore.set(k, String(v)),
    removeItem: (k) => sessionStore.delete(k),
    clear: () => sessionStore.clear()
  };

  class MockAudio {
    constructor() {
      this.src = '';
      this.currentTime = 0;
      this.duration = NaN;
      this.paused = true;
      this._handlers = new Map();
    }
    setAttribute() {}
    removeAttribute() {}
    addEventListener(ev, fn) {
      if (!this._handlers.has(ev)) this._handlers.set(ev, []);
      this._handlers.get(ev).push(fn);
    }
    removeEventListener(ev, fn) {
      if (!this._handlers.has(ev)) return;
      this._handlers.set(ev, this._handlers.get(ev).filter(f => f !== fn));
    }
    trigger(ev, data = {}) {
      const fns = this._handlers.get(ev) || [];
      fns.forEach(fn => fn(data));
    }
    play() {
      this.paused = false;
      this.trigger('play');
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
      this.trigger('pause');
    }
    load() {}
  }

  const listeners = new Map();
  const windowObj = {
    location: {
      origin: 'https://7ify.test',
      pathname: '/',
      search: '',
      href: 'https://7ify.test/'
    },
    history: {
      replaceState: () => {}
    },
    ...(options.window || {})
  };

  const context = {
    window: windowObj,
    document: {
      readyState: options.readyState || 'loading',
      documentElement: {
        setAttribute: () => {},
        getAttribute: () => null,
        removeAttribute: () => {},
        style: { setProperty: () => {}, getPropertyValue: () => '' },
        classList: { add: () => {}, remove: () => {}, toggle: () => {}, contains: () => false }
      },
      createElement: (tag) => {
        if (tag === 'audio') return new MockAudio();
        return {
          setAttribute: () => {},
          appendChild: () => {},
          parentNode: null
        };
      },
      head: { appendChild: () => {}, removeChild: () => {} },
      body: { appendChild: () => {}, removeChild: () => {} },
      getElementById: (id) => (options.elements && options.elements[id]) || null,
      querySelector: (sel) => {
        if (!options.elements) return null;
        const key = sel.replace(/^[#.]/, '');
        return options.elements[key] || options.elements[sel] || null;
      },
      querySelectorAll: (sel) => {
        if (options.querySelectorAll) return options.querySelectorAll(sel);
        return [];
      },
      addEventListener: (ev, fn) => {
        if (!listeners.has(ev)) listeners.set(ev, []);
        listeners.get(ev).push(fn);
      },
      removeEventListener: (ev, fn) => {
        if (!listeners.has(ev)) return;
        listeners.set(ev, listeners.get(ev).filter(f => f !== fn));
      }
    },
    localStorage,
    sessionStorage,
    crypto: globalThis.crypto,
    AbortController: globalThis.AbortController,
    AbortSignal: globalThis.AbortSignal,
    btoa: globalThis.btoa,
    atob: globalThis.atob,
    TextEncoder: globalThis.TextEncoder,
    TextDecoder: globalThis.TextDecoder,
    URL: globalThis.URL,
    URLSearchParams: globalThis.URLSearchParams,
    Audio: MockAudio,
    EventTarget: globalThis.EventTarget,
    CustomEvent: globalThis.CustomEvent || class CustomEvent { constructor(type, init = {}) { this.type = type; this.detail = init.detail; } },
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    console: globalThis.console,
    Date: globalThis.Date,
    Math: globalThis.Math,
    String: globalThis.String,
    Number: globalThis.Number,
    Boolean: globalThis.Boolean,
    Array: globalThis.Array,
    Object: globalThis.Object,
    JSON: globalThis.JSON,
    fetch: options.fetch || globalThis.fetch
  };

  vm.createContext(context);
  vm.runInContext(appCode, context);
  if (options.loadUI) {
    try { vm.runInContext(uiCode, context); } catch (e) {}
  }
  const NG = context.window.NG;
  return { NG, state: NG.state, TRACKS: NG.TRACKS, localStorage, context };
}
