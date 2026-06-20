'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { LoadingInline } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import { SurveyForm, FormAnswer } from '@/types/forms';
import {
  getAvailabilityDateSlotKeys,
  formatAvailabilitySlotLabel,
  normalizeAvailabilitySlots,
  UNAVAILABLE_SLOT_KEY,
  ALL_AVAILABLE_SLOT_KEY,
  toggleAvailabilitySelection,
} from '@/lib/utils/availability';

interface FormData {
  [fieldId: string]: string | string[];
  // 参加者必須情報
  participantName: string;
  participantGrade: string;
  participantSection: string;
}

interface SavedResponseDraft {
  responseId: string;
  editToken: string;
  values: FormData;
}

export default function FormResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submissionMode, setSubmissionMode] = useState<'submit' | 'update'>('submit');
  const [savedResponseDraft, setSavedResponseDraft] = useState<SavedResponseDraft | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingResponseId, setEditingResponseId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors }, watch, setValue, getValues, reset } = useForm<FormData>();
  const participantGrade = watch('participantGrade');

  useEffect(() => {
    if (participantGrade === '4') {
      setValue('participantSection', '4年', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
      return;
    }

    if (getValues('participantSection') === '4年') {
      setValue('participantSection', '', {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: true,
      });
    }
  }, [participantGrade, setValue, getValues]);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    if (!resolvedParams) return;

    const loadForm = async () => {
      try {
        setLoading(true);
        const res = await fetch(`/api/forms/${resolvedParams.id}`);
        const data = await res.json();

        if (res.ok) {
          setForm(data);
        } else {
          setError(data.error || 'フォームの取得に失敗しました');
        }
      } catch (err) {
        setError('フォームの取得に失敗しました');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadForm();
  }, [resolvedParams]);

  useEffect(() => {
    if (!resolvedParams || !form) return;

    const storageKey = `form-response-${resolvedParams.id}`;
    const stored = localStorage.getItem(storageKey);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as Partial<SavedResponseDraft>;
      if (!parsed.responseId || !parsed.editToken || !parsed.values) return;
      setSavedResponseDraft({
        responseId: parsed.responseId,
        editToken: parsed.editToken,
        values: parsed.values as FormData,
      });
      setSubmitted(true);
      setSubmissionMode('submit');
    } catch (err) {
      console.error('保存済み回答の読み込みに失敗しました', err);
    }
  }, [resolvedParams, form]);

  const storageKey = resolvedParams ? `form-response-${resolvedParams.id}` : '';

  const persistSavedResponseDraft = (draft: SavedResponseDraft) => {
    setSavedResponseDraft(draft);
    if (!storageKey) return;
    localStorage.setItem(storageKey, JSON.stringify(draft));
  };

  const clearSavedResponseDraft = () => {
    setSavedResponseDraft(null);
    setEditingResponseId(null);
    setSubmitted(false);
    if (storageKey) {
      localStorage.removeItem(storageKey);
    }
  };

  const openEditModal = () => {
    if (!savedResponseDraft) return;
    reset(savedResponseDraft.values);
    setEditingResponseId(savedResponseDraft.responseId);
    setShowEditModal(true);
    setSubmitted(false);
    setError('');
  };

  const onSubmit = async (data: FormData) => {
    if (!form || !resolvedParams) return;

    try {
      setSubmitting(true);
      setError('');

      for (const field of form.fields) {
        const rawValue = data[field.fieldId];

        if (field.type === 'select' || field.type === 'radio') {
          if (typeof rawValue === 'string' && rawValue && !field.options?.includes(rawValue)) {
            setError(`${field.label}の選択肢が正しくありません`);
            return;
          }
        }

        if (field.type === 'checkbox') {
          if (!Array.isArray(rawValue)) {
            setError(`${field.label}は配列で送信してください`);
            return;
          }

          const invalidValue = rawValue.find((value) => !field.options?.includes(value));
          if (invalidValue) {
            setError(`${field.label}の選択肢が正しくありません`);
            return;
          }
        }
      }

      // フォームデータを変換
      const answers: FormAnswer[] = form.fields.map(field => ({
        fieldId: field.fieldId,
        value: data[field.fieldId] || (field.type === 'checkbox' ? [] : ''),
      }));

      const availableSlots = normalizeAvailabilitySlots(data.availability);
      if (availableSlots.length === 0) {
        setError('参加可能日時は一つ以上選択してください');
        return;
      }

      const isUpdating = Boolean(editingResponseId && savedResponseDraft?.responseId === editingResponseId && savedResponseDraft?.editToken);
      const res = await fetch(
        isUpdating
          ? `/api/forms/${resolvedParams.id}/responses/${editingResponseId}`
          : `/api/forms/${resolvedParams.id}/responses`,
        {
        method: isUpdating ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers,
          participantData: {
            name: data.participantName,
            section: data.participantSection,
            grade: data.participantGrade,
            availableSlots,
          },
          editToken: isUpdating ? savedResponseDraft?.editToken : undefined,
          submitterInfo: {
            submittedAt: new Date().toISOString(),
          },
        }),
      });

      const result = await res.json();

      if (res.ok) {
        const responseId = typeof result.responseId === 'string'
          ? result.responseId
          : editingResponseId || '';
        const editToken = typeof result.editToken === 'string'
          ? result.editToken
          : savedResponseDraft?.editToken || '';
        if (responseId && editToken) {
          persistSavedResponseDraft({
            responseId,
            editToken,
            values: data,
          });
        }
        setSubmissionMode(isUpdating ? 'update' : 'submit');
        setSubmitted(true);
        setShowEditModal(false);
        setEditingResponseId(null);
      } else {
        setError(result.error || '回答の送信に失敗しました');
        if (result.details) {
          setError(result.details.join('\n'));
        }
      }
    } catch (err) {
      setError('回答の送信に失敗しました');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const renderField = (field: { fieldId: string; type: string; label: string; placeholder?: string; required: boolean; options?: string[]; validation?: { minLength?: number; maxLength?: number; min?: number; max?: number; pattern?: string } }) => {
    const fieldId = field.fieldId;
    const isRequired = field.required;
    const label = field.label + (isRequired ? ' *' : '');
    const isAvailabilityField = fieldId === 'availability';
    const optionLabel = (option: string) => (isAvailabilityField ? formatAvailabilitySlotLabel(option) : option);

    switch (field.type) {
      case 'text':
        return (
          <div key={fieldId}>
            <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
              {label}
            </label>
            <input
              id={fieldId}
              type="text"
              placeholder={field.placeholder}
              {...register(fieldId, {
                required: isRequired ? `${field.label}は必須です` : false,
                minLength: field.validation?.minLength ? {
                  value: field.validation.minLength,
                  message: `${field.label}は${field.validation.minLength}文字以上で入力してください`,
                } : undefined,
                maxLength: field.validation?.maxLength ? {
                  value: field.validation.maxLength,
                  message: `${field.label}は${field.validation.maxLength}文字以下で入力してください`,
                } : undefined,
                pattern: field.validation?.pattern ? {
                  value: new RegExp(field.validation.pattern),
                  message: `${field.label}の形式が正しくありません`,
                } : undefined,
              })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            {errors[fieldId] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldId]?.message}</p>
            )}
          </div>
        );

      case 'textarea':
        return (
          <div key={fieldId}>
            <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
              {label}
            </label>
            <textarea
              id={fieldId}
              rows={4}
              placeholder={field.placeholder}
              {...register(fieldId, {
                required: isRequired ? `${field.label}は必須です` : false,
                minLength: field.validation?.minLength ? {
                  value: field.validation.minLength,
                  message: `${field.label}は${field.validation.minLength}文字以上で入力してください`,
                } : undefined,
                maxLength: field.validation?.maxLength ? {
                  value: field.validation.maxLength,
                  message: `${field.label}は${field.validation.maxLength}文字以下で入力してください`,
                } : undefined,
              })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            {errors[fieldId] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldId]?.message}</p>
            )}
          </div>
        );

      case 'number':
        return (
          <div key={fieldId}>
            <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
              {label}
            </label>
            <input
              id={fieldId}
              type="number"
              placeholder={field.placeholder}
              {...register(fieldId, {
                required: isRequired ? `${field.label}は必須です` : false,
                min: field.validation?.min ? {
                  value: field.validation.min,
                  message: `${field.label}は${field.validation.min}以上で入力してください`,
                } : undefined,
                max: field.validation?.max ? {
                  value: field.validation.max,
                  message: `${field.label}は${field.validation.max}以下で入力してください`,
                } : undefined,
              })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            />
            {errors[fieldId] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldId]?.message}</p>
            )}
          </div>
        );

      case 'select':
        return (
          <div key={fieldId}>
            <label htmlFor={fieldId} className="block text-sm font-medium text-gray-700">
              {label}
            </label>
            <select
              id={fieldId}
              {...register(fieldId, {
                required: isRequired ? `${field.label}は必須です` : false,
              })}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="">選択してください</option>
              {field.options?.map((option: string, index: number) => (
                <option key={index} value={option}>{optionLabel(option)}</option>
              ))}
            </select>
            {errors[fieldId] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldId]?.message}</p>
            )}
          </div>
        );

      case 'radio':
        return (
          <div key={fieldId}>
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">{label}</legend>
              <div className="space-y-2">
                {field.options?.map((option: string, index: number) => (
                  <label key={index} className="flex items-center">
                    <input
                      type="radio"
                      value={option}
                      {...register(fieldId, {
                        required: isRequired ? `${field.label}は必須です` : false,
                      })}
                      className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{optionLabel(option)}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {errors[fieldId] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldId]?.message}</p>
            )}
          </div>
        );

      case 'checkbox':
        return (
          <div key={fieldId}>
            {(() => {
              const selectedValues = (watch(fieldId) as string[]) || [];
              const allDateSlotKeys = getAvailabilityDateSlotKeys(
                (field.options || []).map((option) => ({
                  key: option,
                  label: option,
                }))
              );
              const checkboxRegistration = register(fieldId, {
                validate: (value) => {
                  if (!isRequired) return true;
                  if (Array.isArray(value)) return value.length > 0 || '一つ以上選択してください';
                  return value ? true : '一つ以上選択してください';
                },
              });
              const specialOptions = (field.options || []).filter(
                (option) => option === UNAVAILABLE_SLOT_KEY || option === ALL_AVAILABLE_SLOT_KEY
              );
              const dateOptions = (field.options || []).filter(
                (option) => option !== UNAVAILABLE_SLOT_KEY && option !== ALL_AVAILABLE_SLOT_KEY
              );

              const renderOptionCard = (option: string, index: number, tone: 'date' | 'special' = 'date') => {
                const selected = selectedValues.includes(option);
                const isSpecial = tone === 'special';
                return (
                  <label
                    key={`${option}-${index}`}
                    className={`group flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all duration-150 ${
                      selected
                        ? 'border-indigo-500 bg-indigo-50 shadow-sm ring-2 ring-indigo-200'
                        : 'border-gray-200 bg-white hover:border-indigo-300 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      value={option}
                      checked={selected}
                      {...checkboxRegistration}
                      onChange={() => {
                        const currentValues = (getValues(fieldId) as string[]) || [];
                        const nextValues = toggleAvailabilitySelection(currentValues, option, allDateSlotKeys);
                        setValue(fieldId as never, nextValues as never, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: true,
                        });
                      }}
                      className="sr-only"
                    />
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        selected
                          ? 'border-indigo-600 bg-indigo-600 text-white'
                          : 'border-gray-300 bg-white text-transparent group-hover:border-indigo-400'
                      }`}
                      aria-hidden="true"
                    >
                      <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M16.704 5.29a1 1 0 0 1 0 1.414l-7.25 7.25a1 1 0 0 1-1.414 0l-3.25-3.25a1 1 0 1 1 1.414-1.414l2.543 2.543 6.543-6.543a1 1 0 0 1 1.414 0Z" />
                      </svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium text-gray-900">
                        {optionLabel(option)}
                      </span>
                      {isSpecial ? (
                        <span className="mt-1 block text-xs text-gray-500">
                          {option === ALL_AVAILABLE_SLOT_KEY
                            ? '配布期間内の全日時に対応可能です'
                            : 'この日時には参加できません'}
                        </span>
                      ) : (
                        <span className="mt-1 block text-xs text-gray-500">
                          複数選択できます
                        </span>
                      )}
                    </span>
                  </label>
                );
              };

              return (
                <fieldset>
                  <legend className="block text-sm font-medium text-gray-700 mb-2">{label}</legend>
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <p className="text-sm text-gray-600">参加可能な日時を選択してください。</p>
                      <p className="text-xs text-gray-500">複数選択可</p>
                    </div>

                    {specialOptions.length > 0 && (
                      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                        {specialOptions.map((option, index) => renderOptionCard(option, index, 'special'))}
                      </div>
                    )}

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {dateOptions.map((option, index) => renderOptionCard(option, index))}
                    </div>
                  </div>
                </fieldset>
              );
            })()}
            {errors[fieldId] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldId]?.message}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  const renderResponseForm = (submitLabel: string) => (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label htmlFor="participantName" className="block text-sm font-medium text-gray-700">
            お名前 *
          </label>
          <input
            id="participantName"
            type="text"
            {...register('participantName', {
              required: 'お名前は必須です',
            })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          />
          {errors.participantName && (
            <p className="mt-1 text-sm text-red-600">{errors.participantName.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="participantGrade" className="block text-sm font-medium text-gray-700">
            学年 *
          </label>
          <select
            id="participantGrade"
            {...register('participantGrade', {
              required: '学年は必須です',
            })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">選択してください</option>
            <option value="1">1年生</option>
            <option value="2">2年生</option>
            <option value="3">3年生</option>
            <option value="4">4年生</option>
          </select>
          {errors.participantGrade && (
            <p className="mt-1 text-sm text-red-600">{errors.participantGrade.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="participantSection" className="block text-sm font-medium text-gray-700">
            所属セクション *
          </label>
          <select
            id="participantSection"
            disabled={participantGrade === '4'}
            {...register('participantSection', {
              required: '所属セクションは必須です',
            })}
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
          >
            <option value="">選択してください</option>
            {(participantGrade === '4'
              ? ['4年']
              : ['企画系', '技術系', '警備系', 'Web系', 'PR系']
            ).map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
          {errors.participantSection && (
            <p className="mt-1 text-sm text-red-600">{errors.participantSection.message}</p>
          )}
        </div>
      </div>

      {form?.fields
        .sort((a, b) => a.order - b.order)
        .map(field => renderField(field))}

      <div className="pt-6">
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
        >
          {submitting ? '送信中...' : submitLabel}
        </button>
      </div>
    </form>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingInline size="lg" />
        </div>
      </div>
    );
  }

  if (error && !form) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-50 border border-red-200 rounded-md p-6 max-w-md">
            <h2 className="text-lg font-medium text-red-900 mb-2">エラー</h2>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-green-50 border border-green-200 rounded-md p-6 max-w-md">
            <div className="flex items-center justify-center mb-4">
              <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
            </div>
            <h2 className="text-lg font-medium text-green-900 mb-2">
              {submissionMode === 'update' ? '回答を更新しました' : '回答を送信しました'}
            </h2>
            <p className="text-sm text-green-700">
              ご協力ありがとうございました。<br />
              {savedResponseDraft ? 'この端末では引き続き回答の変更ができます。' : '工大祭の準備に活用させていただきます。'}
            </p>
            {savedResponseDraft && (
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  type="button"
                  onClick={openEditModal}
                  className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
                >
                  回答を変更する
                </button>
                <button
                  type="button"
                  onClick={clearSavedResponseDraft}
                  className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  この端末の保存を削除
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white shadow rounded-lg">
          <div className="px-6 py-8">
            {/* ヘッダー */}
            <div className="mb-8">
              <h1 className="text-2xl font-bold text-gray-900">{form?.title}</h1>
              {form?.description && (
                <p className="mt-2 text-sm text-gray-600">{form.description}</p>
              )}
            </div>

            {/* エラー表示 */}
            {error && (
              <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
                <pre className="text-sm text-red-600 whitespace-pre-wrap">{error}</pre>
              </div>
            )}

            {/* フォーム */}
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* 参加者必須情報 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 名前 */}
                <div>
                  <label htmlFor="participantName" className="block text-sm font-medium text-gray-700">
                    お名前 *
                  </label>
                  <input
                    id="participantName"
                    type="text"
                    {...register('participantName', {
                      required: 'お名前は必須です',
                    })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {errors.participantName && (
                    <p className="mt-1 text-sm text-red-600">{errors.participantName.message}</p>
                  )}
                </div>

                {/* 学年 */}
                <div>
                  <label htmlFor="participantGrade" className="block text-sm font-medium text-gray-700">
                    学年 *
                  </label>
                  <select
                    id="participantGrade"
                    {...register('participantGrade', {
                      required: '学年は必須です',
                    })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">選択してください</option>
                    <option value="1">1年生</option>
                    <option value="2">2年生</option>
                    <option value="3">3年生</option>
                    <option value="4">4年生</option>
                  </select>
                  {errors.participantGrade && (
                    <p className="mt-1 text-sm text-red-600">{errors.participantGrade.message}</p>
                  )}
                </div>

                {/* 所属セクション */}
                <div>
                  <label htmlFor="participantSection" className="block text-sm font-medium text-gray-700">
                    所属セクション *
                  </label>
                  <select
                    id="participantSection"
                    disabled={participantGrade === '4'}
                    {...register('participantSection', {
                      required: '所属セクションは必須です',
                    })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">選択してください</option>
                    {(participantGrade === '4'
                      ? ['4年']
                      : ['企画系', '技術系', '警備系', 'Web系', 'PR系']
                    ).map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  {errors.participantSection && (
                    <p className="mt-1 text-sm text-red-600">{errors.participantSection.message}</p>
                  )}
                </div>

              </div>

              {/* 既存のフォームフィールド */}
              {form?.fields
                .sort((a, b) => a.order - b.order)
                .map(field => renderField(field))}

              {/* 送信ボタン */}
              <div className="pt-6">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  {submitting ? '送信中...' : '回答を送信'}
                </button>
              </div>
            </form>

            {/* フッター */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-500 text-center">
                工大祭実行委員会 - ポスター配布管理システム
              </p>
            </div>
          </div>
        </div>
      </div>

      {showEditModal && form && (
        <Modal
          open
          onClose={() => {
            setShowEditModal(false);
            setSubmitted(true);
            if (savedResponseDraft) {
              reset(savedResponseDraft.values);
            }
          }}
          centered={false}
          panelClassName="max-w-4xl"
          contentClassName="px-6 py-6"
        >
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">回答を変更</h2>
              <p className="text-sm text-gray-500">送信済みの内容を修正して保存できます。</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowEditModal(false);
                setSubmitted(true);
                if (savedResponseDraft) {
                  reset(savedResponseDraft.values);
                }
              }}
              className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-6 py-6">
            <div className="mb-6 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              {savedResponseDraft ? '保存済みの回答を読み込んでいます。必要な箇所だけ変更してください。' : '回答内容を入力してください。'}
            </div>
            {renderResponseForm('変更を保存')}
          </div>
        </Modal>
      )}
    </div>
  );
}
