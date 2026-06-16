'use client';

import { useEffect, useState } from 'react';
import { useProgressiveData } from '@/lib/hooks/useProgressiveData';
import { useFastPageTransition } from '@/lib/hooks/usePageTransition';
import { LoadingScreen, LoadingInline } from '@/components/ui/Loading';

interface FastDashboardProps {
  year: number;
  isAdmin: boolean;
}

export default function FastDashboard({ year, isAdmin }: FastDashboardProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { navigateWithPreload } = useFastPageTransition();

  // 段階的データ読み込み
  const {
    data,
    error,
    isInitialLoading,
    isLoadingMore,
    hasMore,
    loadMore
  } = useProgressiveData(year, isAdmin);

  const teams = data?.teams || [];
  const totalPages = Math.max(1, Math.ceil(teams.length / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const startIndex = (safeCurrentPage - 1) * pageSize;
  const visibleTeams = teams.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    setCurrentPage((prev) => Math.min(Math.max(1, prev), totalPages));
  }, [totalPages]);


  // 初期読み込み中のスケルトン表示
  if (isInitialLoading || (!data && !error)) {
    return <LoadingScreen />;
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
                    <LoadingInline size="sm" />
                  )}
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
                color: 'blue',
                href: `/admin/event/${year}/team`
              },
              {
                label: '総メンバー数',
                value: data?.stats?.totalMembers || 0,
                icon: '🎓',
                color: 'green',
                href: `/admin/event/${year}/members`,
              },
              {
                label: 'エリア数',
                value: data?.stats?.totalAreas || 0,
                icon: '📍',
                color: 'purple',
                href: `/admin/event/${year}/areas`
              }
            ].map((stat, index) => (
              <div
                key={stat.label}
                role={stat.href ? 'button' : undefined}
                tabIndex={stat.href ? 0 : undefined}
                onClick={stat.href ? () => navigateWithPreload(stat.href!) : undefined}
                onKeyDown={stat.href ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigateWithPreload(stat.href!);
                  }
                } : undefined}
                className={`bg-white overflow-hidden shadow-lg rounded-xl transform transition-all border border-gray-100 ${
                  stat.href ? 'hover:scale-105 cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-500' : 'hover:scale-105'
                }`}
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
                  <LoadingInline size="sm" />
                )}
                <span className="text-sm text-gray-500">
                  {teams.length} / {data?.stats?.totalTeams || 0} 件
                </span>
              </div>
            </div>

            {teams.length === 0 ? (
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
                    {visibleTeams.map((team, index) => (
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
                              const legacyValidDate = (team as unknown as { validDate?: string }).validDate;
                              const start = parseDate(team.validStartDate || legacyValidDate);
                              const end = parseDate(team.validEndDate || legacyValidDate);
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

                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between gap-3">
                  <p className="text-sm text-gray-600">
                    {safeCurrentPage} / {totalPages} ページ
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage <= 1}
                      className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                      前へ
                    </button>
                    <button
                      onClick={() => {
                        if (hasMore && !isLoadingMore) {
                          loadMore();
                        }
                        setCurrentPage((p) => p + 1);
                      }}
                      disabled={safeCurrentPage >= totalPages && !hasMore}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                    >
                      次へ
                    </button>
                  </div>
                </div>
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
