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
