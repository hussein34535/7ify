import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

const here = dirname(fileURLToPath(import.meta.url));
const appPath = resolve(here, '..', '..', 'src', 'app.js');
const appCode = readFileSync(appPath, 'utf8');

export function loadAppInstance(initialStorage = {}) {
  const store = new Map(Object.entries(initialStorage));
  const localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
    clear: () => store.clear()
  };

  class MockAudio {
    constructor() {
      this.src = '';
      this.currentTime = 0;
      this.duration = 30;
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
      return Promise.resolve();
    }
    pause() {
      this.paused = true;
    }
    load() {}
  }

  const listeners = new Map();
  const context = {
    window: {},
    document: {
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
    fetch: globalThis.fetch
  };

  vm.createContext(context);
  vm.runInContext(appCode, context);
  const NG = context.window.NG;
  return { NG, state: NG.state, TRACKS: NG.TRACKS, localStorage };
}
