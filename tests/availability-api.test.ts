import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  countResponsesWithAvailability,
  extractAvailabilitySlots,
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
});
