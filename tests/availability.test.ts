import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  ALL_AVAILABLE_SLOT_KEY,
  UNAVAILABLE_SLOT_KEY,
  buildAvailabilitySlotChoices,
  formatAvailabilitySlotLabel,
  sortAvailabilitySlotKeys,
  toggleAvailabilitySelection,
} from '../lib/utils/availability';

describe('availability utils', () => {
  test('buildAvailabilitySlotChoices generates am/pm choices for each date', () => {
    const choices = buildAvailabilitySlotChoices('2026-06-01', '2026-06-03');
    assert.equal(choices.length, 6);
    assert.deepEqual(
      choices.map((choice) => choice.key),
      [
        '2026-06-01_am',
        '2026-06-01_pm',
        '2026-06-02_am',
        '2026-06-02_pm',
        '2026-06-03_am',
        '2026-06-03_pm',
      ],
    );
  });

  test('compareAvailabilitySlotKeys sorts special slots first and date slots by day then am/pm', () => {
    const sorted = sortAvailabilitySlotKeys([
      '2026-06-02_pm',
      UNAVAILABLE_SLOT_KEY,
      ALL_AVAILABLE_SLOT_KEY,
      '2026-06-01_am',
    ]);

    assert.deepEqual(sorted, [
      ALL_AVAILABLE_SLOT_KEY,
      UNAVAILABLE_SLOT_KEY,
      '2026-06-01_am',
      '2026-06-02_pm',
    ]);
  });

  test('formatAvailabilitySlotLabel formats special and date slots', () => {
    assert.equal(formatAvailabilitySlotLabel(ALL_AVAILABLE_SLOT_KEY), '全て可能');
    assert.equal(formatAvailabilitySlotLabel(UNAVAILABLE_SLOT_KEY), '参加不可');
    assert.match(formatAvailabilitySlotLabel('2026-06-01_am'), /午前$/);
  });

  test('toggleAvailabilitySelection keeps unavailable exclusive and all-available expansive', () => {
    const allDateSlotKeys = ['2026-06-01_am', '2026-06-01_pm'];
    assert.deepEqual(toggleAvailabilitySelection([], UNAVAILABLE_SLOT_KEY, allDateSlotKeys), [
      UNAVAILABLE_SLOT_KEY,
    ]);
    assert.deepEqual(toggleAvailabilitySelection([], ALL_AVAILABLE_SLOT_KEY, allDateSlotKeys), [
      ...allDateSlotKeys,
      ALL_AVAILABLE_SLOT_KEY,
    ]);
  });
});
