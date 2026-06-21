import { normalizeGrade } from './grade';

export function buildParticipantGradeValidation(input: {
  grade: unknown;
  section: unknown;
}): { gradeNum: number; errors: string[] } {
  const gradeNum = normalizeGrade(input.grade);
  const errors: string[] = [];

  if (!input.grade || gradeNum < 1 || gradeNum > 4) {
    errors.push('学年は1-4の範囲で選択してください');
  }

  if (gradeNum === 4 && input.section !== '4年') {
    errors.push('4年生の場合、所属セクションは4年である必要があります');
  }

  if (gradeNum >= 1 && gradeNum <= 3 && input.section === '4年') {
    errors.push('1-3年生の場合、所属セクションに4年は指定できません');
  }

  return { gradeNum, errors };
}

