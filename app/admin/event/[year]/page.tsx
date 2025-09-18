'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('認証が必要です');
  return res.json();
};

export default function AdminEventYear() {
  const router = useRouter();
  const params = useParams<{ year: string }>();
  const yearParam = params?.year;
  const y = yearParam ? parseInt(yearParam) : NaN;
  const [isAdmin, setIsAdmin] = useState(false);
  const [event, setEvent] = useState<any | null>(null);
  const [eventLoading, setEventLoading] = useState(true);
  const [teamForm, setTeamForm] = useState({ teamCode: '', teamName: '', timeSlot: 'morning', assignedArea: '', adjacentAreas: '' });
  const [editAccessTeam, setEditAccessTeam] = useState<{ teamId: string; teamName: string; current?: string } | null>(null);
  const [editAccessDate, setEditAccessDate] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<{ eventName: string; distributionDate: string }>({ eventName: '', distributionDate: '' });

  // Close popup menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest('[data-menu-root]')) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDown as any);
    return () => document.removeEventListener('mousedown', onDown as any);
  }, [menuOpen]);

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return router.push('/admin');
      try {
        const v = await fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } });
        if (!v.ok) throw new Error('unauthorized');
        const data = await v.json();
        if (!data?.user?.isAdmin) throw new Error('forbidden');
        setIsAdmin(true);
        if (!Number.isFinite(y)) return;
        const ev = await fetcher(`/api/admin/events?year=${y}`);
        setEvent(ev.data || null);
        if (ev?.data) {
          const d = ev.data.distributionDate ? (ev.data.distributionDate._seconds ? new Date(ev.data.distributionDate._seconds * 1000) : new Date(ev.data.distributionDate)) : null;
          setEditForm({ eventName: ev.data.eventName || '', distributionDate: d ? d.toISOString().slice(0,10) : '' });
        }
      } catch (e) {
        localStorage.removeItem('authToken');
        router.push('/admin');
      } finally {
        setEventLoading(false);
      }
    };
    init();
  }, [router, y]);

  const { data: statsData } = useSWR(isAdmin && event ? `/api/admin/stats?year=${y}` : null, fetcher);
  const { data: currentTotals } = useSWR(isAdmin && event ? `/api/admin/current-year-total?year=${y}&includeStores=1` : null, fetcher);
  const { data: teamsData, mutate: mutateTeams } = useSWR(isAdmin && event ? `/api/admin/teams?year=${y}` : null, fetcher);

  const createTeam = async () => {
    if (!event) return;
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ...teamForm,
          adjacentAreas: teamForm.adjacentAreas.split(',').map(a => a.trim()),
          eventId: event.id,
          validDate: new Date().toISOString().split('T')[0],
        }),
      });
      if (response.ok) {
        setTeamForm({ teamCode: '', teamName: '', timeSlot: 'morning', assignedArea: '', adjacentAreas: '' });
        alert('チームが作成されました');
      } else {
        const err = await response.json();
        alert(err.error || 'チームの作成に失敗しました');
      }
    } catch {
      alert('チームの作成に失敗しました');
    }
  };

  useEffect(() => {
    if (isAdmin && Number.isFinite(y) && !eventLoading && event === null) {
      // 指定された年度が存在しない場合は一覧へ戻す
      router.replace('/admin/event');
    }
  }, [isAdmin, y, eventLoading, event, router]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">{y} 年度 管理</h1>
            </div>
            <div className="flex items-center space-x-2">
              <div className="relative" data-menu-root>
                <button className="px-3 py-2 border rounded-md text-sm" onClick={() => setMenuOpen(!menuOpen)} title="メニュー">≡</button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded shadow-md z-10">
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => { setIsEditing(true); setMenuOpen(false); }}>編集</button>
                    <button
                      className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        if (!event) return;
                        if (!confirm(`${event.year}年度のイベントを削除しますか？関連データがある場合は削除できません。`)) return;
                        try {
                          const token = localStorage.getItem('authToken');
                          const res = await fetch('/api/admin/events', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: event.id }) });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || '削除に失敗しました');
                          router.replace('/admin/event');
                        } catch (e: any) {
                          alert(e.message || '削除に失敗しました');
                        }
                      }}
                    >削除</button>
                  </div>
                )}
              </div>
              <button onClick={() => router.push('/admin/event')} className="px-3 py-2 border rounded-md text-sm">年度一覧</button>
              <button
                onClick={() => {
                  localStorage.removeItem('authToken');
                  router.push('/admin');
                }}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
                title="ログアウト"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M13 3a1 1 0 011 1v4a1 1 0 11-2 0V5H7a1 1 0 00-1 1v12a1 1 0 001 1h5v-3a1 1 0 112 0v4a1 1 0 01-1 1H7a3 3 0 01-3-3V6a3 3 0 013-3h6z" />
                  <path d="M16.293 8.293a1 1 0 011.414 0L21 11.586a2 2 0 010 2.828l-3.293 3.293a1 1 0 11-1.414-1.414L17.586 14H11a1 1 0 110-2h6.586l-1.293-1.293a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">総店舗数</h3>
            <p className="text-3xl font-bold text-gray-900">{statsData?.overall?.totalStores || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">配布済み</h3>
            <p className="text-3xl font-bold text-green-600">{statsData?.overall?.completedStores || 0}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">配布不可</h3>
            <p className="text-3xl font-bold text-red-600">{statsData?.overall?.failedStores || 0}</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">チーム別進捗（{y} 年度）</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">チーム</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">担当区域</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布店舗数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布済み</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布不可</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布枚数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">アクセス日</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statsData?.teamStats?.map((team: any) => (
                  <tr key={team.teamId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{team.teamName}</div>
                      <div className="text-sm text-gray-500">{team.teamCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.assignedArea}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.completedStores}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.completedStores}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.failedStores}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.distributedCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {(() => {
                        const t = (teamsData?.teams || []).find((tt: any) => tt.teamId === team.teamId);
                        const d = t?.validDate ? (t.validDate._seconds ? new Date(t.validDate._seconds * 1000) : new Date(t.validDate)) : null;
                        const disp = d ? d.toISOString().slice(0,10) : '-';
                        return (
                          <span className="inline-flex items-center gap-2">
                            <span>{disp}</span>
                            <button
                              className="px-2 py-1 border rounded text-xs"
                              onClick={() => {
                                setEditAccessTeam({ teamId: team.teamId, teamName: team.teamName, current: disp !== '-' ? disp : '' });
                                setEditAccessDate(disp !== '-' ? disp : '');
                              }}
                            >変更</button>
                          </span>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <h3 className="text-lg leading-6 font-medium text-gray-900">{y} 年度 総店舗履歴</h3>
              <span className="text-sm text-gray-500">最終更新: {currentTotals?.data?.updatedAt ? new Date(currentTotals.data.updatedAt).toLocaleString('ja-JP') : '-'}</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">店舗名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">住所</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ステータス</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布枚数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布チーム名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">備考</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(currentTotals?.stores || []).map((s: any) => (
                  <tr key={s.storeId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.storeName}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{s.address}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${s.distributionStatus === 'completed' ? 'bg-green-100 text-green-800' : s.distributionStatus === 'failed' ? 'bg-red-100 text-red-800' : s.distributionStatus === 'revisit' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'}`}>
                        {s.distributionStatus === 'completed' ? '配布済み' : s.distributionStatus === 'failed' ? '配布不可' : s.distributionStatus === 'revisit' ? '要再訪問' : '未配布'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.distributedCount || 0}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {s.distributedByName ? `${s.distributedByName}（${s.distributedBy}）` : s.distributedBy ? s.distributedBy : (s.assignedTeams && s.assignedTeams.length > 0 ? s.assignedTeams.join(', ') : '-')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[20rem] truncate" title={s.notes || ''}>{s.notes || ''}</td>
                  </tr>
                ))}
                {(currentTotals?.stores || []).length === 0 && (
                  <tr><td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-400">データがありません</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg mt-6 p-6">
          <h3 className="text-lg font-medium mb-4">チーム作成</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">チームコード</label>
              <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={teamForm.teamCode} onChange={(e) => setTeamForm({ ...teamForm, teamCode: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">チーム名</label>
              <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={teamForm.teamName} onChange={(e) => setTeamForm({ ...teamForm, teamName: e.target.value })} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">時間帯</label>
              <select className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={teamForm.timeSlot} onChange={(e) => setTeamForm({ ...teamForm, timeSlot: e.target.value })}>
                <option value="morning">午前</option>
                <option value="afternoon">午後</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">担当区域</label>
              <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={teamForm.assignedArea} onChange={(e) => setTeamForm({ ...teamForm, assignedArea: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700">周辺区域（カンマ区切り）</label>
              <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={teamForm.adjacentAreas} onChange={(e) => setTeamForm({ ...teamForm, adjacentAreas: e.target.value })} />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <button onClick={createTeam} className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm">作成</button>
          </div>
        </div>
      </div>

      {isEditing && event && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">イベントを編集（{event.year}年度）</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">イベント名</label>
                <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={editForm.eventName} onChange={(e) => setEditForm({ ...editForm, eventName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">配布日</label>
                <input type="date" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={editForm.distributionDate} onChange={(e) => setEditForm({ ...editForm, distributionDate: e.target.value })} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">キャンセル</button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken');
                    const res = await fetch('/api/admin/events', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: event.id, eventName: editForm.eventName, distributionDate: editForm.distributionDate }) });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '更新に失敗しました');
                    setEvent(data.data);
                    setIsEditing(false);
                  } catch (e: any) {
                    alert(e.message || '更新に失敗しました');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
              >保存</button>
            </div>
          </div>
        </div>
      )}

      {editAccessTeam && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">アクセス可能日を変更（{editAccessTeam.teamName}）</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700">配布日（アクセス可能日）</label>
              <input type="date" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={editAccessDate} onChange={(e) => setEditAccessDate(e.target.value)} />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setEditAccessTeam(null)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">キャンセル</button>
              <button
                className="px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
                disabled={!editAccessDate}
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken');
                    const res = await fetch('/api/admin/teams', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ teamId: editAccessTeam.teamId, validDate: editAccessDate }) });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '更新に失敗しました');
                    await mutateTeams();
                    setEditAccessTeam(null);
                  } catch (e: any) {
                    alert(e.message || '更新に失敗しました');
                  }
                }}
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
