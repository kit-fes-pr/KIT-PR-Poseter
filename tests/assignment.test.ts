import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  effectiveSlotCount,
  getMatchingTeamSlots,
  resolveParticipantSlotKeys,
} from '../lib/utils/assignment';

describe('assignment utils', () => {
  const eventSlotKeys = ['2026-06-01_am', '2026-06-01_pm', '2026-06-02_am'];

  test('resolveParticipantSlotKeys handles unavailable and all-available slots', () => {
    assert.deepEqual(resolveParticipantSlotKeys([], eventSlotKeys), []);
    assert.deepEqual(resolveParticipantSlotKeys(['unavailable'], eventSlotKeys), []);
    assert.deepEqual(resolveParticipantSlotKeys(['all_available'], eventSlotKeys), eventSlotKeys);
    assert.deepEqual(
      resolveParticipantSlotKeys(['2026-06-01_am', '2026-06-02_pm'], eventSlotKeys),
      ['2026-06-01_am'],
    );
  });

  test('effectiveSlotCount ranks constrained participants ahead of flexible ones', () => {
    assert.equal(effectiveSlotCount(['unavailable'], eventSlotKeys), Number.POSITIVE_INFINITY);
    assert.equal(effectiveSlotCount(['all_available'], eventSlotKeys), 3);
    assert.equal(effectiveSlotCount(['2026-06-01_am'], eventSlotKeys), 1);
    assert.equal(effectiveSlotCount(['2026-06-01_am', '2026-06-02_am'], eventSlotKeys), 2);
  });

  test('getMatchingTeamSlots only returns slots that exist in the event', () => {
    assert.deepEqual(getMatchingTeamSlots({ timeSlot: '2026-06-01_am' }, eventSlotKeys), [
      '2026-06-01_am',
    ]);
    assert.deepEqual(getMatchingTeamSlots({ timeSlot: '2026-06-03_pm' }, eventSlotKeys), []);
  });
});
