/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { SurveyForm } from '@/types/forms';

interface FormWithStats extends SurveyForm {
  responseCount: number;
  lastResponseAt?: Date;
}

export default function FormListPage({ params }: { params: Promise<{ year: string }> }) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ year: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [forms, setForms] = useState<FormWithStats[]>([]);
  const [loading, setLoading] = useState(true);
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
    loadForms();
  }, [resolvedParams, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadForms = async () => {
    if (!resolvedParams || !user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();
      const eventId = `kohdai${resolvedParams.year}`;

      const res = await fetch(`/api/forms?eventId=${eventId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await res.json();

      if (res.ok) {
        setForms(data.forms || []);
      } else {
        setError(data.error || 'フォーム一覧の取得に失敗しました');
      }
    } catch (err) {
      setError('フォーム一覧の取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const toggleFormStatus = async (formId: string, isActive: boolean) => {
    try {
      if (!user) return;

      const token = await user.getIdToken();

      const res = await fetch(`/api/forms/${formId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ isActive: !isActive }),
      });

      if (res.ok) {
        await loadForms();
      } else {
        const data = await res.json();
        setError(data.error || 'ステータスの更新に失敗しました');
      }
    } catch (err) {
      setError('ステータスの更新に失敗しました');
      console.error(err);
    }
  };

  const deleteForm = async (formId: string) => {
    if (!confirm('このフォームを削除しますか？回答データも全て削除されます。')) {
      return;
    }

    try {
      if (!user) return;

      const token = await user.getIdToken();

      const res = await fetch(`/api/forms/${formId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (res.ok) {
        await loadForms();
      } else {
        const data = await res.json();
        setError(data.error || 'フォームの削除に失敗しました');
      }
    } catch (err) {
      setError('フォームの削除に失敗しました');
      console.error(err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect to login via useEffect
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 ">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between sm:flex-row flex-col space-y-2">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                フォーム管理 ({resolvedParams?.year}年度)
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                アンケートフォームの作成・編集・管理を行います
              </p>
            </div>
            <Link
              href={`/admin/event/${resolvedParams?.year}`}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
            >
              イベント管理に戻る
            </Link>
            <Link
              href={`/admin/event/${resolvedParams?.year}/form/new`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              新しいフォームを作成
            </Link>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* フォーム一覧 */}
        {forms.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">フォームがありません</h3>
            <p className="text-gray-600 mb-6">新しいアンケートフォームを作成してください。</p>
            <Link
              href={`/admin/event/${resolvedParams?.year}/form/new`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              フォームを作成
            </Link>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <ul className="divide-y divide-gray-200">
              {forms.map((form) => (
                <li key={form.formId}>
                  <div className="px-6 py-4">
                    <div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center">
                          <h3 className="text-lg font-medium text-gray-900 truncate">
                            {form.title}
                          </h3>
                          <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${form.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                            }`}>
                            {form.isActive ? '公開中' : '非公開'}
                          </span>
                        </div>
                        {form.description && (
                          <p className="mt-1 text-sm text-gray-600 truncate">
                            {form.description}
                          </p>
                        )}
                        <div className="mt-2 flex items-center text-sm text-gray-500 space-x-4">
                          <span>回答数: {form.responseCount}</span>
                          {form.lastResponseAt && (
                            <span>最終回答: {formatDate(form.lastResponseAt)}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-end justify-end">
                        <div className="flex items-center space-x-2 sm:flex-row flex-col space-y-2 w-full sm:w-auto">
                          {/* フォームリンク */}
                          <a
                            href={`/form/${form.formId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                            プレビュー
                          </a>

                          {/* 回答一覧ボタン */}
                          <Link
                            href={`/admin/event/${resolvedParams?.year}/form/${form.formId}/responses`}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            回答一覧 ({form.responseCount})
                          </Link>

                          {/* 編集ボタン */}
                          <Link
                            href={`/admin/event/${resolvedParams?.year}/form/${form.formId}`}
                            className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                          >
                            編集
                          </Link>

                          {/* 公開/非公開トグル */}
                          <button
                            onClick={() => toggleFormStatus(form.formId, form.isActive)}
                            className={`inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 ${form.isActive
                              ? 'text-yellow-700 bg-yellow-100 hover:bg-yellow-200 focus:ring-yellow-500'
                              : 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
                              }`}
                          >
                            {form.isActive ? '非公開にする' : '公開する'}
                          </button>

                          {/* 削除ボタン */}
                          <button
                            onClick={() => deleteForm(form.formId)}
                            className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            削除
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );

  function formatDate(dateValue: any) {
    if (!dateValue) return '-';

    try {
      let date: Date;

      // Firestore Timestamp の場合
      if (dateValue?.toDate && typeof dateValue.toDate === 'function') {
        date = dateValue.toDate();
      }
      // 文字列の場合
      else if (typeof dateValue === 'string') {
        date = new Date(dateValue);
      }
      // 既に Date オブジェクトの場合
      else if (dateValue instanceof Date) {
        date = dateValue;
      }
      // 数値（Unix timestamp）の場合
      else if (typeof dateValue === 'number') {
        date = new Date(dateValue);
      }
      else {
        return 'Invalid Date';
      }

      // 有効な日付かチェック
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }

      return date.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  }
}
