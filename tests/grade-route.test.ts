import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { buildResponsesParticipantGradeValidation } from '../lib/utils/grade-route';

describe('grade route utils', () => {
  test('buildResponsesParticipantGradeValidation accepts route-compatible inputs', () => {
    const valid = buildResponsesParticipantGradeValidation({ grade: '3年生', section: '企画系' });
    assert.equal(valid.gradeNum, 3);
    assert.deepEqual(valid.errors, []);
  });

  test('buildResponsesParticipantGradeValidation rejects incompatible grade section pairs', () => {
    assert.deepEqual(
      buildResponsesParticipantGradeValidation({ grade: 4, section: '企画系' }).errors,
      ['4年生の場合、所属セクションは4年である必要があります'],
    );
    assert.deepEqual(
      buildResponsesParticipantGradeValidation({ grade: '2', section: '4年' }).errors,
      ['1-3年生の場合、所属セクションに4年は指定できません'],
    );
  });
});

