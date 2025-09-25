'use client';

import { useState } from 'react';
import { useProgressiveData } from '@/lib/hooks/useProgressiveData';
import { useFastPageTransition } from '@/lib/hooks/usePageTransition';
import { FastNavButton } from '@/lib/hooks/useFastNavigation';
import { DashboardSkeleton, InlineLoader } from '@/components/ui/SkeletonLoader';

interface FastDashboardProps {
  year: number;
  isAdmin: boolean;
}

export default function FastDashboard({ year, isAdmin }: FastDashboardProps) {
  const [showDetailedView, setShowDetailedView] = useState(false);

  const { navigateWithPreload } = useFastPageTransition();

  // 段階的データ読み込み（超高速版）
  const {
    data,
    error,
    isInitialLoading,
    isLoadingMore,
    loadingProgress,
    hasMore,
    loadMore
  } = useProgressiveData(year, isAdmin);


  // 初期読み込み中のスケルトン表示
  if (isInitialLoading || (!data && !error)) {
    return (
      <div className="relative">
        <DashboardSkeleton />

        {/* 読み込み進捗オーバーレイ */}
        <div className="fixed top-4 right-4 z-50">
          <div className="bg-blue-50 border border-blue-200 text-blue-800 px-4 py-2 rounded-lg shadow-lg">
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
              <span className="text-sm font-medium">初期データ読み込み中...</span>
            </div>

          </div>
        </div>
      </div>
    );
  }

  // エラー状態
  if (error && !data) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <div className="text-red-500 text-4xl mb-4">⚡💥</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">
            高速読み込みに失敗
          </h2>
          <p className="text-sm text-gray-600 mb-4">
            サーバーの応答が遅延しています
          </p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              強制リロード
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 高速ナビゲーションバー */}
      <nav className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-4">
              <h1 className="text-xl font-semibold text-gray-900">
                {year} 年度管理
              </h1>

              {/* パフォーマンス指標 */}
              {Boolean((data as Record<string, unknown> | undefined)?.performance && typeof (data as Record<string, unknown>)?.performance === 'object' && (data as Record<string, unknown>)?.performance !== null) && (
                <div className="hidden md:flex items-center space-x-2 text-xs">
                  <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full">
                    ⚡ {String(((data as Record<string, unknown>)?.performance as Record<string, unknown>)?.responseTime) || '0'}ms
                  </span>
                  {Boolean((data as Record<string, unknown> | undefined)?.progressive && typeof (data as Record<string, unknown>)?.progressive === 'object' && ((data as Record<string, unknown>)?.progressive as Record<string, unknown>)?.isLoading) && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                      📊 {Math.round(loadingProgress)}%
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <FastNavButton
                href="/admin/event"
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-all"
              >
                年度一覧
              </FastNavButton>

              <FastNavButton
                href={`/admin/event/${year}/team`}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-all"
              >
                チーム管理
              </FastNavButton>

              <FastNavButton
                href={`/admin/event/${year}/form`}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 transition-all"
              >
                フォーム管理
              </FastNavButton>
            </div>
          </div>
        </div>
      </nav>

      {/* メインコンテンツ */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="space-y-6">

          {/* イベント情報カード */}
          {Boolean((data as Record<string, unknown> | undefined)?.event) && (
            <div className="bg-white shadow-lg rounded-xl p-6 border border-gray-100">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {String(((data as Record<string, unknown>)?.event as Record<string, unknown>)?.eventName) || `${year}年度イベント`}
                  </h2>
                  <p className="text-sm text-gray-600 mt-2">
                    配布期間: {(() => {
                      try {
                        const eventData = (data as Record<string, unknown>)?.event as Record<string, unknown>;
                        const start = eventData?.distributionStartDate ?
                          new Date(String(eventData.distributionStartDate)).toLocaleDateString('ja-JP') : '';
                        const end = eventData?.distributionEndDate ?
                          new Date(String(eventData.distributionEndDate)).toLocaleDateString('ja-JP') : '';

                        if (start && end && start !== end) return `${start} 〜 ${end}`;
                        return start || '未設定';
                      } catch {
                        return '未設定';
                      }
                    })()}
                  </p>
                </div>

                <div className="flex items-center space-x-2">
                  {isLoadingMore && (
                    <InlineLoader size="sm" message="追加読み込み中" />
                  )}
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

          {/* リアルタイム統計カード */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: '総チーム数',
                value: data?.stats?.totalTeams || 0,
                loaded: data?.stats?.loadedTeams || 0,
                icon: '👥',
                color: 'blue'
              },
              {
                label: '総メンバー数',
                value: data?.stats?.totalMembers || 0,
                icon: '🎓',
                color: 'green'
              },
              {
                label: 'エリア数',
                value: data?.stats?.totalAreas || 0,
                icon: '📍',
                color: 'purple'
              }
            ].map((stat, index) => (
              <div
                key={stat.label}
                className="bg-white overflow-hidden shadow-lg rounded-xl transform transition-all hover:scale-105 border border-gray-100"
                style={{
                  animationDelay: `${index * 100}ms`,
                  animation: 'fadeInUp 0.6s ease-out forwards'
                }}
              >
                <div className="p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <div className="text-3xl">{stat.icon}</div>
                    </div>
                    <div className="ml-5 w-0 flex-1">
                      <dl>
                        <dt className="text-sm font-medium text-gray-500 truncate">
                          {stat.label}
                        </dt>
                        <dd className={`text-2xl font-bold text-${stat.color}-600 flex items-center`}>
                          <span>{stat.value}</span>
                          {'loaded' in stat && stat.loaded !== undefined && stat.loaded < stat.value && (
                            <span className="ml-2 text-sm text-gray-400">
                              ({stat.loaded}件表示中)
                            </span>
                          )}
                        </dd>
                      </dl>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 段階的チーム一覧 */}
          <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-100">
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
              <h3 className="text-lg font-semibold text-gray-900">
                チーム一覧
              </h3>
              <div className="flex items-center space-x-3">
                {data?.progressive?.isLoading && (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm text-gray-600">追加読み込み中...</span>
                  </div>
                )}
                <span className="text-sm text-gray-500">
                  {(data?.teams || []).length} / {data?.stats?.totalTeams || 0} 件
                </span>
              </div>
            </div>

            {(data?.teams || []).length === 0 ? (
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
                    {(data?.teams || []).slice(0, showDetailedView ? undefined : 15).map((team, index) => (
                      <tr
                        key={team.teamId}
                        className="hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigateWithPreload(`/admin/event/${year}/team/${team.teamId}`)}
                        style={{
                          animationDelay: `${index * 30}ms`,
                          animation: 'slideInFromLeft 0.4s ease-out forwards'
                        }}
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
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {team.assignedArea}
                          </span>
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
                              const start = parseDate(team.validStartDate || (team as Record<string, unknown>).validDate as string);
                              const end = parseDate(team.validEndDate || (team as Record<string, unknown>).validDate as string);
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

                {/* 追加読み込みボタン */}
                {!showDetailedView && (data?.teams || []).length > 15 && (
                  <div className="bg-gray-50 px-6 py-4 text-center">
                    <button
                      onClick={() => setShowDetailedView(true)}
                      className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      他 {(data?.teams || []).length - 15} チームを表示
                    </button>
                  </div>
                )}

                {hasMore && (
                  <div className="bg-gray-50 px-6 py-4 text-center">
                    <button
                      onClick={loadMore}
                      disabled={isLoadingMore}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {isLoadingMore ? '読み込み中...' : 'さらに読み込む'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* カスタムアニメーション */}
      <style jsx global>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        @keyframes slideInFromLeft {
          from {
            opacity: 0;
            transform: translateX(-20px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  );
}