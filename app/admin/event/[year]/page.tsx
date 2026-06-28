'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useFastPageTransition } from '@/lib/hooks/usePageTransition';
import FastDashboard from '../../../../components/FastDashboard';
import { FastLoadingIndicator } from '@/components/ui/SkeletonLoader';
import { useRequireAdmin } from '@/lib/hooks/useRequireAdmin';

export default function AdminEventYear() {
  const params = useParams<{ year: string }>();
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam) : NaN;

  const { navigateWithPreload, isNavigating } = useFastPageTransition();
  const {
    user,
    isAdmin,
    loading: authLoading,
    error: authError,
  } = useRequireAdmin({
    onRedirect: (path) => navigateWithPreload(path, { replace: true }),
  });

  // 年度の妥当性チェック
  useEffect(() => {
    if (isAdmin && !Number.isFinite(year)) {
      navigateWithPreload('/admin/event', { replace: true });
    }
  }, [isAdmin, year, navigateWithPreload]);

  // 全画面ローディング
  if (authLoading || isNavigating) {
    return <FastLoadingIndicator message="読み込み中..." />;
  }

  // 認証エラー
  if (authError) {
    return (
      <div className="min-h-screen bg-red-50 flex items-center justify-center">
        <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-6 text-center">
          <div className="text-red-500 text-4xl mb-4">🔒</div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">認証エラー</h2>
          <p className="text-sm text-gray-600 mb-4">{authError}</p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
            >
              ページを再読み込み
            </button>
            <Link
              href="/admin/login"
              className="px-4 py-2 border border-red-300 text-red-700 rounded-md hover:bg-red-100 transition-colors"
            >
              ログインページへ
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // 管理者権限なし
  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">⛔</div>
          <h2 className="text-xl font-semibold text-gray-700 mb-2">管理者権限が必要です</h2>
          <Link
            href="/admin/login"
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            ログインページへ
          </Link>
        </div>
      </div>
    );
  }

  // 🚀 超高速ダッシュボード表示
  return <FastDashboard year={year} isAdmin={isAdmin} />;
}
