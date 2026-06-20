'use client';

import { Control, FieldValues, Path, useController } from 'react-hook-form';
import { ParticipantIdentityFields } from '@/components/forms/ParticipantIdentityFields';

type ParticipantIdentityFormValues = {
  participantName: string;
  participantGrade: string;
  participantSection: string;
};

type ParticipantIdentitySectionProps<TFieldValues extends ParticipantIdentityFormValues & FieldValues> = {
  control: Control<TFieldValues>;
};

export function ParticipantIdentitySection<TFieldValues extends ParticipantIdentityFormValues & FieldValues>({
  control,
}: ParticipantIdentitySectionProps<TFieldValues>) {
  const nameField = useController({
    control,
    name: 'participantName' as Path<TFieldValues>,
    rules: { required: 'お名前は必須です' },
  });
  const gradeField = useController({
    control,
    name: 'participantGrade' as Path<TFieldValues>,
    rules: { required: '学年は必須です' },
  });
  const sectionField = useController({
    control,
    name: 'participantSection' as Path<TFieldValues>,
    rules: { required: '所属セクションは必須です' },
  });

  return (
    <ParticipantIdentityFields
      name={String(nameField.field.value || '')}
      grade={String(gradeField.field.value || '')}
      section={String(sectionField.field.value || '')}
      onNameChange={nameField.field.onChange}
      onGradeChange={gradeField.field.onChange}
      onSectionChange={sectionField.field.onChange}
      nameError={nameField.fieldState.error?.message}
      gradeError={gradeField.fieldState.error?.message}
      sectionError={sectionField.fieldState.error?.message}
      sectionDisabled={gradeField.field.value === '4'}
    />
  );
}
