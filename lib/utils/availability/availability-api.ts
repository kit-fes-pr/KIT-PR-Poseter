import { isAvailableForAnySlot } from './availability';

export function serializeDateLikeValue(value: unknown): string | undefined {
  if (!value) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return new Date(value).toISOString();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return undefined;
}

export function countResponsesWithAvailability(
  docs: Array<{ participantData?: { availableSlots?: unknown } }>,
): number {
  return docs.filter((doc) => isAvailableForAnySlot(doc.participantData?.availableSlots)).length;
}

export function extractAvailabilitySlots(
  doc: { participantData?: { availableSlots?: unknown } } | null | undefined,
): unknown {
  return doc?.participantData?.availableSlots;
}
