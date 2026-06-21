import { buildParticipantGradeValidation } from './grade-api';

export function buildResponsesParticipantGradeValidation(input: {
  grade: unknown;
  section: unknown;
}): { gradeNum: number; errors: string[] } {
  return buildParticipantGradeValidation(input);
}

