'use client';

import { useEffect, useState } from 'react';
import { useFastDashboard } from '@/lib/hooks/useFastDashboard';
import { useFastPageTransition } from '@/lib/hooks/usePageTransition';
import { DashboardSkeleton, FastLoadingIndicator, InlineLoader } from '@/components/ui/SkeletonLoader';
import { FastNavButton } from '@/lib/hooks/useFastNavigation';

interface SuperFastDashboardProps {
  year: number;
  isAdmin: boolean;
}

export default function SuperFastDashboard({ year, isAdmin }: SuperFastDashboardProps) {
  const [showDetailedView, setShowDetailedView] = useState(false);
  const [optimisticUpdate, setOptimisticUpdate] = useState(false);
  
  const { navigateWithPreload, isNavigating } = useFastPageTransition();
  
  // 高速ダッシュボードデータ取得
  const { 
    data, 
    error, 
    loadingStage, 
    isSlowLoading,
    mutate 
  } = useFastDashboard(year, isAdmin);

  // 最初のマウント時に楽観的UI表示
  useEffect(() => {
    if (isAdmin && !data && !error) {
      setOptimisticUpdate(true);
      const timer = setTimeout(() => setOptimisticUpdate(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [isAdmin, data, error]);

  // 全画面遷移ローダー
  if (isNavigating) {
    return <FastLoadingIndicator message="ページを準備中..." />;
  }

  // エラー状態（改善されたエラーUI）
  if (error && !data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <div className="text-red-500 text-4xl mb-4">⚠️</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            データの読み込みに失敗しました
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            ネットワーク接続を確認してください
          </p>
          <div className="flex space-x-3 justify-center">
            <button 
              onClick={() => mutate()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              再読み込み
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 transition-colors"
            >
              ページをリロード
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ローディング状態（スケルトンUI）
  if ((loadingStage === 'loading' && !data) || optimisticUpdate) {
    return (
      <div className="relative">
        <DashboardSkeleton />
        {isSlowLoading && (
          <div className="fixed top-4 right-4 z-50">
            <div className="bg-orange-100 border border-orange-400 text-orange-700 px-4 py-2 rounded-md shadow-lg">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-orange-600 border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">大量データを処理中...</span>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // データなし状態
  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📊</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">
            {year}年度のデータがありません
          </h2>
          <p className="text-gray-500">
            イベントを作成してください
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ナビゲーションバー（高速化） */}
      <nav className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {year} 年度管理
                {data.performance && (
                  <span className="ml-2 text-xs text-green-600">
                    ({data.performance.responseTime}ms)
                  </span>
                )}
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* 高速ナビゲーションボタン */}
              <FastNavButton
                href="/admin/event"
                className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                年度一覧
              </FastNavButton>
              
              <FastNavButton
                href={`/admin/event/${year}/team`}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                チーム管理
              </FastNavButton>
              
              <FastNavButton
                href={`/admin/event/${year}/form`}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                フォーム管理
              </FastNavButton>
              
              <FastNavButton
                href={`/admin/event/${year}/members`}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm hover:bg-gray-50 transition-colors"
              >
                メンバー管理
              </FastNavButton>
            </div>
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
          {/* パフォーマンス統計（開発環境のみ） */}
          {process.env.NODE_ENV === 'development' && data.performance && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm text-green-800">
                  <span>🚀 API: {data.performance.responseTime}ms</span>
                  <span>📊 チーム: {data.stats?.totalTeams || 0}</span>
                  <span>👥 メンバー: {data.stats?.totalMembers || 0}</span>
                  <span>🕐 {new Date(data.performance.dataFreshnessTime).toLocaleTimeString('ja-JP')}</span>
                </div>
                <button
                  onClick={() => mutate()}
                  className="text-xs text-green-600 hover:text-green-800"
                >
                  更新
                </button>
              </div>
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
                <div className="flex space-x-2">
                  <button
                    onClick={() => setShowDetailedView(!showDetailedView)}
                    className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    {showDetailedView ? '簡単表示' : '詳細表示'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 統計サマリー（アニメーション付き） */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: '総チーム数', value: data.stats?.totalTeams || 0, icon: '👥', color: 'blue' },
              { label: '総メンバー数', value: data.stats?.totalMembers || 0, icon: '🎓', color: 'green' },
              { label: 'エリア数', value: Object.keys(data.stats?.byArea || {}).length, icon: '📍', color: 'purple' }
            ].map((stat, index) => (
              <div key={stat.label} className="bg-white overflow-hidden shadow rounded-lg transform transition-all hover:scale-105" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="p-5">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-2xl">{stat.icon}</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {stat.label}
                        </dt>
                        <dd className={`text-lg font-medium text-${stat.color}-600`}>
                          <span className="animate-pulse">{stat.value}</span>
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* チーム一覧（最適化版） */}
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                チーム一覧 ({data.sortedTeams?.length || 0}件)
              </h3>
              {loadingStage === 'loading' && (
                <InlineLoader size="sm" message="更新中" />
              )}
            </div>
            
            {data.sortedTeams?.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-2">📋</div>
                チームが登録されていません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      {['チーム', 'エリア', 'メンバー数', 'アクセス期間'].map(header => (
                        <th key={header} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {(data.sortedTeams || []).slice(0, showDetailedView ? undefined : 10).map((team, index) => (
                      <tr 
                        key={team.teamId} 
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigateWithPreload(`/admin/event/${year}/team/${team.teamId}`)}
                        style={{ animationDelay: `${index * 50}ms` }}
                      >
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {team.memberCount || 0}人
                          </span>
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
                
                {!showDetailedView && (data.sortedTeams || []).length > 10 && (
                  <div className="bg-gray-50 px-6 py-3 text-center">
                    <button
                      onClick={() => setShowDetailedView(true)}
                      className="text-sm text-blue-600 hover:text-blue-800"
                    >
                      他 {(data.sortedTeams || []).length - 10} チームを表示
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}