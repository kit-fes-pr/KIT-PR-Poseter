import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildEventsCreatePayload,
  buildEventsUpdateLookup,
  buildEventsUpdatePayload,
  normalizeEventsAuthHeader,
  parseEventsListYear,
} from '../lib/utils/events-route';

describe('events route utils', () => {
  test('normalizeEventsAuthHeader accepts bearer tokens only', () => {
    assert.equal(normalizeEventsAuthHeader('Bearer abc123'), 'abc123');
    assert.equal(normalizeEventsAuthHeader('Bearer   abc123  '), 'abc123');
    assert.equal(normalizeEventsAuthHeader('Basic abc123'), null);
    assert.equal(normalizeEventsAuthHeader(null), null);
  });

  test('parseEventsListYear validates four digit years', () => {
    assert.equal(parseEventsListYear('2026'), 2026);
    assert.equal(parseEventsListYear('2026.5'), null);
    assert.equal(parseEventsListYear('26'), null);
  });

  test('buildEventsCreatePayload normalizes create payloads', () => {
    const result = buildEventsCreatePayload({
      year: '2026',
      eventName: '  工大祭2026  ',
      distributionStartDate: '2026-06-01',
      distributionEndDate: '2026-06-03',
      distributionTimeZone: '  Asia/Tokyo  ',
      distributionAvailabilitySlots: ['2026-06-01_am'],
      eventId: '  custom-event  ',
    });

    assert.ok(!('error' in result));
    if ('error' in result) throw new Error(String(result.error));

    assert.equal(result.year, 2026);
    assert.equal(result.defaults.eventId, 'custom-event');
    assert.equal(result.defaults.eventName, '工大祭2026');
    assert.equal(result.defaults.distributionStartDate, '2026-06-01');
    assert.equal(result.defaults.distributionEndDate, '2026-06-03');
    assert.deepEqual(result.defaults.distributionAvailabilitySlots, ['2026-06-01_am']);
    assert.equal(result.defaults.distributionTimeZone, 'Asia/Tokyo');
  });

  test('buildEventsUpdateLookup and update payload normalize route inputs', () => {
    assert.deepEqual(buildEventsUpdateLookup({ id: '  kodai2026  ', year: '2027' }), {
      type: 'id',
      id: 'kodai2026',
    });
    assert.deepEqual(buildEventsUpdateLookup({ year: '2026' }), {
      type: 'year',
      year: 2026,
    });

    const update = buildEventsUpdatePayload({
      eventName: '  新しいイベント  ',
      distributionStartDate: '2026-06-01',
      distributionEndDate: '2026-06-02',
      distributionTimeZone: 'Asia/Tokyo',
      distributionAvailabilitySlots: ['A', 'B'],
      isActive: false,
    });

    assert.equal(update.error, null);
    assert.equal(update.update.eventName, '  新しいイベント  ');
    assert.equal(update.update.distributionStartDate, '2026-06-01');
    assert.equal(update.update.distributionEndDate, '2026-06-02');
    assert.deepEqual(update.update.distributionAvailabilitySlots, ['A', 'B']);
    assert.equal(update.update.isActive, false);
    assert.ok(update.update.updatedAt instanceof Date);
  });
});
