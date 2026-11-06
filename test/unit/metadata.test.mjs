import test from 'node:test';
import assert from 'node:assert/strict';

function formatDuration(val) {
  const n = Number(val);
  if (!Number.isFinite(n) || n <= 0) return '--:--';
  const total = Math.floor(n);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function formatPosition(val) {
  const n = Number(val);
  const safe = Number.isFinite(n) ? Math.max(0, n) : 0;
  const total = Math.floor(safe);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

function parseYear(rawDate) {
  const releaseYear = rawDate ? Number.parseInt(String(rawDate).slice(0, 4), 10) : null;
  return Number.isInteger(releaseYear) && releaseYear >= 1900 && releaseYear <= (new Date().getFullYear() + 1)
    ? releaseYear
    : null;
}

test('formatDuration formats valid durations correctly', () => {
  assert.equal(formatDuration(260), '4:20');
  assert.equal(formatDuration(30), '0:30');
  assert.equal(formatDuration(65), '1:05');
});

test('formatDuration returns --:-- for null, undefined, or missing durations without fake 180s', () => {
  assert.equal(formatDuration(null), '--:--');
  assert.equal(formatDuration(undefined), '--:--');
  assert.equal(formatDuration(0), '--:--');
  assert.equal(formatDuration(-10), '--:--');
});

test('formatPosition safely formats position 0 as 0:00', () => {
  assert.equal(formatPosition(0), '0:00');
  assert.equal(formatPosition(15.4), '0:15');
});

test('parseYear returns null for missing or invalid dates without fake 2024 fallback', () => {
  assert.equal(parseYear('2000-08-01T07:00:00Z'), 2000);
  assert.equal(parseYear('1996'), 1996);
  assert.equal(parseYear(null), null);
  assert.equal(parseYear(''), null);
  assert.equal(parseYear('invalid-date'), null);
  assert.equal(parseYear('1840'), null); // too early
});
