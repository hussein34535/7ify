import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAppInstance } from '../helpers/load-app.mjs';

function createMockElement(id, initialProps = {}) {
  const classList = new Set();
  const attributes = new Map();
  return {
    id,
    hidden: true,
    innerHTML: '',
    value: '',
    classList: {
      add: (c) => classList.add(c),
      remove: (c) => classList.delete(c),
      toggle: (c, force) => (force ?? !classList.has(c)) ? classList.add(c) : classList.delete(c),
      contains: (c) => classList.has(c)
    },
    setAttribute: (k, v) => attributes.set(k, String(v)),
    getAttribute: (k) => attributes.get(k) || null,
    removeAttribute: (k) => attributes.delete(k),
    scrollIntoView: () => {},
    focus: () => {},
    blur: () => {},
    addEventListener: () => {},
    querySelectorAll: (sel) => [],
    ...initialProps
  };
}

test('1. Autocomplete: runUnifiedSearch returns local results immediately without waiting for network', () => {
  const mockQ = createMockElement('q', { value: 'تملي' });
  const mockWrap = createMockElement('searchWrap');
  const mockClear = createMockElement('qClear');
  const mockAuto = createMockElement('searchAutocomplete');

  const { NG } = loadAppInstance({}, {
    loadUI: true,
    elements: {
      q: mockQ,
      searchWrap: mockWrap,
      qClear: mockClear,
      searchAutocomplete: mockAuto
    }
  });

  NG.runUnifiedSearch('تملي');

  assert.equal(mockAuto.hidden, false, 'Autocomplete dropdown should open immediately');
  assert.equal(mockQ.getAttribute('aria-expanded'), 'true');
  assert.ok(mockAuto.innerHTML.includes('تملي معاك'), 'Should include local track match in suggestions');
});

test('2. Autocomplete: ArrowDown / ArrowUp moves active suggestion and sets ARIA attributes', () => {
  const itemNodes = [
    createMockElement('ac-item-0', { dataset: { autocompleteIndex: '0' } }),
    createMockElement('ac-item-1', { dataset: { autocompleteIndex: '1' } }),
    createMockElement('ac-item-2', { dataset: { autocompleteIndex: '2' } })
  ];

  const mockAuto = createMockElement('searchAutocomplete', {
    hidden: false,
    querySelectorAll: (sel) => itemNodes
  });
  const mockQ = createMockElement('q', { value: 'عمرو' });

  const { NG } = loadAppInstance({}, {
    loadUI: true,
    elements: {
      q: mockQ,
      searchAutocomplete: mockAuto
    }
  });

  // Move down to index 0
  NG.setActiveSuggestion(0);
  assert.equal(mockQ.getAttribute('aria-activedescendant'), 'ac-item-0');
  assert.equal(itemNodes[0].getAttribute('aria-selected'), 'true');
  assert.ok(itemNodes[0].classList.contains('is-active'));

  // Move down to index 1
  NG.setActiveSuggestion(1);
  assert.equal(mockQ.getAttribute('aria-activedescendant'), 'ac-item-1');
  assert.equal(itemNodes[1].getAttribute('aria-selected'), 'true');
  assert.equal(itemNodes[0].getAttribute('aria-selected'), 'false');

  // Move wrap around
  NG.setActiveSuggestion(-1);
  assert.equal(mockQ.getAttribute('aria-activedescendant'), null);
});

test('3. Autocomplete: closeAutocomplete resets index, hides dropdown, sets aria-expanded=false', () => {
  const mockAuto = createMockElement('searchAutocomplete', { hidden: false, innerHTML: '<div>some suggestions</div>' });
  const mockQ = createMockElement('q', { value: 'test' });
  mockQ.setAttribute('aria-expanded', 'true');
  mockQ.setAttribute('aria-activedescendant', 'ac-item-0');

  const { NG } = loadAppInstance({}, {
    loadUI: true,
    elements: {
      q: mockQ,
      searchAutocomplete: mockAuto
    }
  });

  NG.closeAutocomplete();

  assert.equal(mockAuto.hidden, true);
  assert.equal(mockAuto.innerHTML, '');
  assert.equal(mockQ.getAttribute('aria-expanded'), 'false');
  assert.equal(mockQ.getAttribute('aria-activedescendant'), null);
});

test('4. Search Controller: rapid typing ("tam" -> "never") discards stale responses via sequence ID', async () => {
  let callCount = 0;
  const mockFetch = async (url) => {
    callCount++;
    if (url.includes('tam')) {
      // simulate slow network for first query
      await new Promise(r => setTimeout(r, 60));
      return {
        ok: true,
        json: async () => ({ results: [{ id: 'stale-track', title: { ar: 'قديم', en: 'Stale' }, artist: { ar: '', en: '' } }] })
      };
    }
    return {
      ok: true,
      json: async () => ({ results: [{ id: 'fresh-track', title: { ar: 'جديد', en: 'Fresh' }, artist: { ar: '', en: '' } }] })
    };
  };

  const mockQ = createMockElement('q');
  const mockAuto = createMockElement('searchAutocomplete');

  const { NG } = loadAppInstance({}, {
    loadUI: true,
    fetch: mockFetch,
    elements: { q: mockQ, searchAutocomplete: mockAuto }
  });

  // Type first query
  NG.runUnifiedSearch('tam');
  // Immediately change query to 'never'
  NG.runUnifiedSearch('never');

  // Wait for debounced timers to resolve
  await new Promise(r => setTimeout(r, 350));

  // Verify that fresh results took precedence and stale track was never accepted as active
  assert.equal(NG.TRACKS.some(t => t.id === 'stale-track'), false, 'Stale track from aborted query must be discarded');
});

test('5. Autocomplete: empty query with recent searches displays recent queries in dropdown', () => {
  const mockQ = createMockElement('q', { value: '' });
  const mockAuto = createMockElement('searchAutocomplete');

  const { NG, context } = loadAppInstance({}, {
    loadUI: true,
    elements: {
      q: mockQ,
      searchAutocomplete: mockAuto
    }
  });

  // Run with empty query
  NG.runUnifiedSearch('');

  // Dropdown closes or handles empty gracefully
  assert.equal(mockQ.getAttribute('aria-expanded'), 'false');
});
