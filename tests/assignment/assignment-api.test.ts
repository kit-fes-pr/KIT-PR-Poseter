import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  buildManualAssignmentRecord,
  normalizeAssignmentYear,
} from '../../lib/utils/assignment/assignment-api';

describe('assignment api utils', () => {
  test('normalizeAssignmentYear accepts only 4-digit years', () => {
    assert.equal(normalizeAssignmentYear(2026), 2026);
    assert.equal(normalizeAssignmentYear('2026'), 2026);
    assert.equal(normalizeAssignmentYear('2026.5'), undefined);
    assert.equal(normalizeAssignmentYear('26'), undefined);
    assert.equal(normalizeAssignmentYear(null), undefined);
  });

  test('buildManualAssignmentRecord normalizes manual assignment payloads', () => {
    assert.deepEqual(
      buildManualAssignmentRecord({
        year: '2026',
        formId: ' form-1 ',
        responseId: ' response-1 ',
        teamId: ' team-1 ',
        timeSlot: '2026-06-01_am',
        assignedAt: new Date('2026-01-01T00:00:00.000Z'),
      }),
      {
        year: 2026,
        formId: 'form-1',
        responseId: 'response-1',
        teamId: 'team-1',
        timeSlot: '2026-06-01_am',
        assignedAt: new Date('2026-01-01T00:00:00.000Z'),
        assignedBy: 'manual',
      },
    );
  });

  test('buildManualAssignmentRecord rejects invalid input', () => {
    assert.equal(
      buildManualAssignmentRecord({
        year: '2026.5',
        formId: 'form-1',
        responseId: 'response-1',
        teamId: 'team-1',
        timeSlot: '2026-06-01_am',
      }),
      null,
    );
    assert.equal(
      buildManualAssignmentRecord({
        year: '2026',
        formId: 'form-1',
        responseId: 'response-1',
        teamId: 'team-1',
        timeSlot: 'foo',
      }),
      null,
    );
  });
});
