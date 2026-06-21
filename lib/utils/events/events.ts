import { DEFAULT_TIME_ZONE } from '../dateUtils';
import { buildAvailabilitySlotChoices } from '../availability/availability';

function formatDateOnlyInTimeZone(value: Date, timeZone = DEFAULT_TIME_ZONE): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const year = parts.find((part) => part.type === 'year')?.value || '';
  const month = parts.find((part) => part.type === 'month')?.value || '';
  const day = parts.find((part) => part.type === 'day')?.value || '';
  return `${year}-${month}-${day}`;
}

export function serializeDateOnlyValue(
  value: unknown,
  timeZone = DEFAULT_TIME_ZONE,
): string | unknown {
  if (!value) return value;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return formatDateOnlyInTimeZone(value, timeZone);
  if (typeof value === 'number') return formatDateOnlyInTimeZone(new Date(value), timeZone);
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return formatDateOnlyInTimeZone((value as { toDate: () => Date }).toDate(), timeZone);
  }
  return value;
}

export function serializeDateTimeValue(value: unknown): string | unknown {
  if (!value) return value;
  if (typeof value === 'string') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'number') return new Date(value).toISOString();
  if (
    typeof value === 'object' &&
    value !== null &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return value;
}

export function normalizeDistributionDateRange(
  distributionStartDate: unknown,
  distributionEndDate: unknown,
): { startDateStr: string; endDateStr: string; error: string | null } {
  const startDateStr = String(distributionStartDate || '').trim();
  const endDateStr = String(distributionEndDate || distributionStartDate || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr) || !/^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
    return { startDateStr, endDateStr, error: '配布日の形式が不正です' };
  }
  if (startDateStr > endDateStr) {
    return {
      startDateStr,
      endDateStr,
      error: '配布開始日は配布終了日以前を指定してください',
    };
  }
  return { startDateStr, endDateStr, error: null };
}

export function normalizeDistributionYear(year: unknown): number | null {
  const parsed =
    typeof year === 'number' ? year : typeof year === 'string' ? Number(year.trim()) : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < 1000 || parsed > 9999) {
    return null;
  }

  return parsed;
}

export function buildDistributionAvailabilitySlotKeys(
  startDateStr: string,
  endDateStr: string,
  distributionAvailabilitySlots: unknown,
): string[] {
  const storedSlots = Array.isArray(distributionAvailabilitySlots)
    ? distributionAvailabilitySlots.filter((slot): slot is string => typeof slot === 'string')
    : [];

  if (storedSlots.length > 0) {
    return storedSlots;
  }

  return buildAvailabilitySlotChoices(startDateStr, endDateStr).map(
    (choice: { key: string }) => choice.key,
  );
}

export function buildDistributionEventCreateDefaults(params: {
  year: number;
  eventId?: unknown;
  eventName?: unknown;
  distributionStartDate: unknown;
  distributionEndDate?: unknown;
  distributionTimeZone?: unknown;
  distributionAvailabilitySlots?: unknown;
}):
  | {
      eventId: string;
      eventName: string;
      distributionStartDate: string;
      distributionEndDate: string;
      distributionAvailabilitySlots: string[];
      distributionTimeZone: string;
    }
  | { error: string } {
  const normalizedDateRange = normalizeDistributionDateRange(
    params.distributionStartDate,
    params.distributionEndDate,
  );
  if (normalizedDateRange.error) {
    return { error: normalizedDateRange.error };
  }

  const timeZone =
    typeof params.distributionTimeZone === 'string' && params.distributionTimeZone.trim()
      ? params.distributionTimeZone.trim()
      : DEFAULT_TIME_ZONE;
  const eventId =
    typeof params.eventId === 'string' && params.eventId.trim()
      ? params.eventId.trim()
      : `kodai${params.year}`;

  return {
    eventId,
    eventName:
      typeof params.eventName === 'string' && params.eventName.trim()
        ? params.eventName.trim()
        : `工大祭${params.year}`,
    distributionStartDate: normalizedDateRange.startDateStr,
    distributionEndDate: normalizedDateRange.endDateStr,
    distributionAvailabilitySlots: buildDistributionAvailabilitySlotKeys(
      normalizedDateRange.startDateStr,
      normalizedDateRange.endDateStr,
      params.distributionAvailabilitySlots,
    ),
    distributionTimeZone: timeZone,
  };
}

export function buildDistributionEventUpdateDefaults(params: {
  eventName?: unknown;
  distributionStartDate?: unknown;
  distributionEndDate?: unknown;
  distributionTimeZone?: unknown;
  distributionAvailabilitySlots?: unknown;
  isActive?: unknown;
}): { update: Record<string, unknown>; error: string | null } {
  const update: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (params.distributionTimeZone !== undefined) {
    const timeZone =
      typeof params.distributionTimeZone === 'string' && params.distributionTimeZone.trim()
        ? params.distributionTimeZone.trim()
        : DEFAULT_TIME_ZONE;
    update.distributionTimeZone = timeZone;
  }

  if (typeof params.eventName === 'string') update.eventName = params.eventName;
  if (typeof params.isActive === 'boolean') update.isActive = params.isActive;

  if (params.distributionStartDate || params.distributionEndDate) {
    const normalizedDateRange = normalizeDistributionDateRange(
      params.distributionStartDate,
      params.distributionEndDate,
    );
    if (normalizedDateRange.error) {
      return { update, error: normalizedDateRange.error };
    }
    update.distributionStartDate = normalizedDateRange.startDateStr;
    update.distributionEndDate = normalizedDateRange.endDateStr;
  }

  if (Array.isArray(params.distributionAvailabilitySlots)) {
    update.distributionAvailabilitySlots = params.distributionAvailabilitySlots.filter(
      (slot) => typeof slot === 'string',
    );
  }

  return { update, error: null };
}

export function serializeEventDoc(id: string, data: Record<string, unknown>) {
  const timeZone = (data.distributionTimeZone as string) || DEFAULT_TIME_ZONE;
  const createdAt = serializeDateTimeValue(data.createdAt);
  const updatedAt = serializeDateTimeValue(data.updatedAt);
  return {
    id,
    ...data,
    distributionTimeZone: timeZone,
    createdAt,
    updatedAt,
    distributionStartDate: serializeDateOnlyValue(data.distributionStartDate, timeZone),
    distributionEndDate: serializeDateOnlyValue(data.distributionEndDate, timeZone),
    distributionAvailabilitySlots: Array.isArray(data.distributionAvailabilitySlots)
      ? data.distributionAvailabilitySlots
      : undefined,
  };
}
