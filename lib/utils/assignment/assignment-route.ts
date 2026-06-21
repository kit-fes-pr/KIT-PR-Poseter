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

export function parseAssignmentMutationPayload(input: unknown):
  | {
      year: number;
      formId: string;
      responseId: string;
      teamId: string;
      timeSlot?: unknown;
    }
  | { error: string } {
  if (typeof input !== 'object' || input === null) {
    return { error: 'リクエストボディが不正です' };
  }
  const payload = input as Record<string, unknown>;

  const year =
    typeof payload.year === 'number'
      ? payload.year
      : typeof payload.year === 'string' && /^\d{4}$/.test(payload.year.trim())
        ? Number(payload.year.trim())
        : Number.NaN;

  const formId = typeof payload.formId === 'string' ? payload.formId.trim() : '';
  const responseId = typeof payload.responseId === 'string' ? payload.responseId.trim() : '';
  const teamId = typeof payload.teamId === 'string' ? payload.teamId.trim() : '';

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
    timeSlot: payload.timeSlot,
  };
}
