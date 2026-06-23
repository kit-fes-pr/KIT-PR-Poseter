import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  expandAvailabilitySlotsForStorage,
  filterVisibleFormFields,
  normalizeFormEventContext,
  prepareAnswersForStorage,
  resolveResponseAvailabilitySlots,
  serializeDate,
  toMillis,
  validateFormAnswersPayload,
} from '../../lib/utils/forms/forms';

describe('forms utils', () => {
  test('normalizeFormEventContext prefers year and normalizes eventId', () => {
    assert.deepEqual(normalizeFormEventContext('ignored', 2026), {
      eventId: 'kodai2026',
      year: 2026,
    });
    assert.deepEqual(normalizeFormEventContext('ignored', '2027'), {
      eventId: 'kodai2027',
      year: 2027,
    });
  });

  test('normalizeFormEventContext falls back to eventId and rejects invalid context', () => {
    assert.deepEqual(normalizeFormEventContext('kodai2028', undefined), {
      eventId: 'kodai2028',
      year: 2028,
    });
    assert.deepEqual(normalizeFormEventContext('kodai2028', '2028.5'), {
      eventId: 'kodai2028',
      year: 2028,
    });
    assert.equal(normalizeFormEventContext('invalid', undefined), null);
  });

  test('serializeDate and toMillis preserve timestamps consistently', () => {
    const date = new Date('2026-06-21T12:34:56.000Z');
    assert.equal(serializeDate(date), '2026-06-21T12:34:56.000Z');
    assert.equal(serializeDate(0), 0);
    assert.equal(toMillis(date), date.getTime());
    assert.equal(toMillis('2026-06-21T12:34:56.000Z'), date.getTime());
  });

  test('resolveResponseAvailabilitySlots prefers answers availability and falls back to participant data', () => {
    assert.deepEqual(
      resolveResponseAvailabilitySlots(
        [{ fieldId: 'availability', value: ['2026-06-01_am', '2026-06-01_pm'] }],
        ['2026-06-02_am'],
      ),
      ['2026-06-01_am', '2026-06-01_pm'],
    );
    assert.deepEqual(
      resolveResponseAvailabilitySlots([{ fieldId: 'remarks', value: 'ok' }], ['2026-06-02_am']),
      ['2026-06-02_am'],
    );
    assert.deepEqual(resolveResponseAvailabilitySlots([], ['unavailable']), ['unavailable']);
  });

  test('filterVisibleFormFields filters fields by participant grade', () => {
    const fields = [
      { fieldId: 'availability', visibleFromGrade: 1 },
      { fieldId: 'carUsage', visibleFromGrade: 0 },
      { fieldId: 'remarks' },
    ];

    assert.deepEqual(
      filterVisibleFormFields(fields, '2').map((field) => field.fieldId),
      ['availability', 'remarks'],
    );
    assert.deepEqual(
      filterVisibleFormFields(fields, '3').map((field) => field.fieldId),
      ['availability', 'remarks'],
    );
  });

  test('filterVisibleFormFields filters fields by minimum grade', () => {
    const fields = [
      { fieldId: 'availability', visibleFromGrade: 1 },
      { fieldId: 'carUsage', visibleFromGrade: 3 },
      { fieldId: 'remarks' },
    ];

    assert.deepEqual(
      filterVisibleFormFields(fields, '2').map((field) => field.fieldId),
      ['availability', 'remarks'],
    );
    assert.deepEqual(
      filterVisibleFormFields(fields, '3').map((field) => field.fieldId),
      ['availability', 'carUsage', 'remarks'],
    );
  });

  test('expandAvailabilitySlotsForStorage converts all available into date slots', () => {
    assert.deepEqual(
      expandAvailabilitySlotsForStorage(
        ['all_available'],
        ['2026-06-01_am', '2026-06-01_pm', '2026-06-02_am'],
      ),
      ['2026-06-01_am', '2026-06-01_pm', '2026-06-02_am'],
    );
    assert.deepEqual(
      expandAvailabilitySlotsForStorage(
        ['2026-06-01_am', '2026-06-02_pm'],
        ['2026-06-01_am', '2026-06-01_pm', '2026-06-02_am', '2026-06-02_pm'],
      ),
      ['2026-06-01_am', '2026-06-02_pm'],
    );
  });

  test('prepareAnswersForStorage filters invisible answers and expands availability', () => {
    assert.deepEqual(
      prepareAnswersForStorage(
        [
          { fieldId: 'availability', value: ['all_available'] },
          { fieldId: 'remarks', value: 'ok' },
          { fieldId: 'carUsage', value: '運転できる' },
        ],
        new Set(['availability', 'remarks']),
        ['2026-06-01_am', '2026-06-01_pm'],
      ),
      [
        { fieldId: 'availability', value: ['2026-06-01_am', '2026-06-01_pm'] },
        { fieldId: 'remarks', value: 'ok' },
      ],
    );
  });

  test('validateFormAnswersPayload rejects invalid answer entries', () => {
    assert.deepEqual(validateFormAnswersPayload(null), {
      valid: false,
      error: '回答データが正しくありません',
    });
    assert.deepEqual(validateFormAnswersPayload(['oops']), {
      valid: false,
      error: '回答データの形式が正しくありません',
    });
    assert.deepEqual(validateFormAnswersPayload([null]), {
      valid: false,
      error: '回答データの形式が正しくありません',
    });
    assert.deepEqual(validateFormAnswersPayload([{ value: 'ok' }]), {
      valid: false,
      error: '回答データの形式が正しくありません',
    });
    assert.deepEqual(validateFormAnswersPayload([{ fieldId: 'remarks', value: 'ok' }]), {
      valid: true,
    });
  });
});
