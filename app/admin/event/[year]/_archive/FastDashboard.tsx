'use client';

import { useEffect, useState } from 'react';
import { useFastDashboard, preloadDashboard } from '@/lib/hooks/useFastDashboard';
import { useTeamRealtimeUpdates } from '@/lib/hooks/useRealtimeData';

interface FastDashboardProps {
  year: number;
  isAdmin: boolean;
}

export default function FastDashboard({ year, isAdmin }: FastDashboardProps) {
  const [showPerformanceStats, setShowPerformanceStats] = useState(false);
  
  // 高速ダッシュボードデータ取得
  const { 
    data, 
    error, 
    loadingStage, 
    isSlowLoading,
    mutate 
  } = useFastDashboard(year, isAdmin);
  
  // リアルタイム更新
  useTeamRealtimeUpdates(year, isAdmin);
  
  // 隣接年度のプリロード
  useEffect(() => {
    if (isAdmin && year) {
      // 前年・来年のデータを事前読み込み
      setTimeout(() => {
        preloadDashboard(year - 1);
        preloadDashboard(year + 1);
      }, 1000);
    }
  }, [year, isAdmin]);
  
  if (error) {
    return (
      <div className="bg-red-50 border-l-4 border-red-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <div className="h-5 w-5 text-red-400">⚠️</div>
          </div>
          <div className="ml-3">
            <p className="text-sm text-red-700">
              データの読み込みに失敗しました
            </p>
            <button 
              onClick={() => mutate()}
              className="mt-2 text-sm text-red-700 underline hover:text-red-900"
            >
              再試行
            </button>
          </div>
        </div>
      </div>
    );
  }
  
  if (loadingStage === 'loading') {
    return (
      <div className="space-y-6">
        {/* 高速ローディング表示 */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full mr-3"></div>
              <span className="text-gray-700">
                {isSlowLoading ? 'データが大きいため時間がかかっています...' : 'データを読み込み中...'}
              </span>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <div className="text-xs text-gray-500">
                Stage: {loadingStage}
              </div>
            )}
          </div>
          
          {/* プログレスバー風演出 */}
          <div className="mt-3 w-full bg-gray-200 rounded-full h-1">
            <div className="bg-blue-600 h-1 rounded-full animate-pulse" style={{ width: '70%' }}></div>
          </div>
        </div>
      </div>
    );
  }
  
  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        データがありません
      </div>
    );
  }
  
  return (
    <div className="space-y-6">
      {/* パフォーマンス統計（開発時のみ） */}
      {process.env.NODE_ENV === 'development' && data.performance && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <button 
            onClick={() => setShowPerformanceStats(!showPerformanceStats)}
            className="text-sm text-green-800 font-medium flex items-center w-full justify-between"
          >
            <span>🚀 高速化統計</span>
            <span>{showPerformanceStats ? '▼' : '▶'}</span>
          </button>
          
          {showPerformanceStats && (
            <div className="mt-2 text-xs text-green-700 space-y-1">
              <div>API応答時間: {data.performance.responseTime}ms</div>
              <div>データ更新: {new Date(data.performance.dataFreshnessTime).toLocaleTimeString('ja-JP')}</div>
              <div>チーム数: {data.stats?.totalTeams || 0}</div>
              <div>メンバー数: {data.stats?.totalMembers || 0}</div>
            </div>
          )}
        </div>
      )}
      
      {/* イベント情報カード */}
      {data.event && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {data.event.eventName || `${year}年度イベント`}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                配布期間: {(() => {
                  try {
                    const start = data.event.distributionStartDate ? 
                      new Date(data.event.distributionStartDate).toLocaleDateString('ja-JP') : '';
                    const end = data.event.distributionEndDate ? 
                      new Date(data.event.distributionEndDate).toLocaleDateString('ja-JP') : '';
                    if (start && end && start !== end) return `${start} 〜 ${end}`;
                    return start || end || '未設定';
                  } catch {
                    return '未設定';
                  }
                })()}
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* 統計サマリー */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">👥</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    総チーム数
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {data.stats?.totalTeams || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">🎓</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    総メンバー数
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {data.stats?.totalMembers || 0}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
        
        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl">📍</div>
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    エリア数
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {Object.keys(data.stats?.byArea || {}).length}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* チーム一覧（簡略版） */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 border-b border-gray-200">
          <h3 className="text-lg leading-6 font-medium text-gray-900">
            チーム一覧
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
                  エリア
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  メンバー数
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  アクセス期間
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.sortedTeams.slice(0, 10).map((team) => (
                <tr key={team.teamId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {team.teamCode}
                    </div>
                    <div className="text-sm text-gray-500">
                      {team.teamName}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {team.assignedArea}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {team.memberCount || 0}人
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(() => {
                      try {
                        const parseDate = (dateStr: string | undefined) => 
                          dateStr ? new Date(dateStr).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }) : '';
                        const start = parseDate((team as Record<string, unknown>).validStartDate as string || (team as Record<string, unknown>).validDate as string);
                        const end = parseDate((team as Record<string, unknown>).validEndDate as string || (team as Record<string, unknown>).validDate as string);
                        if (start && end && start !== end) return `${start}〜${end}`;
                        return start || '-';
                      } catch {
                        return '-';
                      }
                    })()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {data.sortedTeams.length > 10 && (
            <div className="bg-gray-50 px-6 py-3 text-center text-sm text-gray-500">
              他 {data.sortedTeams.length - 10} チーム
            </div>
          )}
        </div>
      </div>
    </div>
  );
}