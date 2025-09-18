'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';

const fetcher = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('認証が必要です');
  return response.json();
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [ctStatus, setCtStatus] = useState<'all' | 'pending' | 'completed' | 'failed' | 'revisit'>('all');
  const [ctQuery, setCtQuery] = useState('');
  const [teamForm, setTeamForm] = useState({
    teamCode: '',
    teamName: '',
    timeSlot: 'morning',
    assignedArea: '',
    adjacentAreas: '',
  });

  const { data: statsData } = useSWR(isAdmin ? '/api/admin/stats' : null, fetcher);
  const { data: currentTotals } = useSWR(
    isAdmin ? '/api/admin/current-year-total?eventId=kohdai2025&includeStores=1' : null,
    fetcher
  );

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('authToken');
      console.log('Checking auth token:', token ? token.substring(0, 50) + '...' : 'No token');
      
      if (!token) {
        console.log('No token found, redirecting to admin login');
        router.push('/admin');
        return;
      }

      // トークンの有効性を確認
      try {
        const response = await fetch('/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        
        if (!response.ok) {
          console.log('Token verification failed, redirecting to admin login');
          localStorage.removeItem('authToken');
          router.push('/admin');
        } else {
          const data = await response.json();
          if (!data?.user?.isAdmin) {
            console.log('Not an admin user, redirecting to admin login');
            localStorage.removeItem('authToken');
            router.push('/admin');
            return;
          }
          console.log('Token verification successful as admin');
          setIsAdmin(true);
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    };

    checkAuth();
  }, [router]);

  const archiveCurrentData = async () => {
    if (!confirm('現在のデータをアーカイブしますか？この操作は元に戻せません。')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          eventId: 'kohdai2025'
        }),
      });

      if (response.ok) {
        alert('データのアーカイブが完了しました');
      } else {
        const error = await response.json();
        alert(error.error || 'アーカイブに失敗しました');
      }
    } catch {
      alert('アーカイブに失敗しました');
    }
  };

  const createTeam = async () => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...teamForm,
          adjacentAreas: teamForm.adjacentAreas.split(',').map(area => area.trim()),
          eventId: 'kohdai2025',
          validDate: new Date().toISOString().split('T')[0], // Today
        }),
      });

      if (response.ok) {
        setIsCreatingTeam(false);
        setTeamForm({
          teamCode: '',
          teamName: '',
          timeSlot: 'morning',
          assignedArea: '',
          adjacentAreas: '',
        });
        alert('チームが作成されました');
      } else {
        const error = await response.json();
        alert(error.error || 'チームの作成に失敗しました');
      }
    } catch {
      alert('チームの作成に失敗しました');
    }
  };

  const updateCurrentYearTotals = async () => {
    if (!confirm('今年度総店舗履歴を更新しますか？')) return;
    try {
      const token = localStorage.getItem('authToken');
      const res = await fetch('/api/admin/current-year-total', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ eventId: 'kohdai2025' }),
      });
      if (res.ok) {
        alert('今年度総店舗履歴を更新しました');
      } else {
        const err = await res.json();
        alert(err.error || '更新に失敗しました');
      }
    } catch (e) {
      alert('更新に失敗しました');
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">管理者ダッシュボード</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsCreatingTeam(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm"
              >
                チーム作成
              </button>
              <button
                onClick={() => router.push('/admin/history')}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm"
              >
                配布履歴
              </button>
              <button
                onClick={() => router.push('/admin/reports')}
                className="px-4 py-2 bg-purple-600 text-white rounded-md text-sm"
              >
                統計・レポート
              </button>
              <button
                onClick={archiveCurrentData}
                className="px-4 py-2 bg-orange-600 text-white rounded-md text-sm"
              >
                データアーカイブ
              </button>
              <button
                onClick={updateCurrentYearTotals}
                className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm"
              >
                今年度総店舗履歴を更新
              </button>
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
        {/* 全体統計 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">総店舗数</h3>
            <p className="text-3xl font-bold text-gray-900">
              {statsData?.overall?.totalStores || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">配布済み</h3>
            <p className="text-3xl font-bold text-green-600">
              {statsData?.overall?.completedStores || 0}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">配布不可</h3>
            <p className="text-3xl font-bold text-red-600">
              {statsData?.overall?.failedStores || 0}
            </p>
          </div>
          {null}
        </div>

        {/* チーム別統計 */}
        <div className="bg-white shadow rounded-lg mb-6">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              チーム別進捗
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    チーム
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    担当区域
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    配布店舗数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布済み</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布不可</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布枚数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    詳細
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statsData?.teamStats?.map((team: { teamId: string; teamName: string; teamCode: string; assignedArea: string; totalStores: number; completedStores: number; failedStores: number; distributedCount: number; completionRate: number }) => (
                  <tr key={team.teamId}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {team.teamName}
                        </div>
                        <div className="text-sm text-gray-500">
                          {team.teamCode}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {team.assignedArea}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {team.completedStores}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.completedStores}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.failedStores}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.distributedCount}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-indigo-600">
                      <button
                        onClick={() => router.push(`/admin/teams/${team.teamId}`)}
                        className="px-3 py-1 border border-indigo-200 rounded hover:bg-indigo-50"
                      >
                        詳細
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 今年度総店舗履歴（一覧表） */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div className="flex items-center gap-3">
                <h3 className="text-lg leading-6 font-medium text-gray-900">今年度総店舗履歴</h3>
                <span className="text-sm text-gray-500">
                  最終更新: {currentTotals?.data?.updatedAt ? new Date(currentTotals.data.updatedAt).toLocaleString('ja-JP') : '-'}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={ctStatus}
                  onChange={(e) => setCtStatus(e.target.value as any)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="all">すべて</option>
                  <option value="pending">未配布</option>
                  <option value="completed">配布済み</option>
                  <option value="failed">配布不可</option>
                  <option value="revisit">要再訪問</option>
                </select>
                <input
                  type="text"
                  value={ctQuery}
                  onChange={(e) => setCtQuery(e.target.value)}
                  placeholder="店名・住所で検索"
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            {(() => {
              const stores = ((currentTotals?.stores || []) as any[])
                .filter(s => ctStatus === 'all' || s.distributionStatus === ctStatus)
                .filter(s => {
                  const q = ctQuery.trim().toLowerCase();
                  if (!q) return true;
                  return (
                    (s.storeName || '').toLowerCase().includes(q) ||
                    (s.address || '').toLowerCase().includes(q)
                  );
                })
                .sort((a, b) => {
                  const aKana = (a.storeNameKana || a.storeName || '').toString();
                  const bKana = (b.storeNameKana || b.storeName || '').toString();
                  return aKana.localeCompare(bKana, 'ja');
                });

              const teamsByCode = (currentTotals?.teamsByCode || {}) as Record<string, string>;
              const teamLabel = (code?: string) => {
                if (!code) return '-';
                const name = teamsByCode[code];
                return name ? `${name}（${code}）` : code;
              };

              const statusText = (st: string) => st === 'completed' ? '配布済み' : st === 'failed' ? '配布不可' : st === 'revisit' ? '要再訪問' : '未配布';
              const statusClass = (st: string) => st === 'completed' ? 'bg-green-100 text-green-800' : st === 'failed' ? 'bg-red-100 text-red-800' : st === 'revisit' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800';

              return (
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
                    {stores.map((s: any) => (
                      <tr key={s.storeId}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.storeName}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{s.address}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <span className={`inline-block px-2 py-1 text-xs rounded-full ${statusClass(s.distributionStatus)}`}>
                            {statusText(s.distributionStatus)}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{s.distributedCount || 0}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                          {s.distributedByName
                            ? `${s.distributedByName}（${s.distributedBy}）`
                            : s.distributedBy
                              ? (teamsByCode[s.distributedBy]
                                  ? `${teamsByCode[s.distributedBy]}（${s.distributedBy}）`
                                  : s.distributedBy)
                              : (s.assignedTeams && s.assignedTeams.length > 0
                                  ? s.assignedTeams.join(', ')
                                  : '-')}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-[20rem] truncate" title={s.notes || ''}>{s.notes || ''}</td>
                      </tr>
                    ))}
                    {stores.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-400">データがありません</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      </div>

      {/* チーム作成モーダル */}
      {isCreatingTeam && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-medium mb-4">新しいチームを作成</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">チームコード</label>
                <input
                  type="text"
                  placeholder="例: AM1-2025"
                  value={teamForm.teamCode}
                  onChange={(e) => setTeamForm({...teamForm, teamCode: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">チーム名</label>
                <input
                  type="text"
                  placeholder="例: 午前1班"
                  value={teamForm.teamName}
                  onChange={(e) => setTeamForm({...teamForm, teamName: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">時間帯</label>
                <select
                  value={teamForm.timeSlot}
                  onChange={(e) => setTeamForm({...teamForm, timeSlot: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                >
                  <option value="morning">午前</option>
                  <option value="afternoon">午後</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">担当区域</label>
                <input
                  type="text"
                  placeholder="例: 午前1"
                  value={teamForm.assignedArea}
                  onChange={(e) => setTeamForm({...teamForm, assignedArea: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">周辺区域（カンマ区切り）</label>
                <input
                  type="text"
                  placeholder="例: 午前2, 午後1"
                  value={teamForm.adjacentAreas}
                  onChange={(e) => setTeamForm({...teamForm, adjacentAreas: e.target.value})}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={createTeam}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md"
                >
                  作成
                </button>
                <button
                  onClick={() => setIsCreatingTeam(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
