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
  const [teamForm, setTeamForm] = useState({
    teamCode: '',
    teamName: '',
    timeSlot: 'morning',
    assignedArea: '',
    adjacentAreas: '',
  });

  const { data: statsData } = useSWR('/api/admin/stats', fetcher);

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
          console.log('Token verification successful');
        }
      } catch (error) {
        console.error('Auth verification error:', error);
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    };

    checkAuth();
  }, [router]);

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
                onClick={() => {
                  localStorage.removeItem('authToken');
                  router.push('/admin');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* 全体統計 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
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
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">完了率</h3>
            <p className="text-3xl font-bold text-indigo-600">
              {statsData?.overall?.completionRate?.toFixed(1) || 0}%
            </p>
          </div>
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
                    総店舗数
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    配布済み
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    完了率
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {statsData?.teamStats?.map((team: { teamId: string; teamName: string; teamCode: string; assignedArea: string; totalStores: number; completedStores: number; completionRate: number }) => (
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
                      {team.totalStores}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {team.completedStores}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-indigo-600 h-2 rounded-full"
                            style={{ width: `${team.completionRate}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-900">
                          {team.completionRate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* 区域別統計 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              区域別進捗
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-6">
            {statsData?.areaStats?.map((area: { areaCode: string; totalStores: number; completedStores: number; completionRate: number }) => (
              <div key={area.areaCode} className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-medium text-gray-900">{area.areaCode}</h4>
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>進捗</span>
                    <span>{area.completedStores} / {area.totalStores}</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                    <div
                      className="bg-indigo-600 h-2 rounded-full"
                      style={{ width: `${area.completionRate}%` }}
                    ></div>
                  </div>
                  <p className="text-right text-sm text-gray-600 mt-1">
                    {area.completionRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
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