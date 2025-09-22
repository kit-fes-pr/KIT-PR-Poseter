'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { SurveyForm, ParticipantSurveyResponse, FormResponse, FormField } from '@/types/forms';

interface StatOption {
  option: string;
  count: number;
  percentage: string;
}

export default function FormResponsesPage({ 
  params 
}: { 
  params: Promise<{ year: string; formId: string }> 
}) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ year: string; formId: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [form, setForm] = useState<SurveyForm | null>(null);
  const [responses, setResponses] = useState<(FormResponse | ParticipantSurveyResponse)[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStatistics, setShowStatistics] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [editingResponse, setEditingResponse] = useState<(FormResponse | ParticipantSurveyResponse) | null>(null);
  const [editFormData, setEditFormData] = useState<{ [key: string]: string | string[] | number }>({});

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
    loadFormAndResponses();
  }, [resolvedParams, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  // モバイルメニューを外側クリックで閉じる
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showMobileMenu) {
        const target = event.target as Element;
        if (!target.closest('.mobile-menu-container')) {
          setShowMobileMenu(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMobileMenu]);

  const loadFormAndResponses = async () => {
    if (!resolvedParams || !user) return;
    
    try {
      setLoading(true);
      const token = await user.getIdToken();
      
      // フォーム情報と回答を取得
      const [formRes, responsesRes] = await Promise.all([
        fetch(`/api/forms/${resolvedParams.formId}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        }),
        fetch(`/api/forms/${resolvedParams.formId}/responses`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        })
      ]);

      if (formRes.ok && responsesRes.ok) {
        const formData = await formRes.json();
        const responsesData = await responsesRes.json();
        
        setForm(formData);
        setResponses(responsesData.responses || []);
      } else {
        setError('データの取得に失敗しました');
      }
    } catch (err) {
      setError('データの取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportToCsv = () => {
    if (!form || responses.length === 0) return;

    // CSV ヘッダーを作成
    const headers = [
      '回答ID',
      '回答日時',
      '名前',
      '学年', 
      '所属セクション',
      '参加可能時間帯',
      ...form.fields.map(field => field.label)
    ];

    // CSV データを作成
    const csvData = responses.map(response => {
      const participantResponse = response as ParticipantSurveyResponse;
      const row = [
        response.responseId,
        formatDate(response.submittedAt),
        participantResponse.participantData?.name || '',
        participantResponse.participantData?.grade || '',
        participantResponse.participantData?.section || '',
        participantResponse.participantData?.availableTime || '',
      ];

      // フィールドの回答を追加
      form.fields.forEach(field => {
        const answer = response.answers.find(a => a.fieldId === field.fieldId);
        const value = answer?.value;
        
        if (Array.isArray(value)) {
          row.push(value.join(', '));
        } else {
          row.push(value || '');
        }
      });

      return row;
    });

    // CSV 文字列を作成
    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    // ダウンロード
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${form.title}_回答データ_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderAnswerValue = (value: string | string[]) => {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return value || '-';
  };

  const formatDate = (dateValue: any) => {
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
      
      return date.toLocaleString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  // フィールドごとの統計を生成する関数
  const generateFieldStatistics = (field: FormField) => {
    if (!responses.length) return null;

    const fieldAnswers = responses.map(response => {
      const answer = response.answers.find(a => a.fieldId === field.fieldId);
      return answer?.value;
    }).filter(value => value !== undefined && value !== null && value !== '');

    if (fieldAnswers.length === 0) return null;

    // select, radio フィールドの場合、選択肢ごとの統計を表示
    if ((field.type === 'select' || field.type === 'radio') && field.options) {
      const stats = field.options.map((option: string) => {
        const count = fieldAnswers.filter(answer => answer === option).length;
        const percentage = fieldAnswers.length > 0 ? ((count / fieldAnswers.length) * 100).toFixed(1) : '0.0';
        return { option, count, percentage };
      });

      return {
        type: 'options',
        title: field.label,
        stats,
        totalAnswers: fieldAnswers.length
      };
    }

    // checkbox フィールドの場合
    if (field.type === 'checkbox' && field.options) {
      const allSelectedOptions: string[] = [];
      fieldAnswers.forEach(answer => {
        if (Array.isArray(answer)) {
          allSelectedOptions.push(...answer);
        }
      });

      const stats = field.options.map((option: string) => {
        const count = allSelectedOptions.filter(selected => selected === option).length;
        const percentage = fieldAnswers.length > 0 ? ((count / fieldAnswers.length) * 100).toFixed(1) : '0.0';
        return { option, count, percentage };
      });

      return {
        type: 'checkbox',
        title: field.label,
        stats,
        totalAnswers: fieldAnswers.length
      };
    }

    // text, textarea, number フィールドの場合は回答数のみ表示
    return {
      type: 'simple',
      title: field.label,
      totalAnswers: fieldAnswers.length
    };
  };

  const openEditModal = (response: FormResponse | ParticipantSurveyResponse) => {
    setEditingResponse(response);
    
    // 現在の回答データを編集フォームにセット
    const participantResponse = response as ParticipantSurveyResponse;
    const formData: { [key: string]: string | string[] | number } = {
      participantName: participantResponse.participantData?.name || '',
      participantGrade: participantResponse.participantData?.grade?.toString() || '',
      participantSection: participantResponse.participantData?.section || '',
    };

    // フォームフィールドの回答をセット
    response.answers.forEach(answer => {
      formData[answer.fieldId] = answer.value;
    });

    setEditFormData(formData);
  };

  const closeEditModal = () => {
    setEditingResponse(null);
    setEditFormData({});
  };

  const updateResponse = async () => {
    if (!editingResponse || !resolvedParams || !user) return;

    try {
      const token = await user.getIdToken();

      // フォームフィールドの回答を構築
      const answers = form?.fields.map(field => ({
        fieldId: field.fieldId,
        value: editFormData[field.fieldId] || (field.type === 'checkbox' ? [] : ''),
      })) || [];

      // 参加可能時間帯フィールドの値を取得してAPI形式に変換
      const availabilityValue = editFormData.availability;
      let availableTime: 'morning' | 'afternoon' | 'both' = 'both';
      if (availabilityValue && typeof availabilityValue === 'string') {
        if (availabilityValue.includes('午前のみ')) {
          availableTime = 'morning';
        } else if (availabilityValue.includes('午後のみ')) {
          availableTime = 'afternoon';
        } else {
          availableTime = 'both';
        }
      }

      const updateData = {
        answers,
        participantData: {
          name: editFormData.participantName as string,
          section: editFormData.participantSection as string,
          grade: parseInt(editFormData.participantGrade as string),
          availableTime: availableTime,
        },
      };

      const res = await fetch(`/api/forms/${resolvedParams.formId}/responses/${editingResponse.responseId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        // 回答一覧を再読み込み
        await loadFormAndResponses();
        closeEditModal();
      } else {
        const errorData = await res.json();
        setError(errorData.error || '回答の更新に失敗しました');
      }
    } catch (err) {
      setError('回答の更新に失敗しました');
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

  if (!user || !resolvedParams) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex" aria-label="Breadcrumb">
                <ol className="flex items-center space-x-4">
                  <li>
                    <Link href={`/admin/event/${resolvedParams.year}/form`} className="text-sm font-medium text-gray-500 hover:text-gray-700">
                      フォーム管理
                    </Link>
                  </li>
                  <li>
                    <div className="flex items-center">
                      <svg className="flex-shrink-0 h-5 w-5 text-gray-400" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z" />
                      </svg>
                      <span className="ml-4 text-sm font-medium text-gray-500">回答一覧</span>
                    </div>
                  </li>
                </ol>
              </nav>
              <h1 className="mt-2 text-xl font-bold text-gray-900">
                {form?.title} - 回答一覧
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                回答数: {responses.length}件
              </p>
            </div>
            {/* デスクトップ用ボタン */}
            <div className="hidden md:flex items-center space-x-3">
              <button
                onClick={exportToCsv}
                disabled={responses.length === 0}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                CSVダウンロード
              </button>
              <a
                href={`/form/${resolvedParams.formId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                フォームを開く
              </a>
            </div>

            {/* モバイル用ハンバーガーメニュー */}
            <div className="md:hidden relative mobile-menu-container">
              <button
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                <svg
                  className={`h-6 w-6 transition-transform duration-200 ${showMobileMenu ? 'rotate-90' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* ドロップダウンメニュー */}
              {showMobileMenu && (
                <div className="absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
                  <div className="py-1" role="menu">
                    <button
                      onClick={() => {
                        exportToCsv();
                        setShowMobileMenu(false);
                      }}
                      disabled={responses.length === 0}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                      role="menuitem"
                    >
                      <svg className="mr-3 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      CSVダウンロード
                    </button>
                    <a
                      href={`/form/${resolvedParams?.formId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setShowMobileMenu(false)}
                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                      role="menuitem"
                    >
                      <svg className="mr-3 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      フォームを開く
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 回答一覧 */}
        {responses.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 mx-auto mb-4 text-gray-400">
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">回答がありません</h3>
            <p className="text-gray-600 mb-6">まだこのフォームに回答がありません。</p>
            <a
              href={`/form/${resolvedParams.formId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              フォームを開く
            </a>
          </div>
        ) : (
          <div className="bg-white shadow overflow-hidden sm:rounded-lg">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      回答日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      参加者情報
                    </th>
                    {form?.fields.map(field => (
                      <th key={field.fieldId} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {field.label}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {responses.map((response, index) => {
                    const participantResponse = response as ParticipantSurveyResponse;
                    return (
                      <tr key={response.responseId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatDate(response.submittedAt)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="font-medium">{participantResponse.participantData?.name || '-'}</div>
                            <div className="text-gray-500">
                              {participantResponse.participantData?.grade && `${participantResponse.participantData.grade}年 `}
                              {participantResponse.participantData?.section}
                            </div>
                          </div>
                        </td>
                        {form?.fields.map(field => {
                          const answer = response.answers.find(a => a.fieldId === field.fieldId);
                          return (
                            <td key={field.fieldId} className="px-6 py-4 text-sm text-gray-900">
                              <div className="max-w-xs truncate">
                                {renderAnswerValue(answer?.value || '')}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => openEditModal(response)}
                            className="text-indigo-600 hover:text-indigo-900 mr-3"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 統計情報 */}
        {responses.length > 0 && form && (
          <div className="mt-8 bg-white shadow rounded-lg">
            <div className="px-6 py-4 border-b border-gray-200">
              <button
                onClick={() => setShowStatistics(!showStatistics)}
                className="flex items-center justify-between w-full text-left"
              >
                <h3 className="text-lg font-medium text-gray-900">統計情報</h3>
                <svg
                  className={`h-5 w-5 text-gray-500 transition-transform duration-200 ${
                    showStatistics ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {showStatistics && (
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* 学年の統計（参加者データより） */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">学年</h4>
                      <div className="space-y-1">
                        {[1, 2, 3, 4].map(grade => {
                          const count = responses.filter(r => {
                            const pr = r as ParticipantSurveyResponse;
                            return pr.participantData?.grade === grade;
                          }).length;
                          const percentage = ((count / responses.length) * 100).toFixed(1);
                          
                          return (
                            <div key={grade} className="flex justify-between text-sm">
                              <span>{grade}年生</span>
                              <span>{count}件 ({percentage}%)</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  {/* フォームフィールドごとの統計 */}
                  {form.fields
                    .filter(field => field.type === 'select' || field.type === 'radio' || field.type === 'checkbox')
                    .map(field => {
                      const fieldStats = generateFieldStatistics(field);
                      if (!fieldStats) return null;

                      return (
                        <div key={field.fieldId}>
                          <h4 className="text-sm font-medium text-gray-700 mb-2">{fieldStats.title}</h4>
                          <div className="space-y-1">
                            {fieldStats.type === 'options' && fieldStats.stats?.map((stat: StatOption) => (
                              <div key={stat.option} className="flex justify-between text-sm">
                                <span className="truncate mr-2">{stat.option}</span>
                                <span className="whitespace-nowrap">{stat.count}件 ({stat.percentage}%)</span>
                              </div>
                            ))}
                            {fieldStats.type === 'checkbox' && fieldStats.stats?.map((stat: StatOption) => (
                              <div key={stat.option} className="flex justify-between text-sm">
                                <span className="truncate mr-2">{stat.option}</span>
                                <span className="whitespace-nowrap">{stat.count}件 ({stat.percentage}%)</span>
                              </div>
                            ))}
                          </div>
                          {fieldStats.type === 'checkbox' && (
                            <p className="mt-1 text-xs text-gray-500">※ 複数選択可能</p>
                          )}
                        </div>
                      );
                    })
                  }

                  {/* 回答状況 */}
                  <div>
                    <h4 className="text-sm font-medium text-gray-700 mb-2">回答状況</h4>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>総回答数</span>
                        <span>{responses.length}件</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 編集モーダル */}
        {editingResponse && form && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-11/12 md:w-3/4 lg:w-1/2 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">回答を編集</h3>
                  <button
                    onClick={closeEditModal}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <form className="space-y-4 max-h-96 overflow-y-auto">
                  {/* 参加者情報 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">お名前 *</label>
                      <input
                        type="text"
                        value={editFormData.participantName || ''}
                        onChange={(e) => setEditFormData({...editFormData, participantName: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">学年 *</label>
                      <select
                        value={editFormData.participantGrade || ''}
                        onChange={(e) => setEditFormData({...editFormData, participantGrade: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="">選択してください</option>
                        <option value="1">1年生</option>
                        <option value="2">2年生</option>
                        <option value="3">3年生</option>
                        <option value="4">4年生</option>
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700">所属セクション *</label>
                      <input
                        type="text"
                        value={editFormData.participantSection || ''}
                        onChange={(e) => setEditFormData({...editFormData, participantSection: e.target.value})}
                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* フォームフィールド */}
                  {form.fields.map(field => (
                    <div key={field.fieldId}>
                      <label className="block text-sm font-medium text-gray-700">
                        {field.label} {field.required && '*'}
                      </label>
                      {field.type === 'text' || field.type === 'number' ? (
                        <input
                          type={field.type}
                          value={editFormData[field.fieldId] || ''}
                          onChange={(e) => setEditFormData({...editFormData, [field.fieldId]: e.target.value})}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : field.type === 'textarea' ? (
                        <textarea
                          rows={3}
                          value={editFormData[field.fieldId] || ''}
                          onChange={(e) => setEditFormData({...editFormData, [field.fieldId]: e.target.value})}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        />
                      ) : field.type === 'select' ? (
                        <select
                          value={editFormData[field.fieldId] || ''}
                          onChange={(e) => setEditFormData({...editFormData, [field.fieldId]: e.target.value})}
                          className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                        >
                          <option value="">選択してください</option>
                          {field.options?.map((option, index) => (
                            <option key={index} value={option}>{option}</option>
                          ))}
                        </select>
                      ) : field.type === 'radio' ? (
                        <div className="mt-1 space-y-2">
                          {field.options?.map((option, index) => (
                            <label key={index} className="flex items-center">
                              <input
                                type="radio"
                                name={field.fieldId}
                                value={option}
                                checked={editFormData[field.fieldId] === option}
                                onChange={(e) => setEditFormData({...editFormData, [field.fieldId]: e.target.value})}
                                className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">{option}</span>
                            </label>
                          ))}
                        </div>
                      ) : field.type === 'checkbox' ? (
                        <div className="mt-1 space-y-2">
                          {field.options?.map((option, index) => (
                            <label key={index} className="flex items-center">
                              <input
                                type="checkbox"
                                value={option}
                                checked={Array.isArray(editFormData[field.fieldId]) ? (editFormData[field.fieldId] as string[]).includes(option) : false}
                                onChange={(e) => {
                                  const currentValues = Array.isArray(editFormData[field.fieldId]) ? editFormData[field.fieldId] as string[] : [];
                                  if (e.target.checked) {
                                    setEditFormData({...editFormData, [field.fieldId]: [...currentValues, option]});
                                  } else {
                                    setEditFormData({...editFormData, [field.fieldId]: currentValues.filter((v: string) => v !== option)});
                                  }
                                }}
                                className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                              />
                              <span className="ml-2 text-sm text-gray-700">{option}</span>
                            </label>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </form>

                <div className="flex items-center justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
                  <button
                    onClick={closeEditModal}
                    className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={updateResponse}
                    className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    更新
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}