import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildParticipantGradeValidation } from '../lib/utils/grade-api';

describe('grade api utils', () => {
  test('buildParticipantGradeValidation accepts valid grades and sections', () => {
    const first = buildParticipantGradeValidation({ grade: '3年', section: '企画系' });
    assert.equal(first.gradeNum, 3);
    assert.deepEqual(first.errors, []);

    const fourth = buildParticipantGradeValidation({ grade: 4, section: '4年' });
    assert.equal(fourth.gradeNum, 4);
    assert.deepEqual(fourth.errors, []);
  });

  test('buildParticipantGradeValidation rejects invalid grade and section combinations', () => {
    assert.deepEqual(buildParticipantGradeValidation({ grade: '', section: '1年' }).errors, [
      '学年は1-4の範囲で選択してください',
    ]);

    assert.deepEqual(buildParticipantGradeValidation({ grade: 4, section: '企画系' }).errors, [
      '4年生の場合、所属セクションは4年である必要があります',
    ]);

    assert.deepEqual(buildParticipantGradeValidation({ grade: '2', section: '4年' }).errors, [
      '1-3年生の場合、所属セクションに4年は指定できません',
    ]);
  });
});
