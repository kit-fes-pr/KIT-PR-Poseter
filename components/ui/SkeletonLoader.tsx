'use client';

import React from 'react';

/**
 * 基本スケルトンUI
 */
export const Skeleton: React.FC<{ 
  className?: string;
  width?: string | number;
  height?: string | number;
}> = ({ className = '', width, height }) => (
  <div
    className={`animate-pulse bg-gray-200 rounded ${className}`}
    style={{ 
      width: typeof width === 'number' ? `${width}px` : width,
      height: typeof height === 'number' ? `${height}px` : height
    }}
  />
);

/**
 * ダッシュボード専用スケルトン
 */
export const DashboardSkeleton: React.FC = () => (
  <div className="space-y-6">
    {/* ナビゲーションバー */}
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Skeleton className="h-6 w-48" />
          <div className="flex space-x-2">
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      </div>
    </nav>

    {/* メインコンテンツエリア */}
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
      {/* イベント情報カード */}
      <div className="bg-white shadow rounded-lg p-6">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-8 w-16" />
        </div>
      </div>

      {/* 統計カード */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white overflow-hidden shadow rounded-lg">
            <div className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Skeleton className="h-8 w-8 rounded-full" />
                </div>
                <div className="ml-5 w-0 flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* チーム一覧テーブル */}
      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 border-b border-gray-200">
          <Skeleton className="h-6 w-32" />
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[1, 2, 3, 4].map(i => (
                  <th key={i} className="px-6 py-3">
                    <Skeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[1, 2, 3, 4, 5].map(i => (
                <tr key={i}>
                  {[1, 2, 3, 4].map(j => (
                    <td key={j} className="px-6 py-4">
                      <Skeleton className="h-4 w-full" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
);

/**
 * チーム詳細スケルトン
 */
export const TeamDetailSkeleton: React.FC = () => (
  <div className="min-h-screen bg-gray-50">
    <nav className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-8 w-20" />
        </div>
      </div>
    </nav>

    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* チーム情報 */}
      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="space-y-1">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-6 w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* メンバー一覧 */}
      <div className="bg-white shadow rounded-lg p-6 space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="border rounded-lg p-4">
              <div className="flex items-center space-x-4">
                <Skeleton className="h-12 w-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-40" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
);

/**
 * 高速ローディングインジケーター（アニメーション強化）
 */
export const FastLoadingIndicator: React.FC<{
  message?: string;
  progress?: number;
  isSlowLoading?: boolean;
}> = ({ 
  message = "読み込み中...", 
  progress,
  isSlowLoading = false 
}) => (
  <div className={`fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm
    ${isSlowLoading ? 'bg-yellow-50/90' : ''}`}>
    <div className="text-center space-y-4">
      {/* スピナー */}
      <div className="relative">
        <div className="w-12 h-12 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
        {isSlowLoading && (
          <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-r-orange-400 rounded-full animate-spin animation-delay-150"></div>
        )}
      </div>
      
      {/* メッセージ */}
      <p className={`text-sm font-medium ${isSlowLoading ? 'text-orange-700' : 'text-gray-700'}`}>
        {isSlowLoading ? '大量データを処理中...' : message}
      </p>
      
      {/* プログレスバー */}
      {typeof progress === 'number' && (
        <div className="w-64 bg-gray-200 rounded-full h-2">
          <div 
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
          ></div>
        </div>
      )}
      
      {/* ヒント（遅い場合） */}
      {isSlowLoading && (
        <p className="text-xs text-orange-600">
          初回読み込みのため時間がかかっています
        </p>
      )}
    </div>
  </div>
);

/**
 * インライン読み込み表示
 */
export const InlineLoader: React.FC<{
  size?: 'sm' | 'md' | 'lg';
  message?: string;
}> = ({ size = 'md', message }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6', 
    lg: 'w-8 h-8'
  };

  return (
    <div className="flex items-center space-x-2 text-gray-600">
      <div className={`border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin ${sizeClasses[size]}`}></div>
      {message && <span className="text-sm">{message}</span>}
    </div>
  );
};