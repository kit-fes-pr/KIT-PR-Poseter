'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { SurveyForm, FormAnswer } from '@/types/forms';

interface FormData {
  [fieldId: string]: string | string[];
  // 参加者必須情報
  participantName: string;
  participantGrade: string;
  participantSection: string;
}

export default function FormResponsePage({ params }: { params: Promise<{ id: string }> }) {
  const [resolvedParams, setResolvedParams] = useState<{ id: string } | null>(null);
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>();

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

  const onSubmit = async (data: FormData) => {
    if (!form || !resolvedParams) return;

    try {
      setSubmitting(true);
      setError('');

      // フォームデータを変換
      const answers: FormAnswer[] = form.fields.map(field => ({
        fieldId: field.fieldId,
        value: data[field.fieldId] || (field.type === 'checkbox' ? [] : ''),
      }));

      // 参加可能時間帯フィールドの値を取得
      const availabilityValue = data.availability;
      
      // 選択された値を APIが期待する形式に変換
      let availableTime: 'morning' | 'afternoon' | 'both' = 'both';
      if (availabilityValue) {
        if (availabilityValue.includes('午前のみ')) {
          availableTime = 'morning';
        } else if (availabilityValue.includes('午後のみ')) {
          availableTime = 'afternoon';
        } else {
          availableTime = 'both';
        }
      }

      const res = await fetch(`/api/forms/${resolvedParams.id}/responses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          answers,
          participantData: {
            name: data.participantName,
            section: data.participantSection,
            grade: data.participantGrade,
            availableTime: availableTime,
          },
          submitterInfo: {
            submittedAt: new Date().toISOString(),
          },
        }),
      });

      const result = await res.json();

      if (res.ok) {
        setSubmitted(true);
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
                <option key={index} value={option}>{option}</option>
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
                    <span className="ml-2 text-sm text-gray-700">{option}</span>
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
            <fieldset>
              <legend className="block text-sm font-medium text-gray-700 mb-2">{label}</legend>
              <div className="space-y-2">
                {field.options?.map((option: string, index: number) => (
                  <label key={index} className="flex items-center">
                    <input
                      type="checkbox"
                      value={option}
                      {...register(fieldId, {
                        required: isRequired ? `${field.label}は必須です` : false,
                      })}
                      className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">{option}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {errors[fieldId] && (
              <p className="mt-1 text-sm text-red-600">{errors[fieldId]?.message}</p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
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
            <h2 className="text-lg font-medium text-green-900 mb-2">回答を送信しました</h2>
            <p className="text-sm text-green-700">
              ご協力ありがとうございました。<br />
              工大祭の準備に活用させていただきます。
            </p>
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
                  <input
                    id="participantSection"
                    type="text"
                    {...register('participantSection', {
                      required: '所属セクションは必須です',
                    })}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
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
    </div>
  );
}