'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { formatDate } from '@/lib/utils/dateUtils';
import { normalizeAvailableTime } from '@/lib/utils/availability';

interface Participant {
  responseId: string;
  name: string;
  grade: number;
  section: string;
  availability: string;
  submittedAt: Date;
}

interface Team {
  teamId: string;
  teamCode: string;
  teamName: string;
  timeSlot: 'morning' | 'afternoon' | 'both' | 'all' | 'pr' | 'other';
  assignedArea: string;
  adjacentAreas?: string[];
  maxMembers: number;
  preferredGrades?: number[];
}

interface Assignment {
  responseId: string;
  teamId: string;
  assignedAt: Date;
  assignedBy: 'auto' | 'manual';
  timeSlot: 'morning' | 'afternoon';
}

interface PRAssignmentChoice {
  responseId: string;
  name: string;
  section: string;
  availability: string;
  choice?: 'none';
}

export default function TeamAssignmentPage({ params }: { params: Promise<{ year: string }> }) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ year: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [assignmentMode, setAssignmentMode] = useState<'auto' | 'manual'>('auto');
  const [selectedForm, setSelectedForm] = useState<string>('');
  const [availableForms, setAvailableForms] = useState<Array<{
    formId: string;
    title: string;
    responseCount: number;
  }>>([]);
  const [showPRModal, setShowPRModal] = useState(false);
  const [prParticipants, setPrParticipants] = useState<PRAssignmentChoice[]>([]);
  const [prChoices, setPrChoices] = useState<Record<string, 'none' | undefined>>({});
  const [showManualModal, setShowManualModal] = useState(false);
  const [selectedParticipant, setSelectedParticipant] = useState<Participant | null>(null);
  const [manualAssignTeamId, setManualAssignTeamId] = useState<string>('');
  const [manualAssignLoading, setManualAssignLoading] = useState<boolean>(false);
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('');
  const [includeOtherTeams, setIncludeOtherTeams] = useState<boolean>(false);

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setAuthLoading(false);
      if (!user) {
        // ログアウト状態の場合はadminページにリダイレクト
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!resolvedParams || !user || authLoading) return;
    loadData();
  }, [resolvedParams, user, authLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadData = async () => {
    if (!resolvedParams || !user) return;

    try {
      setLoading(true);
      const token = await user.getIdToken();

      // 利用可能なフォーム一覧を取得
      const formsRes = await fetch(`/api/forms?eventId=kohdai${resolvedParams.year}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (formsRes.ok) {
        const formsData = await formsRes.json();
        setAvailableForms(formsData.forms || []);
      }

      // チーム一覧を取得
      await loadTeams();

      // 既存の割り当てを取得
      await loadAssignments();
    } catch (err) {
      setError('データの取得に失敗しました');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const isPRSection = (section: string) => {
    if (!section) return false;
    const s = section.toLowerCase();
    return s.includes('pr') || section.includes('PR系') || section.includes('ピーアール');
  };

  const loadTeams = async () => {
    if (!resolvedParams || !user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/teams?year=${resolvedParams.year}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data: { teams: Team[] } = await res.json();
        // PRチームはこの画面では非表示
        const onlyNonPR = (data.teams || []).filter((t: Team) => t.timeSlot !== 'pr');
        setTeams(onlyNonPR);
      }
    } catch (err) {
      console.error('チーム取得エラー:', err);
    }
  };

  const loadParticipants = async (formId: string) => {
    if (!resolvedParams || !user || !formId) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/forms/${formId}/responses`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        const participantList = data.responses.map((response: {
          responseId: string;
          participantData?: { name: string; grade: number; section: string; availableTime?: 'morning' | 'afternoon' | 'both' | 'pr' | 'other' };
          answers?: Array<{ fieldId: string; value: string }>;
          submittedAt: string | Date;
        }) => {
          const raw = response.participantData?.availableTime
            || response.answers?.find((a) => a.fieldId === 'availability')?.value
            || '';
          const availability = normalizeAvailableTime(raw, undefined);

          return {
            responseId: response.responseId,
            name: response.participantData?.name || '',
            grade: response.participantData?.grade || 0,
            section: response.participantData?.section || '',
            availability,
            submittedAt: new Date(response.submittedAt),
          };
        });
        setParticipants(participantList);
      }
    } catch (err) {
      setError('参加者データの取得に失敗しました');
      console.error(err);
    }
  };

  const loadAssignments = async () => {
    if (!resolvedParams || !user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/assignments?year=${resolvedParams.year}`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (res.ok) {
        const data = await res.json();
        setAssignments(data.assignments || []);
      }
    } catch (err) {
      console.error('割り当て取得エラー:', err);
    }
  };

  const performAutoAssignment = async () => {
    if (!selectedForm || participants.length === 0 || teams.length === 0) {
      setError('フォーム、参加者、チームデータが必要です');
      return;
    }

    try {
      if (!user) {
        setError('認証が必要です');
        return;
      }
      const token = await user.getIdToken();

      // PR系の選択を事前に確認（初回は全PR対象者を選択対象にする）
      const prTargets = participants
        .filter(p => isPRSection(p.section))
        .map(p => ({ responseId: p.responseId, name: p.name, section: p.section, availability: p.availability }));

      const needChoice = prTargets.filter(p => prChoices[p.responseId] !== 'none');
      if (prTargets.length > 0 && needChoice.length > 0) {
        setPrParticipants(prTargets);
        setShowPRModal(true);
        return;
      }

      // PR選択がある場合はそれを含める
      const prChoicesList = Object.entries(prChoices).map(([responseId, choice]) => ({ responseId, choice }));

      // PR選択結果を反映して送信データを作成
      const participantsToAssign = participants
        .filter(p => {
          if (!isPRSection(p.section)) return true;
          const c = prChoices[p.responseId];
          if (c === 'none') return false; // 本部待機
          return true;
        });

      const res = await fetch('/api/admin/assignments/auto', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          year: resolvedParams?.year,
          formId: selectedForm,
          participants: participantsToAssign,
          teams,
          prChoices: prChoicesList,
          includeOther: includeOtherTeams,
        }),
      });

      if (res.ok) {
        const data = await res.json();

        // PR選択が必要な場合
        if (data.requiresPRChoice) {
          setPrParticipants(data.prParticipants);
          setShowPRModal(true);
          return;
        }

        setAssignments(data.assignments);
        setError('');
        setShowPRModal(false);
        setPrChoices({});
      } else {
        const errorData = await res.json();
        setError(errorData.error || '自動割り当てに失敗しました');
      }
    } catch (err) {
      setError('自動割り当てに失敗しました');
      console.error(err);
    }
  };

  const handlePRChoiceSubmit = () => {
    // 全てのPR参加者が選択済みかチェック
    const allChosen = prParticipants.every(p => prChoices[p.responseId]);

    if (!allChosen) {
      setError('全てのPR関連参加者の時間帯を選択してください');
      return;
    }

    setShowPRModal(false);
    setError('');
    // 選択完了後、再度自動割り当てを実行
    performAutoAssignment();
  };

  const clearAssignments = async () => {
    if (!selectedForm || !user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/assignments', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          year: resolvedParams?.year,
          formId: selectedForm,
        }),
      });

      if (res.ok) {
        setAssignments([]);
        setError('');
      } else {
        const errorData = await res.json();
        setError(errorData.error || '割り当てのクリアに失敗しました');
      }
    } catch (err) {
      setError('割り当てのクリアに失敗しました');
      console.error(err);
    }
  };


  const getAssignmentForParticipant = (responseId: string) => {
    return assignments.find(a => a.responseId === responseId);
  };

  const getTeamById = (teamId: string) => {
    return teams.find(t => t.teamId === teamId);
  };

  const getAssignmentStats = () => {
    const assigned = participants.filter(p => getAssignmentForParticipant(p.responseId));
    const unassigned = participants.filter(p => !getAssignmentForParticipant(p.responseId));

    return {
      total: participants.length,
      assigned: assigned.length,
      unassigned: unassigned.length,
    };
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
    return null;
  }

  const stats = getAssignmentStats();
  const filteredParticipants = participants.filter((p) => {
    if (!selectedTeamFilter) return true;
    const a = getAssignmentForParticipant(p.responseId);
    return a?.teamId === selectedTeamFilter;
  });
  const collator = new Intl.Collator('ja');
  const sortedParticipants = [...filteredParticipants].sort((a, b) => {
    if ((b.grade || 0) !== (a.grade || 0)) return (b.grade || 0) - (a.grade || 0);
    const an = a.name || '';
    const bn = b.name || '';
    return collator.compare(an, bn);
  });

  const exportAssignmentsCsv = () => {
    if (assignments.length === 0) {
      setError('出力できる割り当てがありません');
      return;
    }
    const collator = new Intl.Collator('ja');
    const rows = assignments
      .map(a => {
        const p = participants.find(p => p.responseId === a.responseId);
        const t = teams.find(t => t.teamId === a.teamId);
        if (!p || !t) return null;
        const teamLabel = t.teamName || t.assignedArea || t.teamId;
        return {
          team: teamLabel,
          grade: p.grade || 0,
          name: p.name || '',
        };
      })
      .filter(Boolean) as Array<{ team: string; grade: number; name: string }>;

    const sorted = rows.sort((a, b) => {
      const tc = collator.compare(a.team, b.team);
      if (tc !== 0) return tc;
      if ((b.grade || 0) !== (a.grade || 0)) return (b.grade || 0) - (a.grade || 0);
      return collator.compare(a.name, b.name);
    });

    const header = ['チーム', '学年', '氏名'];
    const data = sorted.map(r => [r.team, r.grade ? `${r.grade}` : '', r.name]);
    const csvContent = [header, ...data]
      .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `チーム割り当て_${resolvedParams?.year || ''}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                チーム割り当て管理 ({resolvedParams?.year}年度)
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                アンケート結果を基に参加者を配布区域チームに自動割り当てします
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/admin/event/${resolvedParams?.year}/team/pr`}
                className="inline-flex items-center px-4 py-2 border border-indigo-300 text-sm font-medium rounded-md text-indigo-700 bg-white hover:bg-indigo-50"
              >
                PR配布日タブへ
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

        {/* 設定セクション */}
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">割り当て設定</h2>

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

            {/* 割り当てモード */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                割り当てモード
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="auto"
                    checked={assignmentMode === 'auto'}
                    onChange={(e) => setAssignmentMode(e.target.value as 'auto' | 'manual')}
                    className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">自動割り当て</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="manual"
                    checked={assignmentMode === 'manual'}
                    onChange={(e) => setAssignmentMode(e.target.value as 'auto' | 'manual')}
                    className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                  />
                  <span className="ml-2 text-sm text-gray-700">手動割り当て</span>
                </label>
              </div>
            </div>
          </div>

          {/* 自動割り当て実行ボタン */}
          {assignmentMode === 'auto' && (
            <div className="mt-6 flex flex-col gap-3">
              <button
                onClick={performAutoAssignment}
                disabled={!selectedForm || participants.length === 0 || teams.length === 0}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                自動割り当てを実行
              </button>
              {teams.some(t => t.timeSlot === 'other') && (
                <label className="inline-flex items-center text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-2"
                    checked={includeOtherTeams}
                    onChange={(e) => setIncludeOtherTeams(e.target.checked)}
                  />
                  その他（other）チームも対象にする
                </label>
              )}

              {assignments.length > 0 && (
                <button
                  onClick={clearAssignments}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  割り当てをクリア
                </button>
              )}
            </div>
          )}
        </div>

        {/* 統計情報 */}
        {participants.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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
                      <dt className="text-sm font-medium text-gray-500 truncate">総参加者数</dt>
                      <dd className="text-lg font-medium text-gray-900">{stats.total}人</dd>
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
                      <dd className="text-lg font-medium text-gray-900">{stats.assigned}人</dd>
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
                      <dd className="text-lg font-medium text-gray-900">{stats.unassigned}人</dd>
                    </dl>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 参加者一覧と割り当て結果 */}
        {participants.length > 0 && (
          <div className="bg-white shadow overflow-hidden sm:rounded-md">
            <div className="px-4 py-5 sm:px-6">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">参加者一覧と割り当て状況</h3>
                  <p className="mt-1 max-w-2xl text-sm text-gray-500">選択されたフォームの回答者とチーム割り当て状況</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-2 flex-col">
                    <p className="border-gray-300 rounded-md text-sm text-gray-600">エクスポート</p>
                    <button
                      onClick={exportAssignmentsCsv}
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
                      希望時間帯
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
                  {sortedParticipants.map((participant) => {
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {participant.availability}
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
                                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${assignment.assignedBy === 'auto'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-green-100 text-green-800'
                                  }`}>
                                  {assignment.assignedBy === 'auto' ? '自動' : '手動'}
                                </span>
                                {assignment.timeSlot && (
                                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${assignment.timeSlot === 'morning'
                                    ? 'bg-yellow-100 text-yellow-800'
                                    : 'bg-purple-100 text-purple-800'
                                    }`}>
                                    {assignment.timeSlot === 'morning' ? '午前' : '午後'}
                                  </span>
                                )}
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
                              setShowManualModal(true);
                            }}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            変更
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

        {/* フォーム未選択時のメッセージ */}
        {participants.length === 0 && selectedForm === '' && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">フォームを選択してください</h3>
            <p className="mt-1 text-sm text-gray-500">
              チーム割り当てを行うアンケートフォームを選択してください。
            </p>
          </div>
        )}

        {/* PR選択モーダル */}
        {showPRModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    PR関連参加者の時間帯選択
                  </h3>
                  <button
                    onClick={() => setShowPRModal(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <p className="text-sm text-gray-600 mb-4">
                  PR関連セクションの参加者は重複を避けるため、担当する時間帯を選択してください。
                </p>

                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {prParticipants.map(participant => (
                    <div key={participant.responseId} className="border rounded-lg p-4">
                      <div className="mb-3">
                        <div className="font-medium text-gray-900">{participant.name}</div>
                        <div className="text-sm text-gray-500">{participant.section}</div>
                      </div>

            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name={`pr-choice-${participant.responseId}`}
                  checked={prChoices[participant.responseId] === 'none'}
                  onChange={(e) => setPrChoices(prev => ({
                    ...prev,
                    [participant.responseId]: e.target.checked ? 'none' : undefined
                  }))}
                  className="h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500"
                />
                <span className="ml-2 text-sm text-gray-700">本部待機（配布担当なし）にする</span>
              </label>
            </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => setShowPRModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={handlePRChoiceSubmit}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    選択を確定して割り当て実行
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 手動割り当てモーダル */}
        {showManualModal && selectedParticipant && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-gray-900">
                    手動割り当て変更
                  </h3>
                  <button
                    onClick={() => {
                      setShowManualModal(false);
                      setSelectedParticipant(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                <div className="mb-4">
                  <div className="font-medium text-gray-900">{selectedParticipant.name}</div>
                  <div className="text-sm text-gray-500">
                    {selectedParticipant.grade}年 - {selectedParticipant.section}
                  </div>
                  <div className="text-sm text-gray-500">
                    希望時間帯: {selectedParticipant.availability}
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      割り当て先チーム
                    </label>
                    <select value={manualAssignTeamId} onChange={(e) => setManualAssignTeamId(e.target.value)} className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                      <option value="">チームを選択</option>
                      {teams.map(team => (
                        <option key={team.teamId} value={team.teamId}>
                          {team.teamName} - {team.assignedArea} (最大{team.maxMembers || 10}人)
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowManualModal(false);
                      setSelectedParticipant(null);
                      setManualAssignTeamId('');
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    disabled={manualAssignLoading || !manualAssignTeamId || !selectedParticipant}
                    onClick={async () => {
                      if (!selectedParticipant || !manualAssignTeamId) return;
                      try {
                        setManualAssignLoading(true);
                        const token = await user!.getIdToken();
                        // 時間帯の自動決定
                        const team = teams.find(t => t.teamId === manualAssignTeamId);
                        let ts: 'morning' | 'afternoon' = 'morning';
                        if (team?.timeSlot === 'morning') ts = 'morning';
                        else if (team?.timeSlot === 'afternoon') ts = 'afternoon';
                        else {
                          // both/all or other -> 参加者の希望に合わせる（午後希望優先）
                          ts = (selectedParticipant.availability === 'afternoon') ? 'afternoon' : 'morning';
                        }
                        const res = await fetch('/api/admin/assignments', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                          body: JSON.stringify({
                            year: resolvedParams?.year,
                            formId: selectedForm,
                            responseId: selectedParticipant.responseId,
                            teamId: manualAssignTeamId,
                            timeSlot: ts,
                          })
                        });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || '更新に失敗しました');
                        // 再読込
                        await loadAssignments();
                        setShowManualModal(false);
                        setSelectedParticipant(null);
                        setManualAssignTeamId('');
                      } catch (e: unknown) {
                        const msg = e instanceof Error ? e.message : '更新に失敗しました';
                        setError(msg);
                      } finally {
                        setManualAssignLoading(false);
                      }
                    }}
                    className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {manualAssignLoading ? '保存中...' : '割り当てを保存'}
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
