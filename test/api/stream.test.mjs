import test from 'node:test';
import assert from 'node:assert/strict';
import streamHandler from '../../api/stream.js';

function createMockRes() {
  const res = {
    statusCode: 200,
    headers: {},
    data: null,
    redirectUrl: null,
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; return this; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.data = payload; return this; },
    redirect(code, url) { this.statusCode = code; this.redirectUrl = url; return this; },
    end() { return this; }
  };
  return res;
}

test('stream rejects non-GET methods with 405 Method Not Allowed', async () => {
  const req = { method: 'POST', query: { id: '123' } };
  const res = createMockRes();
  await streamHandler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers['allow'], 'GET, OPTIONS');
});

test('stream prevents open redirect from query parameters', async () => {
  const req = { method: 'GET', query: { preview: 'http://malicious-attacker.com/exploit.mp3' } };
  const res = createMockRes();
  await streamHandler(req, res);
  // Must NOT redirect to attacker's arbitrary URL
  assert.notEqual(res.redirectUrl, 'http://malicious-attacker.com/exploit.mp3');
  assert.equal(res.statusCode, 404);
  assert.equal(res.data?.error, 'authorized_stream_unavailable');
});

test('stream returns 404 with authorized_stream_unavailable when no id or stream is provided', async () => {
  const req = { method: 'GET', query: {} };
  const res = createMockRes();
  await streamHandler(req, res);
  assert.equal(res.statusCode, 404);
  assert.equal(res.data.error, 'authorized_stream_unavailable');
});
