'use client';

import { useRouter } from 'next/navigation';
import { useState, useCallback, useRef } from 'react';
import { preloadDashboard } from './useFastDashboard';
import { SmartPrefetcher } from '@/lib/utils/smart-prefetch';

interface NavigationState {
  isNavigating: boolean;
  targetPath: string | null;
  startTime: number;
}

export function useFastNavigation() {
  const router = useRouter();
  const [navState, setNavState] = useState<NavigationState>({
    isNavigating: false,
    targetPath: null,
    startTime: 0
  });
  const timeoutRef = useRef<NodeJS.Timeout>();
  const prefetcher = SmartPrefetcher.getInstance();

  /**
   * 超高速ナビゲーション（即座UIフィードバック + プリロード）
   */
  const fastNavigate = useCallback(async (path: string, options?: {
    replace?: boolean;
    preloadData?: boolean;
    showLoading?: boolean;
  }) => {
    const { replace = false, preloadData = true, showLoading = true } = options || {};
    const startTime = Date.now();

    // 1. 即座にローディング状態を表示
    if (showLoading) {
      setNavState({
        isNavigating: true,
        targetPath: path,
        startTime
      });
    }

    // 2. データプリロードを並行実行
    if (preloadData) {
      // 年度ページの場合はダッシュボードをプリロード
      const yearMatch = path.match(/\/admin\/event\/(\d+)$/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        preloadDashboard(year).catch(console.warn);
      }
      
      // スマートプリフェッチでパターン学習
      prefetcher.recordAccess(path);
    }

    // 3. ナビゲーション実行（非ブロッキング）
    try {
      if (replace) {
        router.replace(path);
      } else {
        router.push(path);
      }

      // 4. 最低150msは表示してスムーズ感を演出
      const elapsed = Date.now() - startTime;
      const minDelay = Math.max(0, 150 - elapsed);
      
      timeoutRef.current = setTimeout(() => {
        setNavState({
          isNavigating: false,
          targetPath: null,
          startTime: 0
        });
      }, minDelay);

    } catch (error) {
      console.error('ナビゲーションエラー:', error);
      setNavState({
        isNavigating: false,
        targetPath: null,
        startTime: 0
      });
    }
  }, [router, prefetcher]);

  /**
   * ボタンホバー時のプリロード
   */
  const preloadOnHover = useCallback((path: string) => {
    // ホバー時に事前データ取得
    const yearMatch = path.match(/\/admin\/event\/(\d+)$/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      setTimeout(() => preloadDashboard(year), 100); // 100ms後に実行
    }
  }, []);

  /**
   * 緊急停止（キャンセル）
   */
  const cancelNavigation = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setNavState({
      isNavigating: false,
      targetPath: null,
      startTime: 0
    });
  }, []);

  return {
    fastNavigate,
    preloadOnHover,
    cancelNavigation,
    isNavigating: navState.isNavigating,
    targetPath: navState.targetPath,
    navigationDuration: navState.startTime > 0 ? Date.now() - navState.startTime : 0
  };
}

/**
 * 高速ナビゲーションボタンコンポーネント
 */
interface FastNavButtonProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  replace?: boolean;
  preloadData?: boolean;
  onClick?: () => void;
}

export function FastNavButton({
  href,
  children,
  className = '',
  replace = false,
  preloadData = true,
  onClick
}: FastNavButtonProps) {
  const { fastNavigate, preloadOnHover, isNavigating } = useFastNavigation();

  const handleClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    onClick?.();
    await fastNavigate(href, { replace, preloadData });
  };

  const handleMouseEnter = () => {
    preloadOnHover(href);
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      className={`${className} ${isNavigating ? 'opacity-75 cursor-wait' : ''} relative`}
      disabled={isNavigating}
    >
      {isNavigating && (
        <div className="absolute inset-0 flex items-center justify-center bg-white/80">
          <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <span className={isNavigating ? 'opacity-50' : ''}>{children}</span>
    </button>
  );
}