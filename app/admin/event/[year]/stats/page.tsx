'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

interface YearlyStats {
  year: number;
  eventName: string;
  totalStores: number;
  completedStores: number;
  failedStores: number;
  completionRate: number;
  totalDistributed: number;
  totalTeams: number;
  totalMembers: number;
  bestPerformingTeam: {
    teamCode: string;
    teamName: string;
    completionRate: number;
  };
  teamStats: Array<{
    teamId: string;
    teamCode: string;
    teamName: string;
    totalStores: number;
    completedStores: number;
    completionRate: number;
    distributedCount: number;
  }>;
  trends: Array<{
    date: Date;
    completedStores: number;
    cumulativeCompleted: number;
  }>;
}

const fetcher = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('認証が必要です');
  return res.json();
};

export default function YearlyStatsPage() {
  const router = useRouter();
  const params = useParams<{ year: string }>();
  const year = params?.year;
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [stats, setStats] = useState<YearlyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  // Firebase認証状態を監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetcher(`/api/admin/yearly-stats?year=${year}`);
      setStats(data.yearlyStats);
    } catch (error) {
      console.error('統計読み込みエラー:', error);
    }
  }, [year]);

  // 管理者認証とデータ読み込み
  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return router.push('/admin');
        
        const v = await fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } });
        if (!v.ok) throw new Error('unauthorized');
        const data = await v.json();
        if (!data?.user?.isAdmin) throw new Error('forbidden');
        setIsAdmin(true);

        await loadStats();
      } catch (error) {
        console.error('エラー内容:', error);
        localStorage.removeItem('authToken');
        router.push('/admin');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, year, loadStats]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('authToken');
      router.push('/admin');
    } catch (error) {
      console.error('ログアウトエラー:', error);
      localStorage.removeItem('authToken');
      router.push('/admin');
    }
  };

  const exportToCsv = () => {
    if (!stats) return;

    const csvData = [
      ['チーム統計', year + '年度'],
      ['チームコード', 'チーム名', '総店舗数', '配布済み', '完了率(%)', '配布枚数'],
      ...stats.teamStats.map(team => [
        team.teamCode,
        team.teamName,
        team.totalStores.toString(),
        team.completedStores.toString(),
        team.completionRate.toFixed(1),
        team.distributedCount.toString()
      ])
    ];

    const csv = csvData.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${year}年度統計_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">{year}年度の統計データが見つかりません</p>
          <button 
            onClick={() => router.push(`/admin/event/${year}`)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md"
          >
            イベント管理に戻る
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">{year} 年度 統計レポート</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => router.push('/admin/event')} className="px-3 py-2 border rounded-md text-sm sm:block hidden">年度一覧</button>
              <button onClick={() => router.push(`/admin/event/${year}`)} className="px-3 py-2 border rounded-md text-sm sm:block hidden">イベント管理</button>
              <button onClick={exportToCsv} className="px-3 py-2 bg-green-600 text-white rounded-md text-sm sm:block hidden">CSV出力</button>
              <div className="relative">
                <button className="px-3 py-2 border rounded-md text-sm" onClick={() => setMenuOpen(!menuOpen)}>≡</button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-md z-10">
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 sm:hidden" onClick={() => router.push('/admin/event')}>年度一覧</button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 sm:hidden" onClick={() => router.push(`/admin/event/${year}`)}>イベント管理</button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 sm:hidden" onClick={exportToCsv}>CSV出力</button>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
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
        {/* 概要統計 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900">完了率</h3>
            <p className="text-3xl font-bold text-indigo-600">{stats.completionRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">{stats.completedStores}/{stats.totalStores}店舗</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900">総配布枚数</h3>
            <p className="text-3xl font-bold text-green-600">{stats.totalDistributed.toLocaleString()}</p>
            <p className="text-sm text-gray-500">ポスター配布数</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900">参加チーム</h3>
            <p className="text-3xl font-bold text-blue-600">{stats.totalTeams}</p>
            <p className="text-sm text-gray-500">チーム数</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium text-gray-900">参加メンバー</h3>
            <p className="text-3xl font-bold text-purple-600">{stats.totalMembers}</p>
            <p className="text-sm text-gray-500">実行委員数</p>
          </div>
        </div>

        {/* 最高パフォーマンスチーム */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <h2 className="text-lg font-medium mb-4">🏆 最高パフォーマンスチーム</h2>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-yellow-800">{stats.bestPerformingTeam.teamName}</h3>
                <p className="text-yellow-700">コード: {stats.bestPerformingTeam.teamCode}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-yellow-800">{stats.bestPerformingTeam.completionRate.toFixed(1)}%</p>
                <p className="text-sm text-yellow-600">完了率</p>
              </div>
            </div>
          </div>
        </div>

        {/* チーム別パフォーマンス */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">チーム別パフォーマンス</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">順位</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">チーム</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総店舗数</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布済み</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">完了率</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">配布枚数</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stats.teamStats.map((team, index) => (
                  <tr key={team.teamId} className={index < 3 ? 'bg-yellow-50' : ''}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {index < 3 ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          {index + 1}位
                        </span>
                      ) : (
                        <span className="text-gray-500">{index + 1}位</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{team.teamName}</div>
                      <div className="text-sm text-gray-500">{team.teamCode}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.totalStores}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.completedStores}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 w-16">
                          <div className="text-sm font-medium text-gray-900">{team.completionRate.toFixed(1)}%</div>
                        </div>
                        <div className="flex-1 ml-4">
                          <div className="bg-gray-200 rounded-full h-2">
                            <div 
                              className="bg-indigo-600 h-2 rounded-full" 
                              style={{ width: `${Math.min(team.completionRate, 100)}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{team.distributedCount.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
