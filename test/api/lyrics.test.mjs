import test from 'node:test';
import assert from 'node:assert/strict';
import lyricsHandler from '../../api/lyrics.js';

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

test('lyrics rejects non-GET methods with 405 Method Not Allowed', async () => {
  const req = { method: 'DELETE', query: { track: 'Noor El Ain' } };
  const res = createMockRes();
  await lyricsHandler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers['allow'], 'GET, OPTIONS');
  assert.equal(res.data.error, 'method_not_allowed');
});

test('lyrics rejects missing track parameter with 400', async () => {
  const req = { method: 'GET', query: {} };
  const res = createMockRes();
  await lyricsHandler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.data.error, 'invalid_track_name');
});

test('lyrics rejects excessively long track name with 400', async () => {
  const req = { method: 'GET', query: { track: 'x'.repeat(180) } };
  const res = createMockRes();
  await lyricsHandler(req, res);
  assert.equal(res.statusCode, 400);
});
