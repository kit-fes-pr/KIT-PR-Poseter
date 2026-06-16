'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { SurveyForm, FormField, FormUpdateData } from '@/types/forms';
import { LoadingInline } from '@/components/ui/Loading';
import AvailabilityChoiceEditor from '@/components/admin/AvailabilityChoiceEditor';
import YearPageSectionHeader from '@/components/admin/YearPageSectionHeader';
import {
  AvailabilityChoice,
  buildAvailabilityChoicesFromLabels,
  createDefaultAvailabilityChoices,
  serializeAvailabilityChoiceLabels,
} from '@/lib/utils/availability';

export default function FormEditPage({
  params
}: {
  params: Promise<{ year: string; formId: string }>
}) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ year: string; formId: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(false);
  const [availabilityChoices, setAvailabilityChoices] = useState<AvailabilityChoice[]>(
    createDefaultAvailabilityChoices()
  );
  // プレビュー用の状態
  const [previewGrade, setPreviewGrade] = useState('');
  const [previewAvailability, setPreviewAvailability] = useState('');
  const [previewRemarks, setPreviewRemarks] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
      if (!user) {
        router.push('/admin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!resolvedParams || !user || authLoading) return;
    loadForm();
  }, [resolvedParams, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadForm = async () => {
    if (!resolvedParams || !user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      const res = await fetch(`/api/forms/${resolvedParams.formId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setForm(data);
        setTitle(data.title);
        setDescription(data.description || '');
        setIsActive(data.isActive);

        // 既存の参加可能時間帯選択肢を設定
        const availabilityField = data.fields.find((field: FormField) =>
          field.label === '参加可能時間帯' || field.fieldId === 'availability'
        );
        if (availabilityField && availabilityField.options) {
          setAvailabilityChoices(buildAvailabilityChoicesFromLabels(availabilityField.options));
        }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resolvedParams || !form) return;

    try {
      setSubmitting(true);
      setError('');

      if (!title.trim()) {
        setError('フォームタイトルを入力してください');
        return;
      }

      const availabilityOptions = serializeAvailabilityChoiceLabels(availabilityChoices);
      if (availabilityOptions.length === 0) {
        setError('参加可能時間帯の選択肢を最低1つ設定してください');
        return;
      }

      if (!user) {
        router.push('/admin');
        return;
      }

      const token = await user.getIdToken();

      // 固定フィールド定義
      const fixedFields = [
        {
          fieldId: 'availability',
          type: 'select' as const,
          label: '参加可能時間帯',
          placeholder: '参加可能な日程を選択してください',
          required: true,
          options: availabilityOptions,
          order: 0,
        },
        {
          fieldId: 'remarks',
          type: 'textarea' as const,
          label: '備考',
          placeholder: 'その他連絡事項があればご記入ください',
          required: false,
          order: 1,
        }
      ];

      const updateData: FormUpdateData = {
        title: title.trim(),
        description: description.trim(),
        isActive,
        fields: fixedFields,
      };

      const res = await fetch(`/api/forms/${resolvedParams.formId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/admin/event/${resolvedParams.year}/form`);
      } else {
        setError(data.error || 'フォームの更新に失敗しました');
      }
    } catch (err) {
      setError('フォームの更新に失敗しました');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };


  if (authLoading || loading) {
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

  if (!user) {
    return null;
  }

  if (!resolvedParams || !form) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <YearPageSectionHeader
          title={`フォームを編集 (${resolvedParams.year}年度)`}
          description={`${form.title} の設定を変更できます（参加者情報フィールドは自動的に追加されます）`}
        />

        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">基本情報</h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                  フォームタイトル *
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="例: 工大祭準備に関するアンケート"
                />
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                  説明文
                </label>
                <textarea
                  id="description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  placeholder="フォームの目的や注意事項を記載してください"
                />
              </div>

              <div>
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={isActive}
                    onChange={(e) => setIsActive(e.target.checked)}
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">フォームを公開する</span>
                </label>
                <p className="mt-1 text-xs text-gray-500">
                  公開状態のフォームのみ回答を受け付けます
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">フォーム設定</h2>
            <div className="space-y-6">
              {/* 参加可能時間帯の選択肢設定 */}
              <AvailabilityChoiceEditor
                choices={availabilityChoices}
                onChange={setAvailabilityChoices}
              />

              {/* プレビュー */}
              <div>
                <h3 className="text-sm font-medium text-gray-900 mb-3">プレビュー</h3>
                {/* フォームヘッダープレビュー */}
                <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
                  <h1 className="text-xl font-bold text-gray-900">{title || 'フォームタイトルを入力してください'}</h1>
                  {description && (
                    <p className="mt-2 text-sm text-gray-600">{description}</p>
                  )}
                  {!isActive && (
                    <div className="mt-2 inline-block px-2 py-1 bg-red-100 text-red-700 text-xs rounded">
                      非アクティブ（ユーザーには表示されません）
                    </div>
                  )}
                </div>

                {/* 参加者情報プレビュー */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="participantName" className="block text-sm font-medium text-gray-700">
                      お名前 *
                    </label>
                    <input
                      type="text"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">学年 *</label>
                    <select
                      value={previewGrade}
                      onChange={(e) => setPreviewGrade(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">選択してください</option>
                      <option value="1">1年生</option>
                      <option value="2">2年生</option>
                      <option value="3">3年生</option>
                      <option value="4">4年生</option>
                    </select>
                    {previewGrade && (
                      <p className="mt-1 text-xs text-green-600">選択された値: {previewGrade}年生</p>
                    )}
                  </div>
                  <div>
                    <label htmlFor="participantSection" className="block text-sm font-medium text-gray-700">
                      所属セクション *
                    </label>
                    <select
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">選択してください</option>
                      <option value="企画系">企画系</option>
                      <option value="技術系">技術系</option>
                      <option value="警備系">警備系</option>
                      <option value="Web系">Web系</option>
                      <option value="PR系">PR系</option>
                      <option value="4年">4年</option>
                    </select>
                  </div>

                  {/* 参加可能時間帯フィールドのプレビュー */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">参加可能時間帯 *</label>
                    <select
                      value={previewAvailability}
                      onChange={(e) => setPreviewAvailability(e.target.value)}
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">参加可能な時間帯を選択してください</option>
                      {serializeAvailabilityChoiceLabels(availabilityChoices).length > 0 ? (
                        serializeAvailabilityChoiceLabels(availabilityChoices).map((option, index) => (
                          <option key={index} value={option}>{option}</option>
                        ))
                      ) : (
                        <option disabled className="text-red-500">選択肢が設定されていません</option>
                      )}
                    </select>
                    {serializeAvailabilityChoiceLabels(availabilityChoices).length === 0 && (
                      <p className="mt-1 text-xs text-red-500">少なくとも1つの選択肢を設定してください</p>
                    )}
                    {previewAvailability && (
                      <p className="mt-1 text-xs text-green-600">選択された値: {previewAvailability}</p>
                    )}
                  </div>

                  {/* 備考フィールドのプレビュー */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700">備考</label>
                    <textarea
                      value={previewRemarks}
                      onChange={(e) => setPreviewRemarks(e.target.value)}
                      rows={3}
                      placeholder="その他連絡事項があればご記入ください"
                      className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    />
                    {previewRemarks && (
                      <p className="mt-1 text-xs text-green-600">入力文字数: {previewRemarks.length}文字</p>
                    )}
                  </div>
                </div>

                {/* プレビューコントロール */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-4 text-xs text-gray-600">
                    <span>プレビュー状態:</span>
                    {previewAvailability || previewRemarks ? (
                      <span className="text-green-600">入力あり</span>
                    ) : (
                      <span className="text-gray-400">未入力</span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewAvailability('');
                      setPreviewRemarks('');
                    }}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-600 rounded hover:bg-gray-200 transition-colors"
                  >
                    プレビューをリセット
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push(`/admin/event/${resolvedParams.year}/form`)}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              キャンセル
            </button>
            <div className="flex items-center space-x-3">
              <a
                href={`/form/${resolvedParams.formId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                プレビュー
              </a>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {submitting ? '更新中...' : 'フォームを更新'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
