import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { normalizeTeamTimeSlot, TEAM_TIME_SLOT_PATTERN } from '../../lib/utils/team/team';

describe('team utils', () => {
  test('normalizeTeamTimeSlot trims and validates distribution slot keys', () => {
    assert.equal(normalizeTeamTimeSlot(' 2026-06-01_am '), '2026-06-01_am');
    assert.equal(normalizeTeamTimeSlot('2026-06-01_pm'), '2026-06-01_pm');
    assert.equal(normalizeTeamTimeSlot('foo'), null);
    assert.equal(normalizeTeamTimeSlot('2026-06-01'), null);
    assert.equal(normalizeTeamTimeSlot(''), null);
  });

  test('TEAM_TIME_SLOT_PATTERN matches am/pm keys only', () => {
    assert.equal(TEAM_TIME_SLOT_PATTERN.test('2026-06-01_am'), true);
    assert.equal(TEAM_TIME_SLOT_PATTERN.test('2026-06-01_pm'), true);
    assert.equal(TEAM_TIME_SLOT_PATTERN.test('2026-06-01'), false);
    assert.equal(TEAM_TIME_SLOT_PATTERN.test('foo'), false);
  });
});
