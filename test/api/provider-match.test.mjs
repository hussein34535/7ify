import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../api/provider-match.js';

function createMockRes() {
  return {
    statusCode: 200,
    headers: {},
    setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
    status(code) { this.statusCode = code; return this; },
    json(data) { this.body = data; return this; },
    end() { this.ended = true; return this; }
  };
}

test('1. provider-match rejects non-GET methods with 405 Method Not Allowed', async () => {
  const req = { method: 'POST', query: {} };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.body.error, 'method_not_allowed');
});

test('2. provider-match handles OPTIONS preflight with 204', async () => {
  const req = { method: 'OPTIONS' };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.ended, true);
});

test('3. provider-match rejects missing title parameter with 400', async () => {
  const req = { method: 'GET', query: { artist: 'Amr Diab' } };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'invalid_title');
});

test('4. provider-match rejects excessively long title (>120 chars) with 400', async () => {
  const req = { method: 'GET', query: { title: 'a'.repeat(125), artist: 'Amr Diab' } };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'query_too_long');
});

test('5. provider-match returns honest unmatched status when server credentials are not configured', async () => {
  const req = { method: 'GET', query: { title: 'تملي معاك', artist: 'عمرو دياب', duration: '260' } };
  const res = createMockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.matched, false);
  assert.ok(res.body.reason);
});
