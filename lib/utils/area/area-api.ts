import { normalizeAdjacentAreas } from './area';

export function buildAreaCreateData(input: {
  areaCode: unknown;
  areaName: unknown;
  adjacentAreas: unknown;
  description?: unknown;
}): {
  areaCode: string;
  areaName: string;
  adjacentAreas: string[];
  description: string;
} {
  return {
    areaCode: String(input.areaCode || '').trim(),
    areaName: String(input.areaName || '').trim(),
    adjacentAreas: normalizeAdjacentAreas(input.adjacentAreas),
    description: typeof input.description === 'string' ? input.description : '',
  };
}

export function buildAreaUpdateData(input: {
  areaCode: unknown;
  areaName: unknown;
  adjacentAreas: unknown;
  description?: unknown;
}): {
  areaCode: string;
  areaName: string;
  adjacentAreas: string[];
  description: string;
} {
  return buildAreaCreateData(input);
}

export function shouldRefreshTeamAfterAreaChange(params: {
  team: { areaId?: unknown; assignedArea?: unknown };
  areaId: string;
  previousAreaCode: string;
}): boolean {
  return (
    String(params.team.areaId || '') === params.areaId ||
    (Boolean(params.previousAreaCode) &&
      String(params.team.assignedArea || '') === params.previousAreaCode)
  );
}

export function shouldBlockAreaDeletion(params: {
  linkedByAreaIdExists: boolean;
  linkedByAssignedAreaExists: boolean;
}): boolean {
  return params.linkedByAreaIdExists || params.linkedByAssignedAreaExists;
}
