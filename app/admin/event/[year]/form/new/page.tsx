'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { FormCreateData } from '@/types/forms';

export default function FormCreatePage({ params }: { params: Promise<{ year: string }> }) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ year: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [availabilityOptions, setAvailabilityOptions] = useState(['両時間参加可能', '午前のみ参加可能', '午後のみ参加可能', '参加不可']);
  const [availabilityText, setAvailabilityText] = useState('両時間参加可能\n午前のみ参加可能\n午後のみ参加可能\n参加不可');
  // プレビュー用の状態
  const [previewGrade, setPreviewGrade] = useState('');
  const [previewAvailability, setPreviewAvailability] = useState('');
  const [previewRemarks, setPreviewRemarks] = useState('');
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!resolvedParams) return;

    try {
      setSubmitting(true);
      setError('');

      if (!title.trim()) {
        setError('フォームタイトルを入力してください');
        return;
      }

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
          type: 'select' as const,
          label: '参加可能時間帯',
          placeholder: '参加可能な日程を選択してください',
          required: true,
          options: availabilityOptions,
          order: 0,
        },
        {
          type: 'textarea' as const,
          label: '備考',
          placeholder: 'その他連絡事項があればご記入ください',
          required: false,
          order: 1,
        }
      ];

      const formData: FormCreateData = {
        title: title.trim(),
        description: description.trim(),
        fields: fixedFields,
      };

      const res = await fetch('/api/forms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          eventId: `kohdai${resolvedParams.year}`,
          year: parseInt(resolvedParams.year),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        router.push(`/admin/event/${resolvedParams.year}/form`);
      } else {
        setError(data.error || 'フォームの作成に失敗しました');
      }
    } catch (err) {
      setError('フォームの作成に失敗しました');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };


  if (authLoading || !resolvedParams) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            新しいフォームを作成 ({resolvedParams.year}年度)
          </h1>
          <p className="mt-1 text-sm text-gray-600">
            参加者情報（名前・学年・セクション）と参加可能時間帯・時間帯を収集するアンケートフォームを作成します
          </p>
        </div>

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

              {/* 参加可能時間帯の選択肢設定 */}
              <div className="border border-gray-200 rounded-lg p-4 mb-4">
                <h3 className="text-sm font-medium text-gray-900 mb-3">参加可能時間帯の選択肢</h3>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  選択肢を設定してください（1行につき1つ）
                </label>
                <div className="relative">
                  <textarea
                    value={availabilityText}
                    onChange={(e) => {
                      const newText = e.target.value;
                      setAvailabilityText(newText);
                      // 空白でない行のみを選択肢として保存
                      const lines = newText.split('\n').filter(line => line.trim() !== '');
                      setAvailabilityOptions(lines);
                    }}
                    rows={6}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  />
                  {!availabilityText.trim() && (
                    <div className="absolute top-2 left-3 text-gray-400 pointer-events-none whitespace-pre-line">
                      両時間参加可能{"\n"}午前のみ参加可能{"\n"}午後のみ参加可能{"\n"}参加不可
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  各行が1つの選択肢になります。最低1つの選択肢が必要です。
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">フォームプレビュー</h2>

            {/* フォームヘッダープレビュー */}
            <div className="border border-gray-200 rounded-lg p-4 mb-4 bg-gray-50">
              <h1 className="text-xl font-bold text-gray-900">{title || 'フォームタイトルを入力してください'}</h1>
              {description && (
                <p className="mt-2 text-sm text-gray-600">{description}</p>
              )}
            </div>

            {/* 参加者情報プレビュー（固定） */}
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
              {/* 所属セクション */}
              <div>
                <label htmlFor="participantSection" className="block text-sm font-medium text-gray-700">
                  所属セクション *
                </label>
                <input
                  type="text"
                  className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                />
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
                  {availabilityOptions.length > 0 ? (
                    availabilityOptions.map((option, index) => (
                      <option key={index} value={option}>{option}</option>
                    ))
                  ) : (
                    <option disabled className="text-red-500">選択肢が設定されていません</option>
                  )}
                </select>
                {availabilityOptions.length === 0 && (
                  <p className="mt-1 text-xs text-red-500">少なくとも1つの選択肢を設定してください</p>
                )}
                {previewAvailability && (
                  <p className="mt-1 text-xs text-green-600">選択された値: {previewAvailability}</p>
                )}
              </div>

              {/* 備考フィールドのプレビュー */}
              <div className="border border-gray-200 rounded-lg p-4">
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
                    setPreviewGrade('');
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

          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => router.push(`/admin/event/${resolvedParams.year}/form`)}
              className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {submitting ? '作成中...' : 'フォームを作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}