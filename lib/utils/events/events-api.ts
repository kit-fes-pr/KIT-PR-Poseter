import { normalizeDistributionYear } from './events';

export function resolveDistributionEventLookup(input: {
  id?: unknown;
  year?: unknown;
}): { type: 'id'; id: string } | { type: 'year'; year: number } | { type: 'error'; error: string } {
  if (typeof input.id === 'string' && input.id.trim()) {
    return { type: 'id', id: input.id.trim() };
  }

  const year = normalizeDistributionYear(input.year);
  if (year === null) {
    return { type: 'error', error: 'id か year を指定してください' };
  }

  return { type: 'year', year };
}

export function shouldBlockDistributionEventDeletion(params: {
  storesExist: boolean;
  teamsExist: boolean;
}): boolean {
  return params.storesExist || params.teamsExist;
}

export function normalizeDistributionEventListYear(yearParam: unknown): number | null {
  return normalizeDistributionYear(yearParam);
}
