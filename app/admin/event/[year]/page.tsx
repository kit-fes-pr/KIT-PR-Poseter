'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useFastPageTransition } from '@/lib/hooks/usePageTransition';
import { useErrorRecovery } from '@/lib/utils/error-recovery';
import FastDashboard from '../../../../components/FastDashboard';
import { FastLoadingIndicator } from '@/components/ui/SkeletonLoader';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';

export default function AdminEventYear() {
  const params = useParams<{ year: string }>();
  const yearParam = params?.year;
  const year = yearParam ? parseInt(yearParam) : NaN;

  const [isAdmin, setIsAdmin] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const { navigateWithPreload, isNavigating } = useFastPageTransition();
  const { handleError, retryOperation } = useErrorRecovery();

  // 認証状態の高速確認
  useEffect(() => {
    let mounted = true;

    const performFastAuth = async () => {
      try {
        setAuthLoading(true);
        setAuthError(null);

        const token = localStorage.getItem('authToken');
        if (!token) {
          if (mounted) {
            navigateWithPreload('/admin/login', { replace: true });
          }
          return;
        }

        // 高速認証確認
        const authResponse = await retryOperation(
          () =>
            fetch('/api/auth/verify', {
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(5000),
            }),
          'fast-auth',
          { maxRetries: 2 },
        );

        if (authResponse.ok) {
          const data = await authResponse.json();
          if (data?.user?.isAdmin && mounted) {
            setIsAdmin(true);
          } else if (mounted) {
            navigateWithPreload('/admin/login', { replace: true });
          }
        } else if (mounted) {
          localStorage.removeItem('authToken');
          navigateWithPreload('/admin/login', { replace: true });
        }
      } catch (error) {
        const diagnosis = handleError(error, 'fast-auth');

        if (mounted) {
          if (diagnosis.type === 'auth') {
            localStorage.removeItem('authToken');
            navigateWithPreload('/admin/login', { replace: true });
          } else if (diagnosis.recoverable) {
            setAuthError('認証の確認中にエラーが発生しました');
          } else {
            setAuthError('システムエラーが発生しました');
          }
        }
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    };

    performFastAuth();

    return () => {
      mounted = false;
    };
  }, [navigateWithPreload, handleError, retryOperation]);

  // Firebase認証状態監視（バックグラウンド）
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user && isAdmin) {
        // Firebase認証が切れた場合
        localStorage.removeItem('authToken');
        navigateWithPreload('/admin/login', { replace: true });
      }
    });

    return () => unsubscribe();
  }, [isAdmin, navigateWithPreload]);

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
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            ページを再読み込み
          </button>
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
          <h2 className="text-xl font-semibold text-gray-700 mb-2">アクセス権限がありません</h2>
          <p className="text-gray-500 mb-4">管理者権限が必要です</p>
        </div>
      </div>
    );
  }

  // 🚀 超高速ダッシュボード表示
  return <FastDashboard year={year} isAdmin={isAdmin} />;
}
