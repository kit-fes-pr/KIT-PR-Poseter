'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { YearlyStats } from '@/types';

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

export default function ReportsPage() {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState<string>('');
  const [startYear, setStartYear] = useState<string>('2020');
  const [endYear, setEndYear] = useState<string>(new Date().getFullYear().toString());
  const [reportType, setReportType] = useState<'single' | 'comparative'>('single');

  const { data: statsData } = useSWR(
    reportType === 'single' && selectedYear
      ? `/api/admin/yearly-stats?year=${selectedYear}`
      : reportType === 'comparative'
      ? `/api/admin/yearly-stats?startYear=${startYear}&endYear=${endYear}`
      : null,
    fetcher
  );

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/admin');
    }
  }, [router]);

  const stats: YearlyStats | YearlyStats[] | null = statsData?.stats || null;

  const exportReport = async () => {
    if (!stats) return;

    try {
      const reportData = {
        type: reportType,
        data: stats,
        generatedAt: new Date().toISOString(),
        parameters: reportType === 'single' 
          ? { year: selectedYear }
          : { startYear, endYear }
      };

      const blob = new Blob([JSON.stringify(reportData, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `distribution-report-${reportType}-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      alert('レポートがエクスポートされました');
    } catch (error) {
      alert('エクスポートに失敗しました');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">統計・レポート</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/admin/history')}
                className="px-4 py-2 bg-green-600 text-white rounded-md text-sm"
              >
                配布履歴
              </button>
              <button
                onClick={() => router.push('/admin/dashboard')}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm"
              >
                ← ダッシュボードに戻る
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* レポート設定 */}
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">レポート設定</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                レポートタイプ
              </label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as 'single' | 'comparative')}
                className="w-full border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="single">単年度詳細レポート</option>
                <option value="comparative">複数年度比較レポート</option>
              </select>
            </div>

            {reportType === 'single' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  対象年度
                </label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(e.target.value)}
                  placeholder="例: 2025"
                  className="w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    開始年度
                  </label>
                  <input
                    type="number"
                    value={startYear}
                    onChange={(e) => setStartYear(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    終了年度
                  </label>
                  <input
                    type="number"
                    value={endYear}
                    onChange={(e) => setEndYear(e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="mt-4">
            <button
              onClick={exportReport}
              disabled={!stats}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50"
            >
              レポートをエクスポート
            </button>
          </div>
        </div>

        {/* レポート表示 */}
        {stats && (
          <div className="bg-white shadow rounded-lg">
            {reportType === 'single' && !Array.isArray(stats) ? (
              /* 単年度詳細レポート */
              <div className="p-6">
                <div className="border-b border-gray-200 pb-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    {stats.eventName} - {stats.year}年度 詳細レポート
                  </h3>
                </div>

                {/* 基本統計 */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900">総店舗数</h4>
                    <p className="text-2xl font-bold text-blue-600">{stats.totalStores}</p>
                  </div>
                  <div className="bg-green-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900">チーム数</h4>
                    <p className="text-2xl font-bold text-green-600">{stats.totalTeams}</p>
                  </div>
                  <div className="bg-purple-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900">参加者数</h4>
                    <p className="text-2xl font-bold text-purple-600">{stats.totalMembers}</p>
                  </div>
                  <div className="bg-indigo-50 p-4 rounded-lg">
                    <h4 className="font-medium text-gray-900">平均完了率</h4>
                    <p className="text-2xl font-bold text-indigo-600">
                      {stats.averageCompletionRate.toFixed(1)}%
                    </p>
                  </div>
                </div>

                {/* 最優秀チーム */}
                <div className="bg-yellow-50 p-6 rounded-lg mb-8">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">🏆 最優秀チーム</h4>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xl font-bold text-yellow-800">
                        {stats.bestPerformingTeam.teamName}
                      </p>
                      <p className="text-sm text-yellow-700">
                        ({stats.bestPerformingTeam.teamCode})
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-yellow-800">
                        {stats.bestPerformingTeam.completionRate.toFixed(1)}%
                      </p>
                      <p className="text-sm text-yellow-700">完了率</p>
                    </div>
                  </div>
                </div>

                {/* 配布推移 */}
                <div>
                  <h4 className="text-lg font-medium text-gray-900 mb-4">配布推移</h4>
                  <div className="space-y-2">
                    {stats.distributionTrends.map((trend, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                        <span className="text-sm text-gray-600">
                          {new Date(trend.date).toLocaleDateString('ja-JP')}
                        </span>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ 
                                width: `${(trend.completedStores / trend.totalStores) * 100}%` 
                              }}
                            ></div>
                          </div>
                          <span className="text-sm font-medium">
                            {trend.completedStores} / {trend.totalStores}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : Array.isArray(stats) ? (
              /* 複数年度比較レポート */
              <div className="p-6">
                <div className="border-b border-gray-200 pb-4 mb-6">
                  <h3 className="text-lg font-medium text-gray-900">
                    年度別比較レポート ({startYear} - {endYear}年度)
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          年度
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          イベント名
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          配布日
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          店舗数
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          完了率
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          チーム数
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          参加者数
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {stats.map((yearStats: any) => (
                        <tr key={yearStats.year}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                            {yearStats.year}年度
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {yearStats.eventName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {new Date(yearStats.distributionDate).toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {yearStats.completedStores} / {yearStats.totalStores}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                                <div
                                  className="bg-indigo-600 h-2 rounded-full"
                                  style={{ width: `${yearStats.completionRate}%` }}
                                ></div>
                              </div>
                              <span className="text-sm text-gray-900">
                                {yearStats.completionRate.toFixed(1)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {yearStats.totalTeams}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {yearStats.totalMembers}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* 年度比較チャート的な表示 */}
                <div className="mt-8">
                  <h4 className="text-lg font-medium text-gray-900 mb-4">完了率推移</h4>
                  <div className="space-y-4">
                    {stats.map((yearStats: any) => (
                      <div key={yearStats.year} className="flex items-center space-x-4">
                        <div className="w-20 text-sm font-medium text-gray-900">
                          {yearStats.year}年
                        </div>
                        <div className="flex-1 bg-gray-200 rounded-full h-4">
                          <div
                            className="bg-gradient-to-r from-indigo-500 to-purple-500 h-4 rounded-full flex items-center justify-end pr-2"
                            style={{ width: `${yearStats.completionRate}%` }}
                          >
                            <span className="text-xs text-white font-medium">
                              {yearStats.completionRate.toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}

        {!stats && (reportType === 'single' ? selectedYear : startYear && endYear) && (
          <div className="bg-white p-12 rounded-lg shadow text-center">
            <p className="text-gray-500">該当する期間のデータが見つかりません。</p>
          </div>
        )}
      </div>
    </div>
  );
}