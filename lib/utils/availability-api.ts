import { isAvailableForAnySlot } from './availability';

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
