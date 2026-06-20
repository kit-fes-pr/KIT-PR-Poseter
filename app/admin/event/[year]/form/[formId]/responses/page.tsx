'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { formatDate } from '@/lib/utils/dateUtils';
import { LoadingInline } from '@/components/ui/Loading';
import { ResponseEditModal } from '@/components/forms/ResponseEditModal';
import { SurveyForm, ParticipantSurveyResponse, FormResponse, FormField } from '@/types/forms';
import {
  formatAvailabilitySlotLabel,
  getAvailabilityDateSlotKeys,
  normalizeAvailabilitySlots,
  toggleAvailabilitySelection,
} from '@/lib/utils/availability';
import YearPageSectionHeader from '@/components/admin/YearPageSectionHeader';

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
      '参加可能日時',
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
        (participantResponse.participantData?.availableSlots || [])
          .map((value) => formatAvailabilitySlotLabel(value))
          .join(' / '),
      ];

      // フィールドの回答を追加
      form.fields.forEach(field => {
        const answer = response.answers.find(a => a.fieldId === field.fieldId);
        const value = answer?.value;
        
        if (Array.isArray(value)) {
          row.push(field.fieldId === 'availability' ? value.map((item) => formatAvailabilitySlotLabel(item)).join(', ') : value.join(', '));
        } else {
          row.push(value ? (field.fieldId === 'availability' ? formatAvailabilitySlotLabel(value) : value) : '');
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

  const renderAnswerValue = (field: FormField, value: string | string[]) => {
    const isAvailabilityField = field.fieldId === 'availability';
    const formatValue = (item: string) => (isAvailabilityField ? formatAvailabilitySlotLabel(item) : item);
    if (Array.isArray(value)) {
      return value.map((item) => formatValue(item)).join(', ');
    }
    return value ? formatValue(value) : '-';
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

      // 参加可能時間帯フィールドの値を取得して安定キーに正規化
      const availableSlots = normalizeAvailabilitySlots(editFormData.availability);

      const updateData = {
        answers,
        participantData: {
          name: editFormData.participantName as string,
          section: editFormData.participantSection as string,
          grade: parseInt(editFormData.participantGrade as string),
          availableSlots,
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
          <LoadingInline size="lg" />
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
        <YearPageSectionHeader
          title={`${form?.title} - 回答一覧`}
          description={`回答数: ${responses.length}件`}
          actions={(
            <>
              <Link
                href={`/admin/event/${resolvedParams.year}/form`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                フォーム管理へ
              </Link>
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
            </>
          )}
        />

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
                  {([...responses]
                    .sort((a, b) => {
                      const pa = (a as ParticipantSurveyResponse).participantData;
                      const pb = (b as ParticipantSurveyResponse).participantData;
                      const ga = pa?.grade || 0;
                      const gb = pb?.grade || 0;
                      if (gb !== ga) return gb - ga; // 上級学年から
                      const na = (pa?.name || '').toString();
                      const nb = (pb?.name || '').toString();
                      return new Intl.Collator('ja').compare(na, nb); // 五十音順
                    }))
                    .map((response, index) => {
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
                                {renderAnswerValue(field, answer?.value || '')}
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
                            const participantResponse = r as ParticipantSurveyResponse;
                            return participantResponse.participantData?.grade === grade;
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
                                <span className="truncate mr-2">{formatAvailabilitySlotLabel(stat.option)}</span>
                                <span className="whitespace-nowrap">{stat.count}件 ({stat.percentage}%)</span>
                              </div>
                            ))}
                            {fieldStats.type === 'checkbox' && fieldStats.stats?.map((stat: StatOption) => (
                              <div key={stat.option} className="flex justify-between text-sm">
                                <span className="truncate mr-2">{formatAvailabilitySlotLabel(stat.option)}</span>
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
          <ResponseEditModal
            open
            title="回答を編集"
            onClose={closeEditModal}
            name={String(editFormData.participantName || '')}
            grade={String(editFormData.participantGrade || '')}
            section={String(editFormData.participantSection || '')}
            onNameChange={(value) => setEditFormData({ ...editFormData, participantName: value })}
            onGradeChange={(value) => setEditFormData({ ...editFormData, participantGrade: value })}
            onSectionChange={(value) => setEditFormData({ ...editFormData, participantSection: value })}
            onSubmit={updateResponse}
            submitLabel="更新"
            maxWidthClassName="max-w-3xl"
          >
            {form.fields.map(field => (
              <div key={field.fieldId}>
                {(() => {
                  const isAvailabilityField = field.fieldId === 'availability';
                  const optionLabel = (option: string) => (isAvailabilityField ? formatAvailabilitySlotLabel(option) : option);
                  return (
                    <>
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
                            <option key={index} value={option}>{optionLabel(option)}</option>
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
                              <span className="ml-2 text-sm text-gray-700">{optionLabel(option)}</span>
                            </label>
                          ))}
                        </div>
                      ) : field.type === 'checkbox' ? (
                        <div className="mt-1 space-y-2">
                          {(() => {
                            const allDateSlotKeys = getAvailabilityDateSlotKeys(
                              (field.options || []).map((option) => ({
                                key: option,
                                label: option,
                              }))
                            );

                            return field.options?.map((option, index) => (
                              <label key={index} className="flex items-center">
                                <input
                                  type="checkbox"
                                  value={option}
                                  checked={Array.isArray(editFormData[field.fieldId]) ? (editFormData[field.fieldId] as string[]).includes(option) : false}
                                  onChange={() => {
                                    const currentValues = Array.isArray(editFormData[field.fieldId]) ? editFormData[field.fieldId] as string[] : [];
                                    const nextValues = toggleAvailabilitySelection(currentValues, option, allDateSlotKeys);
                                    setEditFormData({ ...editFormData, [field.fieldId]: nextValues });
                                  }}
                                  className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <span className="ml-2 text-sm text-gray-700">{optionLabel(option)}</span>
                              </label>
                            ));
                          })()}
                        </div>
                      ) : null}
                    </>
                  );
                })()}
              </div>
            ))}
          </ResponseEditModal>
        )}
      </div>
    </div>
  );
}
