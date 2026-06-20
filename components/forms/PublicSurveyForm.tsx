'use client';

import { Control, Controller, Path, UseFormHandleSubmit } from 'react-hook-form';
import { SurveyForm, FormField } from '@/types/forms';
import { ParticipantIdentityFormValues, ParticipantIdentitySection } from '@/components/forms/ParticipantIdentitySection';
import { SurveyFieldBlock, buildSurveyFieldRules } from '@/components/forms/SurveyFieldBlock';

type PublicSurveyFormProps = {
  form: SurveyForm | null;
  control: Control<ParticipantIdentityFormValues>;
  handleSubmit: UseFormHandleSubmit<ParticipantIdentityFormValues>;
  onSubmit: (data: ParticipantIdentityFormValues) => void | Promise<void>;
  submitting?: boolean;
  submitLabel: string;
};

export function PublicSurveyForm({
  form,
  control,
  handleSubmit,
  onSubmit,
  submitting = false,
  submitLabel,
}: PublicSurveyFormProps) {
  const renderField = (field: FormField) => (
    <Controller
      key={field.fieldId}
      name={field.fieldId as Path<ParticipantIdentityFormValues>}
      control={control}
      defaultValue={(field.type === 'checkbox' ? [] : '') as never}
      rules={buildSurveyFieldRules(field) as never}
      render={({ field: controllerField, fieldState }) => (
        <SurveyFieldBlock
          field={field}
          mode="interactive"
          value={controllerField.value}
          onValueChange={controllerField.onChange}
          errorMessage={fieldState.error?.message}
        />
      )}
    />
  );

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <ParticipantIdentitySection control={control} />

      {form?.fields
        .sort((a, b) => a.order - b.order)
        .map((field) => renderField(field))}

      <div className="pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-3 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
        >
          {submitting ? '送信中...' : submitLabel}
        </button>
      </div>
    </form>
  );
}
