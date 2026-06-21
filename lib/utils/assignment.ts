import {
  ALL_AVAILABLE_SLOT_KEY,
  UNAVAILABLE_SLOT_KEY,
  normalizeAvailabilitySlots,
} from './availability';

export interface AssignmentParticipantLike {
  availableSlots: string[];
}

export interface AssignmentTeamLike {
  timeSlot: string;
}

export function effectiveSlotCount(slots: string[], eventSlotKeys: string[]): number {
  const normalized = normalizeAvailabilitySlots(slots);
  if (normalized.includes(UNAVAILABLE_SLOT_KEY)) return Number.POSITIVE_INFINITY;
  if (normalized.includes(ALL_AVAILABLE_SLOT_KEY))
    return eventSlotKeys.length || Number.POSITIVE_INFINITY;
  const available = normalized.filter((slot) => eventSlotKeys.includes(slot));
  return available.length || Number.POSITIVE_INFINITY;
}

export function resolveParticipantSlotKeys(slots: string[], eventSlotKeys: string[]): string[] {
  const normalized = normalizeAvailabilitySlots(slots);
  if (normalized.length === 0 || normalized.includes(UNAVAILABLE_SLOT_KEY)) return [];
  if (normalized.includes(ALL_AVAILABLE_SLOT_KEY)) {
    return eventSlotKeys;
  }
  return normalized.filter((slot) => eventSlotKeys.includes(slot));
}

export function getMatchingTeamSlots(team: AssignmentTeamLike, eventSlotKeys: string[]): string[] {
  return eventSlotKeys.includes(team.timeSlot) ? [team.timeSlot] : [];
}
