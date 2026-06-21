import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizeGrade } from '../../lib/utils/grade/grade';

describe('grade utils', () => {
  test('normalizeGrade converts strings and numbers to integers', () => {
    assert.equal(normalizeGrade('1'), 1);
    assert.equal(normalizeGrade(' 4 '), 4);
    assert.equal(normalizeGrade('3年'), 3);
    assert.equal(normalizeGrade('3年生'), 3);
    assert.equal(normalizeGrade(2.9), 2);
  });

  test('normalizeGrade returns 0 for missing or invalid values', () => {
    assert.equal(normalizeGrade(undefined), 0);
    assert.equal(normalizeGrade(null), 0);
    assert.equal(normalizeGrade('foo'), 0);
  });
});
