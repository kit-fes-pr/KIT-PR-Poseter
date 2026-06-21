import { DEFAULT_TIME_ZONE } from './dateUtils';

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

export function serializeDateOnlyValue(value: unknown, timeZone = DEFAULT_TIME_ZONE): string | unknown {
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
