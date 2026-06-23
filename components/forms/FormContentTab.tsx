'use client';

import { useEffect, useState } from 'react';
import { FormField } from '@/types/forms';
import { SurveyFieldBlock } from '@/components/forms/SurveyFieldBlock';

type FormContentTabProps = {
  draftTitle: string;
  draftDescription: string;
  onDraftTitleChange: (value: string) => void;
  onDraftDescriptionChange: (value: string) => void;
  carUsageVisibleFromGrade: string;
  onCarUsageVisibleFromGradeChange: (value: string) => void;
  previewFields: FormField[];
  availabilityChoices: string[];
};

export function FormContentTab({
  draftTitle,
  draftDescription,
  onDraftTitleChange,
  onDraftDescriptionChange,
  carUsageVisibleFromGrade,
  onCarUsageVisibleFromGradeChange,
  previewFields,
  availabilityChoices,
}: FormContentTabProps) {
  const buildInitialPreviewValues = (fields: FormField[]) => {
    return fields.reduce<Record<string, string | string[]>>((acc, field) => {
      acc[field.fieldId] = field.type === 'checkbox' ? [] : '';
      return acc;
    }, {});
  };

  const [previewValues, setPreviewValues] = useState<Record<string, string | string[]>>(() =>
    buildInitialPreviewValues(previewFields),
  );

  useEffect(() => {
    setPreviewValues(buildInitialPreviewValues(previewFields));
  }, [previewFields]);

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-lg font-semibold text-gray-900">フォーム内容</h3>
        <div className="mt-5 space-y-4">
          <div>
            <label htmlFor="content-title" className="block text-sm font-medium text-gray-700">
              フォームタイトル *
            </label>
            <input
              id="content-title"
              value={draftTitle}
              onChange={(e) => onDraftTitleChange(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 focus:border-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="content-description"
              className="block text-sm font-medium text-gray-700"
            >
              説明文
            </label>
            <textarea
              id="content-description"
              rows={4}
              value={draftDescription}
              onChange={(e) => onDraftDescriptionChange(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 focus:border-indigo-500"
            />
          </div>

          <div>
            <label
              htmlFor="car-usage-visible-from-grade"
              className="block text-sm font-medium text-gray-700"
            >
              車を利用するフォームの表示対象学年
            </label>
            <select
              id="car-usage-visible-from-grade"
              value={carUsageVisibleFromGrade}
              onChange={(e) => onCarUsageVisibleFromGradeChange(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-0 focus:border-indigo-500"
            >
              <option value="0">車を利用しない</option>
              <option value="1">1年生以上</option>
              <option value="2">2年生以上</option>
              <option value="3">3年生以上</option>
              <option value="4">4年生以上</option>
            </select>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {previewFields
          .filter((field) => field.fieldId !== 'carUsage' || carUsageVisibleFromGrade !== '0')
          .map((field) => (
            <div
              key={field.fieldId}
              className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm"
            >
              <SurveyFieldBlock
                field={
                  field.fieldId === 'availability'
                    ? { ...field, options: availabilityChoices }
                    : field
                }
                value={previewValues[field.fieldId]}
                onValueChange={(value) => {
                  setPreviewValues((current) => ({
                    ...current,
                    [field.fieldId]: value,
                  }));
                }}
              />
            </div>
          ))}
      </div>
    </div>
  );
}
