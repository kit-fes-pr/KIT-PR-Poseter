export type AvailableTime = 'morning' | 'afternoon' | 'both' | 'other';

export interface AvailabilityChoice {
  key: AvailableTime;
  label: string;
  enabled: boolean;
}

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
