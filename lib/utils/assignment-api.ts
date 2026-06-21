import { normalizeTeamTimeSlot } from './team';

export function normalizeAssignmentYear(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (/^\d{4}$/.test(normalized)) {
      return Number(normalized);
    }
  }

  return undefined;
}

export function buildManualAssignmentRecord(input: {
  year: unknown;
  formId: unknown;
  responseId: unknown;
  teamId: unknown;
  timeSlot: unknown;
  assignedAt?: Date;
}):
  | {
      year: number;
      formId: string;
      responseId: string;
      teamId: string;
      timeSlot: string;
      assignedAt: Date;
      assignedBy: 'manual';
    }
  | null {
  const year = normalizeAssignmentYear(input.year);
  const formId = typeof input.formId === 'string' ? input.formId.trim() : '';
  const responseId = typeof input.responseId === 'string' ? input.responseId.trim() : '';
  const teamId = typeof input.teamId === 'string' ? input.teamId.trim() : '';
  const timeSlot = normalizeTeamTimeSlot(input.timeSlot);

  if (!year || !formId || !responseId || !teamId || !timeSlot) {
    return null;
  }

  return {
    year,
    formId,
    responseId,
    teamId,
    timeSlot,
    assignedAt: input.assignedAt || new Date(),
    assignedBy: 'manual',
  };
}
