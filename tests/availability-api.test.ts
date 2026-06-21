import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  countResponsesWithAvailability,
  extractAvailabilitySlots,
  serializeDateLikeValue,
} from '../lib/utils/availability-api';

describe('availability api utils', () => {
  test('extractAvailabilitySlots returns nested availability arrays', () => {
    assert.deepEqual(
      extractAvailabilitySlots({
        participantData: {
          availableSlots: ['2026-06-01_am', '2026-06-01_pm'],
        },
      }),
      ['2026-06-01_am', '2026-06-01_pm'],
    );
    assert.equal(extractAvailabilitySlots({}), undefined);
  });

  test('countResponsesWithAvailability counts only responses with any availability', () => {
    const count = countResponsesWithAvailability([
      { participantData: { availableSlots: ['unavailable'] } },
      { participantData: { availableSlots: ['2026-06-01_am'] } },
      { participantData: { availableSlots: ['2026-06-01_pm'] } },
      { participantData: { availableSlots: [] } },
      { participantData: { availableSlots: undefined } },
    ]);
    assert.equal(count, 2);
  });

  test('serializeDateLikeValue preserves date-like inputs for dashboard routes', () => {
    const iso = '2026-06-21T00:00:00.000Z';

    assert.equal(serializeDateLikeValue(new Date(iso)), iso);
    assert.equal(serializeDateLikeValue(iso), iso);
    assert.equal(serializeDateLikeValue(Date.parse(iso)), iso);
    assert.equal(serializeDateLikeValue({ toDate: () => new Date(iso) }), iso);
    assert.equal(serializeDateLikeValue(undefined), undefined);
  });
});
