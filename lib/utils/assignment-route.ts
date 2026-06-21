export function normalizeAssignmentAuthHeader(authHeader: string | null): string | null {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split('Bearer ')[1]?.trim();
  return token || null;
}

export function parseAssignmentListQuery(
  searchParams: URLSearchParams,
): { year: number; formId: string | null } | { error: string } {
  const year = searchParams.get('year');
  const formId = searchParams.get('formId');

  if (!year || !/^\d{4}$/.test(year.trim())) {
    return { error: '年度が必要です' };
  }

  return {
    year: Number(year.trim()),
    formId: formId?.trim() || null,
  };
}

export function parseAssignmentMutationPayload(input: {
  year: unknown;
  formId: unknown;
  responseId: unknown;
  teamId: unknown;
  timeSlot?: unknown;
}):
  | {
      year: number;
      formId: string;
      responseId: string;
      teamId: string;
      timeSlot?: unknown;
    }
  | { error: string } {
  const year =
    typeof input.year === 'number'
      ? input.year
      : typeof input.year === 'string' && /^\d{4}$/.test(input.year.trim())
        ? Number(input.year.trim())
        : Number.NaN;

  const formId = typeof input.formId === 'string' ? input.formId.trim() : '';
  const responseId = typeof input.responseId === 'string' ? input.responseId.trim() : '';
  const teamId = typeof input.teamId === 'string' ? input.teamId.trim() : '';

  if (!Number.isInteger(year) || year <= 0) {
    return { error: '年度が必要です' };
  }

  if (!formId || !responseId || !teamId) {
    return { error: 'year, formId, responseId, teamId は必須です' };
  }

  return {
    year,
    formId,
    responseId,
    teamId,
    timeSlot: input.timeSlot,
  };
}
