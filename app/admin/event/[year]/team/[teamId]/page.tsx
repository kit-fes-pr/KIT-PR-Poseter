/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Team, Store } from '@/types';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

const fetcherAuth = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('認証が必要です');
  return res.json();
};

export default function TeamDetailPage() {
  const router = useRouter();
  const params = useParams<{ year: string; teamId: string }>();
  const y = params?.year;
  const teamId = params?.teamId;

  const [isAdmin, setIsAdmin] = useState(false);
  const [team, setTeam] = useState<Team | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const completed = useMemo(() => stores.filter((s: Store) => s.distributionStatus === 'completed'), [stores]);
  const failed = useMemo(() => stores.filter((s: Store) => s.distributionStatus === 'failed'), [stores]);
  const revisit = useMemo(() => stores.filter((s: Store) => s.distributionStatus === 'revisit'), [stores]);
  const [loading, setLoading] = useState(true);
  const [isBasicEditOpen, setIsBasicEditOpen] = useState(false);
  const [editForm, setEditForm] = useState<{ teamName: string; timeSlot: string; assignedArea: string; adjacentAreas: string; validDate: string }>({ teamName: '', timeSlot: 'morning', assignedArea: '', adjacentAreas: '', validDate: '' });
  const [memberLoading, setMemberLoading] = useState(false);
  const [assignedMembers, setAssignedMembers] = useState<Array<{ responseId: string; name: string; grade: number; section: string; timeSlot: 'morning' | 'afternoon' | 'pr'; formId: string }>>([]);

  // Firebase認証状態を監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        // ログアウト状態の場合はadminページにリダイレクト
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!teamId) {
      console.error('No teamId provided');
      router.push('/admin/event');
      return;
    }

    const init = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return router.push('/admin');
        const v = await fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } });
        if (!v.ok) throw new Error('unauthorized');
        const data = await v.json();
        if (!data?.user?.isAdmin) throw new Error('forbidden');
        setIsAdmin(true);

        const td = await fetcherAuth(`/api/admin/teams/${teamId}`);
        setTeam(td.team);

        // validDate の安全な処理
        let d: Date | null = null;
        try {
          const v = td.team.validDate as unknown;
          if (v) {
            if (
              typeof v === 'object' && v !== null && '_seconds' in v &&
              typeof (v as any)._seconds === 'number'
            ) {
              d = new Date((v as any)._seconds * 1000);
            } else if (
              typeof v === 'object' && v !== null && 'toDate' in v &&
              typeof (v as any).toDate === 'function'
            ) {
              d = (v as any).toDate();
            } else {
              d = new Date(v as any);
            }
            if (d && isNaN(d.getTime())) d = null;
          }
        } catch (error) {
          console.error('validDate parsing error:', error);
          d = null;
        }

        setEditForm({
          teamName: td.team.teamName || '',
          timeSlot: td.team.timeSlot || 'morning',
          assignedArea: td.team.assignedArea || '',
          adjacentAreas: Array.isArray(td.team.adjacentAreas) ? td.team.adjacentAreas.join(', ') : '',
          validDate: d ? d.toISOString().slice(0, 10) : ''
        });

        const st = await fetcherAuth(`/api/admin/teams/${teamId}/stores`);
        setStores(st.stores || []);
      } catch (error) {
        console.error('Team detail loading error:', error);
        localStorage.removeItem('authToken');
        router.push('/admin');
      } finally {
        setLoading(false);
      }
    };
    if (teamId) init();
  }, [router, teamId]);

  // 割り当てメンバー取得
  useEffect(() => {
    const loadMembers = async () => {
      if (!teamId || !y) return;
      try {
        setMemberLoading(true);
        const token = localStorage.getItem('authToken');
        if (!token) return;
        
        // 通常の割り当てを取得
        const res = await fetch(`/api/admin/assignments?year=${y}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = res.ok ? await res.json() : { assignments: [] };
        const teamAssignments = (data.assignments || []).filter((a: any) => a.teamId === teamId);
        
        // PR配布の割り当てを取得
        const prRes = await fetch(`/api/admin/pr-assignments?year=${y}`, { headers: { Authorization: `Bearer ${token}` } });
        const prData = prRes.ok ? await prRes.json() : { assignments: [] };
        const prTeamAssignments = (prData.assignments || []).filter((a: any) => a.teamId === teamId);
        
        // 両方の割り当てを統合
        const allAssignments = [...teamAssignments, ...prTeamAssignments];
        
        if (allAssignments.length === 0) {
          setAssignedMembers([]);
          return;
        }
        
        // 通常の割り当てのformIdsを取得
        const formIds: string[] = Array.from(new Set<string>(teamAssignments.map((a: any) => String(a.formId)).filter(Boolean)));
        const responseMaps: Record<string, any> = {};
        
        // 通常の割り当てのフォーム情報を取得
        await Promise.all(
          formIds.map(async (fid: string) => {
            const fr = await fetch(`/api/forms/${fid}/responses`, { headers: { Authorization: `Bearer ${token}` } });
            if (!fr.ok) return;
            const frd = await fr.json();
            for (const r of frd.responses || []) {
              responseMaps[r.responseId] = r;
            }
          })
        );
        
        // PR配布メンバーの情報を取得するため、全フォームを検索
        if (prTeamAssignments.length > 0) {
          const formsRes = await fetch(`/api/forms?eventId=kohdai${y}`, { headers: { Authorization: `Bearer ${token}` } });
          if (formsRes.ok) {
            const formsData = await formsRes.json();
            const allFormIds = (formsData.forms || []).map((f: any) => f.formId);
            
            await Promise.all(
              allFormIds.map(async (fid: string) => {
                const fr = await fetch(`/api/forms/${fid}/responses`, { headers: { Authorization: `Bearer ${token}` } });
                if (!fr.ok) return;
                const frd = await fr.json();
                for (const r of frd.responses || []) {
                  if (!responseMaps[r.responseId]) {
                    responseMaps[r.responseId] = r;
                  }
                }
              })
            );
          }
        }
        
        const members = allAssignments.map((a: any) => {
          const r = responseMaps[a.responseId];
          const name = r?.participantData?.name || '-';
          const grade = r?.participantData?.grade || 0;
          const section = r?.participantData?.section || '-';
          // PR配布の場合はtimeSlotがないので'pr'として扱う
          const timeSlot = a.timeSlot || 'pr';
          return { responseId: a.responseId, name, grade, section, timeSlot, formId: a.formId || 'pr' };
        });
        setAssignedMembers(members);
      } catch (e) {
        console.error('Load assigned members error:', e);
      } finally {
        setMemberLoading(false);
      }
    };
    loadMembers();
  }, [teamId, y]);

  if (!isAdmin) return null;

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      revisit: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    const label: Record<string, string> = {
      completed: '配布済み',
      failed: '配布不可',
      revisit: '要再訪問',
      pending: '未配布',
    };
    const cls = map[status] || map.pending;
    const text = label[status] || label.pending;
    return <span className={`inline-block px-2 py-1 text-xs rounded-full ${cls}`}>{text}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">{y} 年度 チーム詳細</h1>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => router.push(`/admin/event/${y}`)} className="px-3 py-2 border rounded-md text-sm">戻る</button>
              <button
                onClick={() => setIsBasicEditOpen(true)}
                className="px-3 py-2 border rounded-md text-sm"
              >編集</button>
              <button
                className="px-3 py-2 border border-red-300 text-red-700 rounded-md text-sm"
                onClick={async () => {
                  if (!confirm('このチームを削除しますか？配布記録がある場合は削除できません。')) return;
                  try {
                    const token = localStorage.getItem('authToken');
                    const res = await fetch(`/api/admin/teams/${teamId}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '削除に失敗しました');
                    router.push(`/admin/event/${y}`);
                  } catch (error: unknown) {
                    const message = error instanceof Error ? error.message : '削除に失敗しました';
                    alert(message);
                  }
                }}
              >削除</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-3">
          <h2 className="text-lg font-medium">{team?.teamName}（{team?.teamCode}）</h2>
          <p className="text-sm text-gray-600 mt-1">担当区域: {team?.assignedArea || '-'}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-600">総件数</p>
              <p className="text-2xl font-bold">{stores.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">配布済み</p>
              <p className="text-2xl font-bold text-green-600">{completed.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">配布不可</p>
              <p className="text-2xl font-bold text-red-600">{failed.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">要再訪問</p>
              <p className="text-2xl font-bold text-yellow-600">{revisit.length}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow lg:col-span-1">
          <h2 className="text-lg font-medium mb-3">配布済み</h2>
          <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
            {completed.map((s: Store) => (
              <div key={s.storeId} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.storeName}</p>
                  <StatusBadge status={s.distributionStatus} />
                </div>
                <p className="text-sm text-gray-600">{s.address}</p>
                <p className="text-xs text-gray-500 mt-1">配布枚数: {s.distributedCount || 0}</p>
                {s.notes && <p className="text-xs text-gray-500 mt-1">備考: {s.notes}</p>}
              </div>
            ))}
            {completed.length === 0 && <p className="text-sm text-gray-500">なし</p>}
          </div>
          {isBasicEditOpen && (
            <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-lg font-medium mb-4">基本情報を編集</h2>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">チーム名</label>
                    <input className="mt-1 w-full border rounded px-3 py-2" value={editForm.teamName} onChange={(e) => setEditForm({ ...editForm, teamName: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">時間帯</label>
                    <select className="mt-1 w-full border rounded px-3 py-2" value={editForm.timeSlot} onChange={(e) => setEditForm({ ...editForm, timeSlot: e.target.value })}>
                      <option value="morning">午前</option>
                      <option value="afternoon">午後</option>
                      <option value="both">全日</option>
                      <option value="pr">PR配布日</option>
                      <option value="other">その他</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">担当区域</label>
                    <input className="mt-1 w-full border rounded px-3 py-2" value={editForm.assignedArea} onChange={(e) => setEditForm({ ...editForm, assignedArea: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">周辺区域（カンマ区切り）</label>
                    <input className="mt-1 w-full border rounded px-3 py-2" value={editForm.adjacentAreas} onChange={(e) => setEditForm({ ...editForm, adjacentAreas: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">アクセス可能日</label>
                    <input type="date" className="mt-1 w-full border rounded px-3 py-2" value={editForm.validDate} onChange={(e) => setEditForm({ ...editForm, validDate: e.target.value })} />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3">
                  <button onClick={() => setIsBasicEditOpen(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">キャンセル</button>
                  <button
                    onClick={async () => {
                      try {
                        const token = localStorage.getItem('authToken');
                        const payload = {
                          teamName: editForm.teamName,
                          timeSlot: editForm.timeSlot,
                          assignedArea: editForm.assignedArea,
                          adjacentAreas: editForm.adjacentAreas,
                          validDate: editForm.validDate,
                        };
                        const res = await fetch(`/api/admin/teams/${teamId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
                        const data = await res.json();
                        if (!res.ok) throw new Error(data.error || '更新に失敗しました');
                        setTeam(data.team);
                        setIsBasicEditOpen(false);
                      } catch (error: unknown) {
                        const message = error instanceof Error ? error.message : '更新に失敗しました';
                        alert(message);
                      }
                    }}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md"
                  >保存</button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="bg-white p-6 rounded-lg shadow lg:col-span-1">
          <h2 className="text-lg font-medium mb-3">配布不可</h2>
          <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
            {failed.map((s: Store) => (
              <div key={s.storeId} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.storeName}</p>
                  <StatusBadge status={s.distributionStatus} />
                </div>
                <p className="text-sm text-gray-600">{s.address}</p>
                <p className="text-xs text-gray-500 mt-1">理由: {s.failureReason || '-'}</p>
                {s.notes && <p className="text-xs text-gray-500 mt-1">備考: {s.notes}</p>}
              </div>
            ))}
            {failed.length === 0 && <p className="text-sm text-gray-500">なし</p>}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow lg:col-span-1">
          <h2 className="text-lg font-medium mb-3">要再訪問</h2>
          <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
            {revisit.map((s: Store) => (
              <div key={s.storeId} className="border rounded p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium">{s.storeName}</p>
                  <StatusBadge status={s.distributionStatus} />
                </div>
                <p className="text-sm text-gray-600">{s.address}</p>
                {s.notes && <p className="text-xs text-gray-500 mt-1">備考: {s.notes}</p>}
              </div>
            ))}
            {revisit.length === 0 && <p className="text-sm text-gray-500">なし</p>}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-3">
          <h2 className="text-lg font-medium mb-4">基本情報</h2>
          {loading ? <p className="text-sm text-gray-500">読み込み中...</p> : (
            <div className="space-y-3 text-sm">
              <p><span className="text-gray-600">チーム名:</span> <span className="ml-2 font-medium">{team?.teamName || '-'}</span></p>
              <p><span className="text-gray-600">コード:</span> <span className="ml-2">{team?.teamCode || '-'}</span></p>
              <p><span className="text-gray-600">時間帯:</span> <span className="ml-2">{
                team?.timeSlot === 'morning' ? '午前' :
                team?.timeSlot === 'afternoon' ? '午後' :
                team?.timeSlot === 'both' || team?.timeSlot === 'all' ? '全日' :
                team?.timeSlot === 'pr' ? 'PR配布日' :
                team?.timeSlot === 'other' ? 'その他' : '-'
              }</span></p>
              <p><span className="text-gray-600">担当区域:</span> <span className="ml-2">{team?.assignedArea || '-'}</span></p>
              <p><span className="text-gray-600">周辺区域:</span> <span className="ml-2">{Array.isArray(team?.adjacentAreas) ? team?.adjacentAreas.join(', ') : '-'}</span></p>
              <p><span className="text-gray-600">アクセス可能日:</span> <span className="ml-2">{
                (() => {
                  try {
                    if (!team?.validDate) return '-';
                    const v = team.validDate as unknown;
                    let date: Date | null = null;
                    if (
                      typeof v === 'object' && v !== null && '_seconds' in v &&
                      typeof (v as any)._seconds === 'number'
                    ) {
                      date = new Date((v as any)._seconds * 1000);
                    } else if (
                      typeof v === 'object' && v !== null && 'toDate' in v &&
                      typeof (v as any).toDate === 'function'
                    ) {
                      date = (v as any).toDate();
                    } else {
                      date = new Date(v as any);
                    }
                    return date && !isNaN(date.getTime()) ? date.toLocaleDateString('ja-JP') : '-';
                  } catch {
                    return '-';
                  }
                })()
              }</span></p>
              <div className="pt-2">
                <button onClick={() => setIsBasicEditOpen(true)} className="px-3 py-1 border rounded-md">編集</button>
              </div>
            </div>
          )}
        </div>

        {/* 割り当てメンバー */}
        <div className="bg-white p-6 rounded-lg shadow lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium">割り当てメンバー</h2>
            <span className="text-sm text-gray-500">{assignedMembers.length} 名</span>
          </div>
          {memberLoading ? (
            <p className="text-sm text-gray-500">読み込み中...</p>
          ) : assignedMembers.length === 0 ? (
            <p className="text-sm text-gray-500">現在このチームに割り当てられたメンバーはありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学年</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">セクション</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間帯</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {assignedMembers
                    .slice()
                    .sort((a, b) => {
                      if ((b.grade || 0) !== (a.grade || 0)) return (b.grade || 0) - (a.grade || 0);
                      return new Intl.Collator('ja').compare(a.name || '', b.name || '');
                    })
                    .map(m => (
                      <tr key={m.responseId}>
                        <td className="px-6 py-3 text-sm text-gray-900">{m.name}</td>
                        <td className="px-6 py-3 text-sm text-gray-900">{m.grade ? `${m.grade}年` : '-'}</td>
                        <td className="px-6 py-3 text-sm text-gray-900">{m.section}</td>
                        <td className="px-6 py-3 text-sm">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            m.timeSlot === 'morning' ? 'bg-yellow-100 text-yellow-800' : 
                            m.timeSlot === 'afternoon' ? 'bg-purple-100 text-purple-800' : 
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {m.timeSlot === 'morning' ? '午前' : m.timeSlot === 'afternoon' ? '午後' : 'PR配布'}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
