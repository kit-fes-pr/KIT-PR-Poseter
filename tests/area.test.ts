import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizeAdjacentAreas } from '../lib/utils/area';

describe('area utils', () => {
  test('normalizeAdjacentAreas trims arrays and comma-separated strings', () => {
    assert.deepEqual(normalizeAdjacentAreas([' A-01 ', '', 'A-02']), ['A-01', 'A-02']);
    assert.deepEqual(normalizeAdjacentAreas('A-01, A-02, ,A-03'), ['A-01', 'A-02', 'A-03']);
  });

  test('normalizeAdjacentAreas returns empty array for non-string values', () => {
    assert.deepEqual(normalizeAdjacentAreas(undefined), []);
    assert.deepEqual(normalizeAdjacentAreas(null), []);
  });
});
