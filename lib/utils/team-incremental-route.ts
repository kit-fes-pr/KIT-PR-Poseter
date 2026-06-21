export function normalizeTeamIncrementalAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();
  return token || null;
}

export function parseTeamIncrementalQuery(input: {
  year: unknown;
  lastUpdated: unknown;
  includeDeleted: unknown;
}) {
  const year = typeof input.year === 'string' ? input.year.trim() : '';
  const lastUpdated = typeof input.lastUpdated === 'string' ? input.lastUpdated.trim() : '';
  const includeDeleted =
    input.includeDeleted === true ||
    input.includeDeleted === 'true' ||
    input.includeDeleted === '1';

  return {
    year,
    lastUpdated,
    includeDeleted,
    yearNum: year ? Number(year) : NaN,
    lastUpdatedDate: lastUpdated ? new Date(lastUpdated) : null,
  };
}

export function serializeTeamIncrementalDateValue(value: unknown): string | unknown {
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

export function buildTeamIncrementalTeamView(input: {
  teamId: string;
  data: Record<string, unknown>;
}) {
  return {
    teamId: input.teamId,
    ...input.data,
    createdAt: serializeTeamIncrementalDateValue(input.data.createdAt),
    updatedAt: serializeTeamIncrementalDateValue(input.data.updatedAt),
    validStartDate: serializeTeamIncrementalDateValue(input.data.validStartDate),
    validEndDate: serializeTeamIncrementalDateValue(input.data.validEndDate),
    validDate: serializeTeamIncrementalDateValue(input.data.validDate),
  };
}

export function buildTeamIncrementalDeletedTeamView(input: {
  teamId: string;
  data: Record<string, unknown>;
}): { teamId: string; deleted: true; deletedAt: string | Date } {
  return {
    teamId: input.teamId,
    deleted: true as const,
    deletedAt: serializeTeamIncrementalDateValue(input.data.deletedAt) as string | Date,
  };
}
