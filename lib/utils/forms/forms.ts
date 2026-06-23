import { normalizeAvailabilitySlots } from '../availability/availability';
import { normalizeGrade } from '../grade/grade';
import { serializeDateTimeValue as serializeDate } from '../dateUtils';

export { serializeDate };

export function toMillis(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
  }
  return 0;
}

export function normalizeFormEventContext(
  eventId: unknown,
  year: unknown,
): { eventId: string; year: number } | null {
  const normalizedYear =
    typeof year === 'number'
      ? Number.isInteger(year) && year >= 1000 && year <= 9999
        ? year
        : Number.NaN
      : typeof year === 'string' && /^\d{4}$/.test(year.trim())
        ? Number(year.trim())
        : Number.NaN;

  if (Number.isInteger(normalizedYear) && normalizedYear >= 1000 && normalizedYear <= 9999) {
    return {
      eventId: `kodai${normalizedYear}`,
      year: normalizedYear,
    };
  }

  const normalizedEventId = typeof eventId === 'string' ? eventId.trim() : '';
  const matchedYear = normalizedEventId.match(/^kodai(\d{4})$/)?.[1];

  if (matchedYear) {
    return {
      eventId: normalizedEventId,
      year: Number(matchedYear),
    };
  }

  if (normalizedEventId) {
    return null;
  }

  return null;
}

export function resolveResponseAvailabilitySlots(
  answers: Array<{ fieldId: string; value: unknown }>,
  participantAvailableSlots: unknown,
): string[] {
  const availabilityAnswer = answers.find((answer) => answer.fieldId === 'availability');
  if (availabilityAnswer) {
    return normalizeAvailabilitySlots(availabilityAnswer.value);
  }

  return normalizeAvailabilitySlots(participantAvailableSlots);
}

export function isFormFieldVisibleForGrade(
  field: { visibleFromGrade?: number },
  participantGrade: unknown,
): boolean {
  if (field.visibleFromGrade == null) return true;

  const minGrade = normalizeGrade(field.visibleFromGrade);
  if (minGrade <= 0) return false;

  const grade = normalizeGrade(participantGrade);
  if (grade <= 0) return false;

  return grade >= minGrade;
}

export function filterVisibleFormFields<T extends { visibleFromGrade?: number }>(
  fields: T[],
  participantGrade: unknown,
): T[] {
  return fields.filter((field) => isFormFieldVisibleForGrade(field, participantGrade));
}
