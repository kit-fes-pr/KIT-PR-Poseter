import { serializeDateTimeValue } from '../dateUtils';

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

export function buildTeamIncrementalTeamView(input: {
  teamId: string;
  data: Record<string, unknown>;
}) {
  return {
    teamId: input.teamId,
    ...input.data,
    createdAt: serializeDateTimeValue(input.data.createdAt),
    updatedAt: serializeDateTimeValue(input.data.updatedAt),
    validStartDate: serializeDateTimeValue(input.data.validStartDate),
    validEndDate: serializeDateTimeValue(input.data.validEndDate),
    validDate: serializeDateTimeValue(input.data.validDate),
  };
}

export function buildTeamIncrementalDeletedTeamView(input: {
  teamId: string;
  data: Record<string, unknown>;
}): { teamId: string; deleted: true; deletedAt: string | Date } {
  return {
    teamId: input.teamId,
    deleted: true as const,
    deletedAt: serializeDateTimeValue(input.data.deletedAt) as string | Date,
  };
}
