'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { DistributionHistory } from '@/types';

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

export default function HistoryPage() {
  const router = useRouter();
  const [selectedYear, setSelectedYear] = useState<string>('all');
  const [selectedHistory, setSelectedHistory] = useState<DistributionHistory | null>(null);

  const { data: historyData } = useSWR(
    selectedYear === 'all' 
      ? '/api/admin/history' 
      : `/api/admin/history?year=${selectedYear}`,
    fetcher
  );

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/admin');
    }
  }, [router]);

  const histories = historyData?.histories || [];
  const availableYears = [...new Set(histories.map((h: DistributionHistory) => h.year))].sort((a, b) => b - a);

  const handleViewDetails = (history: DistributionHistory) => {
    setSelectedHistory(history);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">配布履歴管理</h1>
            </div>
            <div className="flex items-center space-x-4">
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
        {/* フィルターセクション */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex items-center space-x-4">
            <label className="block text-sm font-medium text-gray-700">年度で絞り込み:</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm"
            >
              <option value="all">すべての年度</option>
              {availableYears.map(year => (
                <option key={year} value={year}>{year}年度</option>
              ))}
            </select>
          </div>
        </div>

        {selectedHistory ? (
          /* 詳細表示 */
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-gray-900">
                    {selectedHistory.eventName} - 詳細情報
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {selectedHistory.year}年度 | 
                    配布日: {new Date(selectedHistory.distributionDate).toLocaleDateString('ja-JP')}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedHistory(null)}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md text-sm"
                >
                  一覧に戻る
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* 全体統計 */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900">総店舗数</h4>
                  <p className="text-2xl font-bold text-gray-900">{selectedHistory.totalStores}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900">配布済み</h4>
                  <p className="text-2xl font-bold text-green-600">{selectedHistory.completedStores}</p>
                </div>
                <div className="bg-red-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900">配布不可</h4>
                  <p className="text-2xl font-bold text-red-600">{selectedHistory.failedStores}</p>
                </div>
                <div className="bg-indigo-50 p-4 rounded-lg">
                  <h4 className="font-medium text-gray-900">完了率</h4>
                  <p className="text-2xl font-bold text-indigo-600">
                    {selectedHistory.completionRate.toFixed(1)}%
                  </p>
                </div>
              </div>

              {/* チーム別詳細 */}
              <div className="mb-8">
                <h4 className="text-lg font-medium text-gray-900 mb-4">チーム別実績</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {selectedHistory.teams.map((team) => (
                    <div key={team.teamId} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h5 className="font-medium text-gray-900">{team.teamName}</h5>
                          <p className="text-sm text-gray-500">{team.teamCode} | {team.assignedArea}</p>
                        </div>
                        <span className="inline-block px-2 py-1 text-xs bg-indigo-100 text-indigo-800 rounded-full">
                          {team.completionRate.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600 mb-2">
                        配布済み: {team.completedStores} / {team.totalStores} 店舗
                      </div>
                      <div className="text-sm text-gray-600">
                        メンバー: {team.members.map(m => m.name).join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 区域別統計 */}
              <div>
                <h4 className="text-lg font-medium text-gray-900 mb-4">区域別実績</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedHistory.areas.map((area) => (
                    <div key={area.areaId} className="border border-gray-200 rounded-lg p-4">
                      <h5 className="font-medium text-gray-900">{area.areaName}</h5>
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
                      <div className="text-xs text-gray-500 mt-2">
                        担当チーム: {area.assignedTeams.join(', ')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* 一覧表示 */
          <div className="bg-white shadow rounded-lg">
            <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                配布履歴一覧
              </h3>
            </div>
            <div className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      年度・イベント
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      配布日
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      実績
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      完了率
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      チーム数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {histories.map((history: DistributionHistory) => (
                    <tr key={history.historyId}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {history.eventName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {history.year}年度
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(history.distributionDate).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {history.completedStores} / {history.totalStores} 店舗
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                            <div
                              className="bg-indigo-600 h-2 rounded-full"
                              style={{ width: `${history.completionRate}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">
                            {history.completionRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {history.teams.length}チーム
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => handleViewDetails(history)}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          詳細を見る
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}