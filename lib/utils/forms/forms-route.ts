import type { FormCreateData, FormUpdateData } from '@/types/forms';
import { buildFormCreateRecord, buildFormUpdateRecord, normalizeFormAuthHeader } from './forms-api';

export function normalizeFormsRouteAuthHeader(authHeader: string | null): string | null {
  return normalizeFormAuthHeader(authHeader);
}

export function parseFormsListEventId(eventIdParam: unknown): string {
  return typeof eventIdParam === 'string' && eventIdParam.trim()
    ? eventIdParam.trim()
    : 'kodai2025';
}

export function buildFormsCreatePayload(
  input: FormCreateData & {
    eventId?: string;
    year?: number;
    createdBy: string;
    createdAt?: Date;
    updatedAt?: Date;
  },
) {
  return buildFormCreateRecord({
    title: input.title,
    description: input.description ?? '',
    fields: input.fields,
    eventId: input.eventId ?? '',
    year: input.year ?? '',
    createdBy: input.createdBy,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  });
}

export function buildFormsUpdatePayload(input: {
  title?: unknown;
  description?: unknown;
  isActive?: unknown;
  fields?: FormUpdateData['fields'];
  updatedAt?: Date;
}) {
  return buildFormUpdateRecord(input);
}
