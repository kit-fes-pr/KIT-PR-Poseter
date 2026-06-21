import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { formatDate, formatDateOnly, formatTimeOnly, formatRelativeTime } from '../lib/utils/dateUtils';

describe('dateUtils', () => {
  describe('formatDate', () => {
    test('formats Date objects to Japanese local format', () => {
      const date = new Date('2026-06-21T06:00:00.000Z'); // JST: 2026/06/21 15:00
      const formatted = formatDate(date);
      assert.match(formatted, /2026\/06\/21/);
      assert.match(formatted, /15:00/);
    });

    test('formats ISO string dates to Japanese local format', () => {
      const dateStr = '2026-06-21T06:00:00.000Z';
      const formatted = formatDate(dateStr);
      assert.match(formatted, /2026\/06\/21/);
      assert.match(formatted, /15:00/);
    });

    test('formats timestamp numbers to Japanese local format', () => {
      const timestamp = new Date('2026-06-21T06:00:00.000Z').getTime();
      const formatted = formatDate(timestamp);
      assert.match(formatted, /2026\/06\/21/);
      assert.match(formatted, /15:00/);
    });

    test('formats Firestore Timestamp-like objects', () => {
      const mockTimestamp = {
        toDate: () => new Date('2026-06-21T06:00:00.000Z')
      };
      const formatted = formatDate(mockTimestamp);
      assert.match(formatted, /2026\/06\/21/);
      assert.match(formatted, /15:00/);
    });

    test('returns dash for null or undefined', () => {
      assert.equal(formatDate(null), '-');
      assert.equal(formatDate(undefined), '-');
    });

    test('returns Invalid Date for invalid date string or unsupported type', () => {
      assert.equal(formatDate('invalid-date-string'), 'Invalid Date');
      assert.equal(formatDate({} as any), 'Invalid Date');
    });
  });

  describe('formatDateOnly', () => {
    test('formats date value containing date part only', () => {
      const date = new Date('2026-06-21T06:00:00.000Z');
      const formatted = formatDateOnly(date);
      assert.match(formatted, /2026\/06\/21/);
      assert.equal(formatted.includes('15:00'), false);
    });
  });

  describe('formatTimeOnly', () => {
    test('formats date value containing time part only', () => {
      const date = new Date('2026-06-21T06:00:00.000Z');
      const formatted = formatTimeOnly(date);
      assert.match(formatted, /15:00/);
      assert.equal(formatted.includes('2026/06/21'), false);
    });
  });

  describe('formatRelativeTime', () => {
    test('returns dash for null or undefined', () => {
      assert.equal(formatRelativeTime(null), '-');
      assert.equal(formatRelativeTime(undefined), '-');
    });

    test('returns relative time labels for past times', () => {
      const now = Date.now();
      const justNow = new Date(now - 1000); // 1秒前
      const minsAgo = new Date(now - 5 * 60 * 1000); // 5分前
      const hoursAgo = new Date(now - 3 * 60 * 60 * 1000); // 3時間前
      const daysAgo = new Date(now - 2 * 24 * 60 * 60 * 1000); // 2日前

      assert.equal(formatRelativeTime(justNow), 'たった今');
      assert.equal(formatRelativeTime(minsAgo), '5分前');
      assert.equal(formatRelativeTime(hoursAgo), '3時間前');
      assert.equal(formatRelativeTime(daysAgo), '2日前');
    });

    test('returns absolute date format for dates older than 7 days', () => {
      const now = Date.now();
      const sevenDaysAgo = new Date(now - 8 * 24 * 60 * 60 * 1000); // 8日前
      const formatted = formatRelativeTime(sevenDaysAgo);
      assert.match(formatted, /^\d{4}\/\d{2}\/\d{2}$/);
    });

    test('returns Invalid Date for invalid formats', () => {
      assert.equal(formatRelativeTime('not-a-date'), 'Invalid Date');
    });
  });
});
