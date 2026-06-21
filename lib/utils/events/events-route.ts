import { resolveDistributionEventLookup } from './events-api';
import {
  buildDistributionEventCreateDefaults,
  buildDistributionEventUpdateDefaults,
  normalizeDistributionYear,
} from './events';

export function normalizeEventsAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();
  return token || null;
}

export function parseEventsListYear(yearParam: unknown): number | null {
  return normalizeDistributionYear(yearParam);
}

export function buildEventsCreatePayload(params: {
  year: unknown;
  eventName?: unknown;
  distributionStartDate: unknown;
  distributionEndDate?: unknown;
  distributionTimeZone?: unknown;
  distributionAvailabilitySlots?: unknown;
  eventId?: unknown;
}) {
  const year = normalizeDistributionYear(params.year);
  if (year === null) {
    return { error: '年度の形式が不正です' };
  }

  const defaults = buildDistributionEventCreateDefaults({
    year,
    eventId: params.eventId,
    eventName: params.eventName,
    distributionStartDate: params.distributionStartDate,
    distributionEndDate: params.distributionEndDate,
    distributionTimeZone: params.distributionTimeZone,
    distributionAvailabilitySlots: params.distributionAvailabilitySlots,
  });

  if ('error' in defaults) {
    return defaults;
  }

  return {
    year,
    defaults,
  };
}

export function buildEventsUpdateLookup(params: { id?: unknown; year?: unknown }) {
  return resolveDistributionEventLookup(params);
}

export function buildEventsUpdatePayload(params: {
  eventName?: unknown;
  distributionStartDate?: unknown;
  distributionEndDate?: unknown;
  distributionTimeZone?: unknown;
  distributionAvailabilitySlots?: unknown;
  isActive?: unknown;
}) {
  return buildDistributionEventUpdateDefaults(params);
}
