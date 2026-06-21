import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  normalizeDistributionEventListYear,
  resolveDistributionEventLookup,
  shouldBlockDistributionEventDeletion,
} from '../../lib/utils/events/events-api';

describe('events api utils', () => {
  test('normalizeDistributionEventListYear rejects invalid year params', () => {
    assert.equal(normalizeDistributionEventListYear('2026'), 2026);
    assert.equal(normalizeDistributionEventListYear('2026.5'), null);
    assert.equal(normalizeDistributionEventListYear('26'), null);
  });

  test('resolveDistributionEventLookup resolves id first and year fallback', () => {
    assert.deepEqual(resolveDistributionEventLookup({ id: 'kodai2026', year: '2027' }), {
      type: 'id',
      id: 'kodai2026',
    });
    assert.deepEqual(resolveDistributionEventLookup({ year: '2026' }), {
      type: 'year',
      year: 2026,
    });
    assert.deepEqual(resolveDistributionEventLookup({ id: '   ', year: '2026' }), {
      type: 'year',
      year: 2026,
    });
    assert.equal(resolveDistributionEventLookup({ id: '', year: '2026.5' }).type, 'error');
  });

  test('shouldBlockDistributionEventDeletion blocks if any dependency exists', () => {
    assert.equal(
      shouldBlockDistributionEventDeletion({ storesExist: true, teamsExist: false }),
      true,
    );
    assert.equal(
      shouldBlockDistributionEventDeletion({ storesExist: false, teamsExist: true }),
      true,
    );
    assert.equal(
      shouldBlockDistributionEventDeletion({ storesExist: false, teamsExist: false }),
      false,
    );
  });
});
