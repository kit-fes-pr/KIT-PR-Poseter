import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildFormsCreatePayload,
  buildFormsUpdatePayload,
  normalizeFormsRouteAuthHeader,
  parseFormsListEventId,
} from '../lib/utils/forms-route';

describe('forms route utils', () => {
  test('normalizeFormsRouteAuthHeader accepts bearer tokens only', () => {
    assert.equal(normalizeFormsRouteAuthHeader('Bearer token-1'), 'token-1');
    assert.equal(normalizeFormsRouteAuthHeader('Bearer   token-1'), 'token-1');
    assert.equal(normalizeFormsRouteAuthHeader('Basic token-1'), null);
    assert.equal(normalizeFormsRouteAuthHeader(null), null);
  });

  test('parseFormsListEventId uses default event id when query is missing', () => {
    assert.equal(parseFormsListEventId('custom-event'), 'custom-event');
    assert.equal(parseFormsListEventId('  custom-event  '), 'custom-event');
    assert.equal(parseFormsListEventId(''), 'kodai2025');
    assert.equal(parseFormsListEventId(null), 'kodai2025');
  });

  test('buildFormsCreatePayload normalizes create payloads', () => {
    const created = buildFormsCreatePayload({
      title: '  配布アンケート ',
      description: '  説明 ',
      fields: [
        {
          type: 'checkbox',
          label: '参加可能日時',
          required: true,
          options: ['A', 'B'],
          validation: {},
          order: 0,
        },
      ],
      eventId: '',
      year: 2026,
      createdBy: 'admin-1',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });

    assert.ok(!('error' in created));
    if ('error' in created) throw new Error(String(created.error));

    assert.equal(created.data.eventId, 'kodai2026');
    assert.equal(created.data.title, '配布アンケート');
    assert.equal(created.data.description, '説明');
    assert.equal(created.data.responseCount, 0);
    assert.equal(created.data.fields[0].fieldId, 'availability');
  });

  test('buildFormsUpdatePayload normalizes update payloads', () => {
    const update = buildFormsUpdatePayload({
      title: ' 更新後 ',
      description: ' 説明2 ',
      isActive: false,
      fields: [
        {
          fieldId: 'availability',
          type: 'checkbox',
          label: '参加可能日時',
          required: true,
          options: ['A', 'B'],
          validation: {},
          order: 0,
        },
      ],
      updatedAt: new Date('2026-02-01T00:00:00.000Z'),
    });

    assert.equal(update.error, null);
    assert.equal(update.updateFields.title, '更新後');
    assert.equal(update.updateFields.description, '説明2');
    assert.equal(update.updateFields.isActive, false);
    assert.deepEqual(update.updateFields.updatedAt, new Date('2026-02-01T00:00:00.000Z'));
    assert.equal((update.updateFields.fields as Array<{ fieldId: string }>)[0].fieldId, 'availability');
  });
});

