import { buildAreaCreateData, buildAreaUpdateData } from './area-api';
import { normalizeAdjacentAreas } from './area';

export function normalizeAreaAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();
  return token || null;
}

export function hasRequiredAreaPayload(input: { areaCode?: unknown; areaName?: unknown }): boolean {
  return Boolean(String(input.areaCode || '').trim() && String(input.areaName || '').trim());
}

export function buildAreaRouteCreateData(input: {
  areaCode: unknown;
  areaName: unknown;
  adjacentAreas: unknown;
  description?: unknown;
  createdAt?: Date;
}): {
  areaCode: string;
  areaName: string;
  adjacentAreas: string[];
  description: string;
  createdAt: Date;
} {
  return {
    ...buildAreaCreateData(input),
    createdAt: input.createdAt || new Date(),
  };
}

export function buildAreaRouteUpdateData(input: {
  areaCode: unknown;
  areaName: unknown;
  adjacentAreas: unknown;
  description?: unknown;
  updatedAt?: Date;
}): {
  areaCode: string;
  areaName: string;
  adjacentAreas: string[];
  description: string;
  updatedAt: Date;
} {
  return {
    ...buildAreaUpdateData(input),
    updatedAt: input.updatedAt || new Date(),
  };
}

export function normalizeAreaRouteAdjacency(value: unknown): string[] {
  return normalizeAdjacentAreas(value);
}
