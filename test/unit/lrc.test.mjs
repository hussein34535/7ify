import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLRC, normalizeMusicText } from '../../api/lyrics.js';

test('parses a valid LRC timestamp accurately', () => {
  const lines = parseLRC('[00:12.50]Hello world');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].t, 12.5);
  assert.equal(lines[0].text, 'Hello world');
});

test('supports multiple timestamps on one line', () => {
  const lines = parseLRC('[00:01.00][00:02.50]Echo line');
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map(x => x.t), [1, 2.5]);
  assert.equal(lines[0].text, 'Echo line');
  assert.equal(lines[1].text, 'Echo line');
});

test('rejects seconds greater than or equal to 60 (e.g. 75 seconds)', () => {
  assert.deepEqual(parseLRC('[00:75.00]Invalid time'), []);
  assert.deepEqual(parseLRC('[01:99.99]Invalid time'), []);
});

test('does not invent artificial timestamps for plain text', () => {
  assert.deepEqual(parseLRC('first line without timestamp\nsecond line without timestamp'), []);
});

test('does not duplicate language fields into fake ar/en translations', () => {
  const lines = parseLRC('[00:04.20]تملي معاك');
  assert.equal(lines.length, 1);
  assert.equal(lines[0].ar, undefined);
  assert.equal(lines[0].en, undefined);
  assert.equal(lines[0].text, 'تملي معاك');
});

test('normalizes arabic and international music text consistently', () => {
  assert.equal(normalizeMusicText('عَمْرُو دِيَابْ'), 'عمرو دياب');
  assert.equal(normalizeMusicText('  The   WEEKND  '), 'the weeknd');
  assert.equal(normalizeMusicText('إنت وأنا'), 'انت وانا');
});
