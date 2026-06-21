import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  normalizeDistributionDateRange,
  serializeDateOnlyValue,
  serializeDateTimeValue,
  serializeEventDoc,
} from '../lib/utils/events';

describe('events utils', () => {
  test('normalizeDistributionDateRange validates date order and format', () => {
    assert.deepEqual(normalizeDistributionDateRange('2026-06-01', '2026-06-03'), {
      startDateStr: '2026-06-01',
      endDateStr: '2026-06-03',
      error: null,
    });
    assert.equal(normalizeDistributionDateRange('2026-06-03', '2026-06-01').error, '配布開始日は配布終了日以前を指定してください');
    assert.equal(normalizeDistributionDateRange('2026-6-1', '2026-06-03').error, '配布日の形式が不正です');
  });

  test('serializeDateOnlyValue keeps date-only values stable and serializes timestamps', () => {
    const date = new Date('2026-06-21T15:00:00.000Z');
    assert.equal(serializeDateOnlyValue(date), '2026-06-22');
    assert.equal(serializeDateOnlyValue(1), '1970-01-01');
    assert.equal(serializeDateOnlyValue('2026-06-21'), '2026-06-21');
  });

  test('serializeDateTimeValue and serializeEventDoc preserve event payload shape', () => {
    const date = new Date('2026-06-21T12:34:56.000Z');
    assert.equal(serializeDateTimeValue(date), '2026-06-21T12:34:56.000Z');
    const doc = serializeEventDoc('kodai2026', {
      distributionTimeZone: 'Asia/Tokyo',
      createdAt: date,
      updatedAt: new Date('2026-06-21T13:00:00.000Z'),
      distributionStartDate: '2026-06-01',
      distributionEndDate: '2026-06-03',
      distributionAvailabilitySlots: ['2026-06-01_am'],
    });
    assert.equal(doc.id, 'kodai2026');
    assert.equal(doc.createdAt, '2026-06-21T12:34:56.000Z');
    assert.equal(doc.updatedAt, '2026-06-21T13:00:00.000Z');
    assert.equal(doc.distributionStartDate, '2026-06-01');
    assert.equal(doc.distributionEndDate, '2026-06-03');
  });
});
