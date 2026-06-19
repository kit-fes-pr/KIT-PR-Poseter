export type AvailableTime = 'morning' | 'afternoon' | 'both' | 'other';

export const UNAVAILABLE_SLOT_KEY = 'unavailable' as const;
export const ALL_AVAILABLE_SLOT_KEY = 'all_available' as const;
export type AvailabilitySlotKey =
  | `${string}_${'am' | 'pm'}`
  | typeof UNAVAILABLE_SLOT_KEY
  | typeof ALL_AVAILABLE_SLOT_KEY;

export interface AvailabilityChoice {
  key: AvailableTime;
  label: string;
  enabled: boolean;
}

export interface AvailabilitySlotChoice {
  key: AvailabilitySlotKey;
  label: string;
  date?: string;
  period?: 'am' | 'pm' | 'special';
}

export const SPECIAL_AVAILABILITY_SLOT_CHOICES: AvailabilitySlotChoice[] = [
  { key: UNAVAILABLE_SLOT_KEY, label: '参加不可', period: 'special' },
  { key: ALL_AVAILABLE_SLOT_KEY, label: '全て可能', period: 'special' },
];

export const DEFAULT_AVAILABILITY_CHOICES: Array<Pick<AvailabilityChoice, 'key' | 'label'>> = [
  { key: 'morning', label: '午前のみ参加可能' },
  { key: 'afternoon', label: '午後のみ参加可能' },
  { key: 'both', label: '両時間参加可能' },
  { key: 'other', label: '参加不可' },
];

export function createDefaultAvailabilityChoices(): AvailabilityChoice[] {
  return DEFAULT_AVAILABILITY_CHOICES.map((choice) => ({
    ...choice,
    enabled: true,
  }));
}

export function buildAvailabilityChoicesFromLabels(labels?: string[] | null): AvailabilityChoice[] {
  return DEFAULT_AVAILABILITY_CHOICES.map((choice) => ({
    ...choice,
    enabled: (labels || []).includes(choice.label),
  }));
}

export function serializeAvailabilityChoiceLabels(choices: AvailabilityChoice[]): string[] {
  return choices
    .filter((choice) => choice.enabled)
    .map((choice) => choice.label.trim())
    .filter((label) => label.length > 0);
}

export function getAvailabilityDisplayLabel(value: AvailableTime | string | null | undefined): string {
  if (!value) return '-';
  if (value === 'morning') return '午前';
  if (value === 'afternoon') return '午後';
  if (value === 'both') return '両方';
  if (value === 'other') return '参加不可';
  return value;
}

// 安定キーへの正規化関数
export function normalizeAvailableTime(
  input: unknown,
  options?: string[] | null,
  defaultValue: AvailableTime = 'other'
): AvailableTime {
  // 1) すでに安定キーの場合
  if (
    input === 'morning' ||
    input === 'afternoon' ||
    input === 'both' ||
    input === 'other'
  ) {
    return input;
  }

  if (typeof input === 'number' && Number.isInteger(input) && options && options.length > 0) {
    const option = options[input];
    if (option === '午前のみ参加可能') return 'morning';
    if (option === '午後のみ参加可能') return 'afternoon';
    if (option === '両時間参加可能') return 'both';
    if (option === '参加不可') return 'other';
  }

  if (typeof input === 'string') {
    const value = input.trim();
    if (value === '午前のみ参加可能') return 'morning';
    if (value === '午後のみ参加可能') return 'afternoon';
    if (value === '両時間参加可能') return 'both';
    if (value === '参加不可') return 'other';
  }

  return defaultValue;
}

function parseDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toSafeDate(value: unknown): Date | null {
  if (!value) return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  }

  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate?: () => Date }).toDate === 'function') {
    const date = (value as { toDate: () => Date }).toDate();
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

export function buildAvailabilitySlotChoices(
  startDate: unknown,
  endDate: unknown
): AvailabilitySlotChoice[] {
  const start = toSafeDate(startDate);
  const end = toSafeDate(endDate) || start;

  if (!start || !end) {
    return [];
  }

  const choices: AvailabilitySlotChoice[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());

  while (cursor.getTime() <= last.getTime()) {
    const dateKey = parseDateKey(cursor);
    const displayLabel = cursor.toLocaleDateString('ja-JP', {
      month: 'numeric',
      day: 'numeric',
    });

    choices.push({
      key: `${dateKey}_am`,
      label: `${displayLabel} 午前`,
      date: dateKey,
      period: 'am',
    });
    choices.push({
      key: `${dateKey}_pm`,
      label: `${displayLabel} 午後`,
      date: dateKey,
      period: 'pm',
    });

    cursor.setDate(cursor.getDate() + 1);
  }

  return choices;
}

export function formatAvailabilitySlotLabel(key: string): string {
  if (key === 'morning') return '午前';
  if (key === 'afternoon') return '午後';
  if (key === 'both') return '両方';
  if (key === 'other') return '参加不可';
  if (key === UNAVAILABLE_SLOT_KEY) return '参加不可';
  if (key === ALL_AVAILABLE_SLOT_KEY) return '全て可能';

  const match = key.match(/^(\d{4}-\d{2}-\d{2})_(am|pm)$/);
  if (!match) return key;

  const [, datePart, period] = match;
  const date = new Date(`${datePart}T00:00:00`);
  if (isNaN(date.getTime())) return key;

  const dateLabel = date.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: 'numeric',
  });

  return `${dateLabel} ${period === 'am' ? '午前' : '午後'}`;
}

export function getAvailabilityDateSlotKeys(choices: Array<{ key: string }>): string[] {
  return choices
    .map((choice) => choice.key)
    .filter((key) => key !== UNAVAILABLE_SLOT_KEY && key !== ALL_AVAILABLE_SLOT_KEY);
}

export function toggleAvailabilitySelection(
  currentValues: string[],
  clickedValue: string,
  allDateSlotKeys: string[]
): string[] {
  const current = Array.from(new Set(currentValues.filter(Boolean)));

  if (clickedValue === UNAVAILABLE_SLOT_KEY) {
    if (current.includes(UNAVAILABLE_SLOT_KEY)) {
      return current.filter((value) => value !== UNAVAILABLE_SLOT_KEY);
    }
    return [UNAVAILABLE_SLOT_KEY];
  }

  if (clickedValue === ALL_AVAILABLE_SLOT_KEY) {
    if (current.includes(ALL_AVAILABLE_SLOT_KEY)) {
      return [];
    }
    return Array.from(new Set([...allDateSlotKeys, ALL_AVAILABLE_SLOT_KEY]));
  }

  const nextValues = current.includes(clickedValue)
    ? current.filter((value) => value !== clickedValue)
    : [...current.filter((value) => value !== ALL_AVAILABLE_SLOT_KEY && value !== UNAVAILABLE_SLOT_KEY), clickedValue];

  return nextValues;
}

export function validateAvailabilitySelection(values: unknown): string | null {
  const selected = normalizeAvailabilitySlots(values);
  if (selected.includes(UNAVAILABLE_SLOT_KEY) && selected.includes(ALL_AVAILABLE_SLOT_KEY)) {
    return '参加不可と全て可能は同時に選択できません';
  }
  return null;
}

export function normalizeAvailabilitySlots(input: unknown): string[] {
  if (Array.isArray(input)) {
    return Array.from(
      new Set(
        input
          .map((value) => normalizeAvailabilitySlotValue(value))
          .filter((value): value is string => Boolean(value))
      )
    );
  }

  const normalized = normalizeAvailabilitySlotValue(input);
  return normalized ? [normalized] : [];
}

export function normalizeAvailabilitySlotValue(input: unknown): string | null {
  if (typeof input !== 'string') return null;

  const value = input.trim();
  if (!value) return null;

  if (value === UNAVAILABLE_SLOT_KEY || value === ALL_AVAILABLE_SLOT_KEY) {
    return value;
  }

  const legacyMap: Record<string, string> = {
    午前のみ参加可能: 'morning',
    午後のみ参加可能: 'afternoon',
    両時間参加可能: 'both',
    参加不可: UNAVAILABLE_SLOT_KEY,
    全て可能: ALL_AVAILABLE_SLOT_KEY,
  };

  if (legacyMap[value]) return legacyMap[value];

  if (/^\d{4}-\d{2}-\d{2}_(am|pm)$/.test(value)) {
    return value;
  }

  return value;
}

export function deriveLegacyAvailableTimeFromSlots(slots: string[]): AvailableTime {
  const normalized = normalizeAvailabilitySlots(slots);
  if (normalized.length === 0) return 'other';
  if (normalized.includes(UNAVAILABLE_SLOT_KEY)) return 'other';
  if (normalized.includes(ALL_AVAILABLE_SLOT_KEY)) return 'both';

  const hasAm = normalized.some((slot) => slot.endsWith('_am'));
  const hasPm = normalized.some((slot) => slot.endsWith('_pm'));

  if (hasAm && hasPm) return 'both';
  if (hasAm) return 'morning';
  if (hasPm) return 'afternoon';
  return 'other';
}
