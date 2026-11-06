import test from 'node:test';
import assert from 'node:assert/strict';

function cleanSavedIds(list) {
  return (list || []).filter((id) => typeof id === 'string' && !id.startsWith('local-') && !id.startsWith('file-'));
}

function mergePlaylists(savedPlaylists, defaultPlaylists) {
  if (Array.isArray(savedPlaylists)) {
    return savedPlaylists
      .filter((p) => p && typeof p.id === 'string' && p.name && Array.isArray(p.trackIds))
      .map((p) => ({
        id: p.id,
        name: p.name,
        trackIds: cleanSavedIds(p.trackIds)
      }));
  }
  return defaultPlaylists;
}

test('preserves empty playlists array without falling back to seed playlists', () => {
  const seed = [{ id: 'p1', name: 'Seed 1', trackIds: ['t1'] }];
  const saved = [];
  const merged = mergePlaylists(saved, seed);
  assert.equal(merged.length, 0);
  assert.deepEqual(merged, []);
});

test('cleans up temporary local blob IDs from stored favorites and playlists', () => {
  const dirty = ['t1', 'local-blob-123', 't2', 'file-abc', 't3'];
  const cleaned = cleanSavedIds(dirty);
  assert.deepEqual(cleaned, ['t1', 't2', 't3']);
});
