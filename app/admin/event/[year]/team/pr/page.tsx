'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface Team {
  teamId: string;
  teamCode: string;
  teamName: string;
  timeSlot: 'pr' | 'morning' | 'afternoon' | 'both' | 'all' | 'other';
  assignedArea: string;
  maxMembers?: number;
}

interface Participant {
  responseId: string;
  name: string;
  grade: number;
  section: string;
  submittedAt: Date;
}

interface PrAssignment {
  assignmentId?: string;
  responseId: string;
  teamId: string;
  assignedAt: Date;
  assignedBy: 'manual';
}

export default function PRTeamAssignmentPage({ params }: { params: Promise<{ year: string }> }) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ year: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [availableForms, setAvailableForms] = useState<Array<{ formId: string; title: string; responseCount: number }>>([]);
  const [selectedForm, setSelectedForm] = useState('');
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [showNonPR, setShowNonPR] = useState<boolean>(false);
  const [assignments, setAssignments] = useState<PrAssignment[]>([]);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [manualAssignTeamId, setManualAssignTeamId] = useState<string>('');
  const [manualAssignLoading, setManualAssignLoading] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'list' | 'grouped'>('grouped');

  useEffect(() => { params.then(setResolvedParams); }, [params]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!resolvedParams || !user || authLoading) return;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams, user, authLoading]);

  const isPRSection = (section: string) => {
    if (!section) return false;
    const s = section.toLowerCase();
    return s.includes('pr') || section.includes('PR系') || section.includes('ピーアール');
  };

  const loadData = async () => {
    if (!resolvedParams || !user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();

      // PRチームのみ取得
      const teamRes = await fetch(`/api/admin/teams?year=${resolvedParams.year}`, { headers: { Authorization: `Bearer ${token}` } });
      if (teamRes.ok) {
        const td = await teamRes.json();
        setTeams((td.teams || []).filter((t: Team) => t.timeSlot === 'pr'));
      }

      // フォーム一覧
      const formsRes = await fetch(`/api/forms?eventId=kohdai${resolvedParams.year}`, { headers: { Authorization: `Bearer ${token}` } });
      if (formsRes.ok) {
        const fd = await formsRes.json();
        setAvailableForms(fd.forms || []);
      }

      // 既存のPR割り当て取得
      const prRes = await fetch(`/api/admin/pr-assignments?year=${resolvedParams.year}`, { headers: { Authorization: `Bearer ${token}` } });
      if (prRes.ok) {
        const pd = await prRes.json();
        setAssignments(pd.assignments || []);
      }
    } catch (e) {
      console.error(e);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const loadParticipants = async (formId: string) => {
    if (!user || !resolvedParams || !formId) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/forms/${formId}/responses`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        const list: Participant[] = (data.responses || [])
          .map((r: { responseId: string; participantData?: { name: string; grade: number; section: string }; submittedAt: string | Date }) => ({
            responseId: r.responseId,
            name: r.participantData?.name || '',
            grade: r.participantData?.grade || 0,
            section: r.participantData?.section || '',
            submittedAt: new Date(r.submittedAt),
          }));
        setParticipants(list);
      }
    } catch (e) {
      console.error(e);
      setError('参加者の取得に失敗しました');
    }
  };

  const assignToPRTeam = async (responseId: string, teamId: string) => {
    if (!user || !resolvedParams) {
      console.error('assignToPRTeam: user or resolvedParams is missing', { user: !!user, resolvedParams: !!resolvedParams });
      return;
    }
    
    console.log('assignToPRTeam: Starting assignment', { responseId, teamId, year: resolvedParams.year });
    
    try {
      const token = await user.getIdToken();
      console.log('assignToPRTeam: Got token', { token: token.substring(0, 20) + '...' });
      
      // 既存の割り当てがある場合は先に削除
      const existingAssignment = getAssignmentForParticipant(responseId);
      if (existingAssignment?.assignmentId) {
        console.log('assignToPRTeam: Deleting existing assignment', existingAssignment.assignmentId);
        await deleteOnePRAssignment(existingAssignment.assignmentId);
      }
      
      const requestBody = { year: resolvedParams.year, responseId, teamId };
      console.log('assignToPRTeam: Request body', requestBody);
      
      const res = await fetch('/api/admin/pr-assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(requestBody)
      });
      
      console.log('assignToPRTeam: Response status', res.status);
      
      const data = await res.json();
      console.log('assignToPRTeam: Response data', data);
      
      if (!res.ok) throw new Error(data.error || '割り当てに失敗しました');
      setAssignments(data.assignments || []);
      setError(''); // Clear any previous errors
      
      // データを再読込して最新の状態を取得
      await loadData();
    } catch (e: unknown) {
      console.error('assignToPRTeam: Error occurred', e);
      setError(e instanceof Error ? e.message : '割り当てに失敗しました');
    }
  };

  const deleteOnePRAssignment = async (assignmentId: string) => {
    if (!user || !resolvedParams || !assignmentId) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/pr-assignments', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ year: resolvedParams.year, assignmentId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '削除に失敗しました');
      await loadData();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    }
  };

  const getAssignmentForParticipant = (responseId: string) => assignments.find(a => a.responseId === responseId);
  const getTeamById = (teamId: string) => teams.find(t => t.teamId === teamId);

  const getPRStats = () => {
    const prParticipants = participants.filter(p => isPRSection(p.section));
    const assigned = prParticipants.filter(p => getAssignmentForParticipant(p.responseId));
    const unassigned = prParticipants.filter(p => !getAssignmentForParticipant(p.responseId));

    return {
      total: prParticipants.length,
      assigned: assigned.length,
      unassigned: unassigned.length,
      teams: teams.length,
    };
  };
  const formatDate = (dateValue: unknown) => {
    if (!dateValue) return '-';
    try {
      let date: Date;
      if (dateValue && typeof dateValue === 'object' && 'toDate' in dateValue && typeof (dateValue as { toDate: () => Date }).toDate === 'function') date = (dateValue as { toDate: () => Date }).toDate();
      else if (typeof dateValue === 'string') date = new Date(dateValue);
      else if (dateValue instanceof Date) date = dateValue;
      else if (typeof dateValue === 'number') date = new Date(dateValue);
      else return 'Invalid Date';
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Invalid Date';
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

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                PR配布日 割り当て管理 ({resolvedParams?.year}年度)
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                PRチームとPR系参加者の割り当てを管理します
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/event/${resolvedParams?.year}/team`}
                className="inline-flex items-center px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50"
              >
                通常割り当てへ
              </Link>
              <Link
                href={`/admin/event/${resolvedParams?.year}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                イベント管理に戻る
              </Link>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 統計情報 */}
        {participants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">PRチーム数</dt>
                      <dd className="text-lg font-medium text-gray-900">{getPRStats().teams}チーム</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">PR系参加者数</dt>
                      <dd className="text-lg font-medium text-gray-900">{getPRStats().total}人</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">割り当て済み</dt>
                      <dd className="text-lg font-medium text-gray-900">{getPRStats().assigned}人</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white overflow-hidden shadow rounded-lg">
              <div className="p-5">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <svg className="h-6 w-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 17.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="ml-5 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">未割り当て</dt>
                      <dd className="text-lg font-medium text-gray-900">{getPRStats().unassigned}人</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* PRチーム一覧 */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-lg font-medium">PRチーム</h2>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-600">班で絞り込み</label>
              <select value={selectedTeamFilter} onChange={(e) => setSelectedTeamFilter(e.target.value)} className="px-3 py-2 border rounded-md text-sm">
                <option value="">全て</option>
                {teams.map(t => (
                  <option key={t.teamId} value={t.teamId}>{t.teamName}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <button onClick={() => setViewMode('list')} className={`px-3 py-2 text-sm rounded-md border ${viewMode === 'list' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}>一覧表示</button>
                <button onClick={() => setViewMode('grouped')} className={`px-3 py-2 text-sm rounded-md border ${viewMode === 'grouped' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-700 border-gray-300'}`}>班ごと表示</button>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">チーム名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">担当区域</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teams.map(t => (
                  <tr key={t.teamId}>
                    <td className="px-6 py-3 text-sm text-gray-900">{t.teamName}</td>
                    <td className="px-6 py-3 text-sm text-gray-900">{t.assignedArea}</td>
                  </tr>
                ))}
                {teams.length === 0 && (
                  <tr><td className="px-6 py-6 text-sm text-gray-500" colSpan={2}>PRチームがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 設定セクション */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">PR割り当て設定</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* フォーム選択 */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                対象フォーム
              </label>
              <select
                value={selectedForm}
                onChange={(e) => {
                  setSelectedForm(e.target.value);
                  if (e.target.value) {
                    loadParticipants(e.target.value);
                  }
                }}
                className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="">フォームを選択してください</option>
                {availableForms.map(form => (
                  <option key={form.formId} value={form.formId}>
                    {form.title} ({form.responseCount}件の回答)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 参加者一覧と割り当て結果 */}
        {participants.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">PR系参加者 割り当て</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">PR関連セクションの参加者を各PRチームに割り当て</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-col">
                    <p className="border-gray-300 rounded-md text-sm text-gray-600">エクスポート</p>
                    <button
                      onClick={() => {
                        // CSV出力
                        const collator = new Intl.Collator('ja');
                        const rows = assignments
                          .filter(a => !selectedTeamFilter || a.teamId === selectedTeamFilter)
                          .map(a => {
                            const t = teams.find(t => t.teamId === a.teamId);
                            const p = participants.find(p => p.responseId === a.responseId);
                            return { team: t?.teamName || a.teamId, grade: p?.grade || 0, name: p?.name || a.responseId };
                          });
                        const sorted = rows.sort((a, b) => {
                          const tc = collator.compare(a.team, b.team);
                          if (tc !== 0) return tc;
                          if ((b.grade || 0) !== (a.grade || 0)) return (b.grade || 0) - (a.grade || 0);
                          return collator.compare(a.name, b.name);
                        });
                        const header = ['チーム', '学年', '氏名'];
                        const data = sorted.map(r => [r.team, r.grade ? String(r.grade) : '', r.name]);
                        const csv = [header, ...data].map(row => row.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
                        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
                        const url = URL.createObjectURL(blob);
                        const link = document.createElement('a');
                        link.href = url;
                        link.download = `PR割り当て_${resolvedParams?.year || ''}.csv`;
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                        URL.revokeObjectURL(url);
                      }}
                      className="px-3 py-2 text-sm rounded-md border bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    >CSV出力</button>
                  </div>
                  <div className="flex items-center gap-2 flex-col">
                    <label className="text-sm text-gray-600">班で絞り込み</label>
                    <select
                      value={selectedTeamFilter}
                      onChange={(e) => setSelectedTeamFilter(e.target.value)}
                      className="block w-48 px-3 py-2 border border-gray-300 rounded-md text-sm"
                    >
                      <option value="">全ての班</option>
                      {teams.map((t) => (
                        <option key={t.teamId} value={t.teamId}>{t.teamName || t.assignedArea}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      参加者情報
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      回答日時
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      割り当て先
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {participants
                    .filter(p => isPRSection(p.section))
                    .slice()
                    .sort((a, b) => (b.grade || 0) - (a.grade || 0) || new Intl.Collator('ja').compare(a.name || '', b.name || ''))
                    .map((participant) => {
                      const assignment = getAssignmentForParticipant(participant.responseId);
                      const team = assignment ? getTeamById(assignment.teamId) : null;

                      return (
                        <tr key={participant.responseId}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              <div className="font-medium">{participant.name}</div>
                              <div className="text-gray-500">
                                {participant.grade}年 - {participant.section}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {formatDate(participant.submittedAt)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {assignment && team ? (
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">{team.teamName}</div>
                                <div className="text-gray-500">{team.assignedArea}</div>
                                <div className="flex space-x-2 mt-1">
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                                    手動
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                                未割り当て
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <button
                              onClick={() => {
                                setSelectedParticipant(participant);
                                setManualAssignTeamId(assignment?.teamId || '');
                                setShowManualModal(true);
                              }}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              {assignment ? '変更' : '割り当て'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  {participants.filter(p => isPRSection(p.section)).length === 0 && (
                    <tr><td className="px-6 py-6 text-sm text-gray-500" colSpan={4}>PR系参加者は読み込まれていません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* フォーム未選択時のメッセージ */}
        {participants.length === 0 && selectedForm === '' && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">フォームを選択してください</h3>
            <p className="mt-1 text-sm text-gray-500">
              PR割り当てを行うアンケートフォームを選択してください。
            </p>
          </div>
        )}

        {/* 非PR参加者（アコーディオンで隠す） */}
        <div className="bg-white shadow rounded-lg mt-4">
          <button
            className="w-full px-4 py-3 text-left border-b border-gray-200 flex items-center justify-between"
            onClick={() => setShowNonPR(v => !v)}
          >
            <span className="text-lg font-medium">非PR参加者（手動・任意）</span>
            <span className="text-sm text-gray-500">{showNonPR ? '閉じる' : '開く'} / {participants.filter(p => !isPRSection(p.section)).length} 名</span>
          </button>
          {showNonPR && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">参加者情報</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">回答日時</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">割り当て先</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {participants
                    .filter(p => !isPRSection(p.section))
                    .slice()
                    .sort((a, b) => (b.grade || 0) - (a.grade || 0) || new Intl.Collator('ja').compare(a.name || '', b.name || ''))
                    .map(p => (
                      <tr key={p.responseId}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            <div className="font-medium">{p.name}</div>
                            <div className="text-gray-500">{p.grade}年 - {p.section}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDate(p.submittedAt)}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {(() => {
                            const assignment = getAssignmentForParticipant(p.responseId);
                            const a = assignment;
                            const t = a ? getTeamById(a.teamId) : null;
                            return a && t ? (
                              <div className="text-sm">
                                <div className="font-medium text-gray-900">{t.teamName}</div>
                                <div className="text-gray-500">{t.assignedArea}</div>
                                <div className="flex space-x-2 mt-1">
                                  <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">手動</span>
                                </div>
                              </div>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">未割り当て</span>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <button
                            onClick={() => {
                              const assignment = getAssignmentForParticipant(p.responseId);
                              setSelectedParticipant(p);
                              setManualAssignTeamId(assignment?.teamId || '');
                              setShowManualModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            {getAssignmentForParticipant(p.responseId) ? '変更' : '割り当て'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  {participants.filter(p => !isPRSection(p.section)).length === 0 && (
                    <tr><td className="px-6 py-6 text-sm text-gray-500" colSpan={4}>非PR参加者はいません</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>


        {selectedForm && viewMode === 'grouped' && (
          <div className="space-y-6 mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {teams
                .filter(t => !selectedTeamFilter || t.teamId === selectedTeamFilter)
                .map(team => {
                  const teamAssignments = assignments.filter(a => a.teamId === team.teamId);
                  const teamParticipants = teamAssignments
                    .map(a => ({ a, p: participants.find(p => p.responseId === a.responseId) }))
                    .filter(x => x.p);
                  return (
                    <div key={team.teamId} className="bg-white shadow rounded-lg">
                      <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                        <div>
                          <div className="font-medium text-gray-900">{team.teamName}</div>
                          <div className="text-sm text-gray-500">{team.assignedArea}</div>
                        </div>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                          {teamParticipants.length} 名
                        </span>
                      </div>
                      <ul className="divide-y divide-gray-200">
                        {teamParticipants.length === 0 && (
                          <li className="px-4 py-4 text-sm text-gray-400">割り当てなし</li>
                        )}
                        {teamParticipants
                          .sort((x, y) => ((y.p!.grade || 0) - (x.p!.grade || 0)) || new Intl.Collator('ja').compare(x.p!.name || '', y.p!.name || ''))
                          .map(({ a, p }) => (
                            <li key={a.assignmentId || `${a.teamId}-${a.responseId}`} className="px-4 py-3 flex items-center justify-between">
                              <div>
                                <div className="text-sm font-medium text-gray-900">{p!.name}</div>
                                <div className="text-xs text-gray-500">{p!.grade}年 - {p!.section}</div>
                              </div>
                              <button onClick={() => deleteOnePRAssignment(a.assignmentId || '')} className="px-2 py-1 border rounded text-red-700 border-red-300 hover:bg-red-50">削除</button>
                            </li>
                          ))}
                      </ul>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {showManualModal && selectedParticipant && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">PR割り当て変更</h3>
                  <button
                    onClick={() => { setShowManualModal(false); setSelectedParticipant(null); setManualAssignTeamId(''); }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <div className="font-medium text-gray-900">{selectedParticipant.name}</div>
                  <div className="text-sm text-gray-500">{selectedParticipant.grade}年 - {selectedParticipant.section}</div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">割り当て先PRチーム</label>
                    <select value={manualAssignTeamId} onChange={(e) => setManualAssignTeamId(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                      <option value="">チームを選択</option>
                      {teams.map(team => (
                        <option key={team.teamId} value={team.teamId}>{team.teamName} - {team.assignedArea}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => { setShowManualModal(false); setSelectedParticipant(null); setManualAssignTeamId(''); }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >キャンセル</button>
                  {getAssignmentForParticipant(selectedParticipant?.responseId || '') && (
                    <button
                      disabled={manualAssignLoading}
                      onClick={async () => {
                        if (!selectedParticipant) return;
                        const assignment = getAssignmentForParticipant(selectedParticipant.responseId);
                        if (!assignment?.assignmentId) return;
                        try {
                          setManualAssignLoading(true);
                          await deleteOnePRAssignment(assignment.assignmentId);
                          setShowManualModal(false);
                          setSelectedParticipant(null);
                          setManualAssignTeamId('');
                        } catch (e: unknown) {
                          setError(e instanceof Error ? e.message : '削除に失敗しました');
                        } finally {
                          setManualAssignLoading(false);
                        }
                      }}
                      className="px-4 py-2 border border-red-300 rounded-md text-sm font-medium text-red-700 bg-white hover:bg-red-50 disabled:opacity-50"
                    >{manualAssignLoading ? '削除中...' : '割り当て削除'}</button>
                  )}
                  <button
                    disabled={manualAssignLoading || !manualAssignTeamId}
                    onClick={async () => {
                      if (!selectedParticipant || !manualAssignTeamId) return;
                      try {
                        setManualAssignLoading(true);
                        await assignToPRTeam(selectedParticipant.responseId, manualAssignTeamId);
                        setShowManualModal(false);
                        setSelectedParticipant(null);
                        setManualAssignTeamId('');
                      } catch (e: unknown) {
                        setError(e instanceof Error ? e.message : '更新に失敗しました');
                      } finally {
                        setManualAssignLoading(false);
                      }
                    }}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >{manualAssignLoading ? '保存中...' : '割り当てを保存'}</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
