import test from 'node:test';
import assert from 'node:assert/strict';
import searchHandler from '../../api/search.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
    end() { return this; }
  };
  return res;
}

test('search rejects non-GET methods with 405 Method Not Allowed', async () => {
  const req = { method: 'POST', query: { q: 'Amr' } };
  const res = createMockRes();
  await searchHandler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers['allow'], 'GET, OPTIONS');
  assert.equal(res.data.error, 'method_not_allowed');
});

test('search handles OPTIONS method with 204', async () => {
  const req = { method: 'OPTIONS' };
  const res = createMockRes();
  await searchHandler(req, res);
  assert.equal(res.statusCode, 204);
});

test('search rejects excessively long queries (>120 chars) with 400', async () => {
  const longQ = 'a'.repeat(125);
  const req = { method: 'GET', query: { q: longQ } };
  const res = createMockRes();
  await searchHandler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'query_too_long');
});

test('search returns empty results immediately for queries < 2 chars', async () => {
  const req = { method: 'GET', query: { q: 'a' } };
  const res = createMockRes();
  await searchHandler(req, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.data.results, []);
});

test('search returns 502 with upstream_failed when external provider fails', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => {
    throw new Error('Connection refused by simulated upstream');
  };
  try {
    const req = { method: 'GET', query: { q: 'Valid Query' } };
    const res = createMockRes();
    await searchHandler(req, res);
    assert.equal(res.statusCode, 502);
    assert.equal(res.data.error, 'upstream_unavailable');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('search correctly transforms upstream response into clean schema without fake durations', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: true,
    json: async () => ({
      results: [
        {
          trackId: 123456,
          trackName: 'Test Song',
          artistName: 'Test Artist',
          collectionName: 'Test Album',
          artworkUrl100: 'https://example.com/100x100bb.jpg',
          previewUrl: 'https://example.com/preview.m4a',
          trackTimeMillis: 185000,
          releaseDate: '2023-05-15T00:00:00Z',
          primaryGenreName: 'Arabic'
        }
      ]
    })
  });

  try {
    const req = { method: 'GET', query: { q: 'Test Song' } };
    const res = createMockRes();
    await searchHandler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.data.results.length, 1);
    const item = res.data.results[0];
    assert.equal(item.appleId, 123456);
    assert.equal(item.title.ar, 'Test Song');
    assert.equal(item.artist.ar, 'Test Artist');
    assert.equal(item.duration, 185);
    assert.equal(item.year, 2023);
    assert.equal(item.preview, 'https://example.com/preview.m4a');
    assert.equal(item.art, 'https://example.com/600x600bb.jpg');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
