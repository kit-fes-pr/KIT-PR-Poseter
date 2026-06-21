export const TEAM_TIME_SLOT_PATTERN = /^\d{4}-\d{2}-\d{2}_(am|pm)$/;

export function normalizeTeamTimeSlot(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const normalized = value.trim();
  if (!TEAM_TIME_SLOT_PATTERN.test(normalized)) return null;

  return normalized;
}
