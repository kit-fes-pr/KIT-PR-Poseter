'use client';

import { useState, createContext, useContext } from 'react';
import { useRouter } from 'next/navigation';

interface PageTransitionState {
  isTransitioning: boolean;
  fromPath: string | null;
  toPath: string | null;
  transitionType: 'navigate' | 'back' | 'forward' | null;
  progress: number;
}

interface PageTransitionContextType {
  state: PageTransitionState;
  startTransition: (toPath: string, type?: 'navigate' | 'back' | 'forward') => Promise<void>;
  completeTransition: () => void;
}

const PageTransitionContext = createContext<PageTransitionContextType | null>(null);

/**
 * ページ遷移状態を管理するProvider
 */
export function PageTransitionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<PageTransitionState>({
    isTransitioning: false,
    fromPath: null,
    toPath: null,
    transitionType: null,
    progress: 0
  });

  const startTransition = async (toPath: string, type: 'navigate' | 'back' | 'forward' = 'navigate') => {
    const fromPath = window.location.pathname;
    
    setState({
      isTransitioning: true,
      fromPath,
      toPath,
      transitionType: type,
      progress: 10
    });

    // プログレス更新のシミュレーション
    const progressTimer = setInterval(() => {
      setState(prev => ({
        ...prev,
        progress: Math.min(90, prev.progress + Math.random() * 20)
      }));
    }, 100);

    // データプリロード
    try {
      const yearMatch = toPath.match(/\/admin\/event\/(\d+)$/);
      if (yearMatch) {
        const year = parseInt(yearMatch[1]);
        await fetch(`/api/admin/dashboard/${year}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('authToken')}`,
            'X-Prefetch': 'true'
          }
        });
      }
    } catch (error) {
      console.warn('プリロードエラー:', error);
    }

    clearInterval(progressTimer);
    
    // 最低500msの遷移時間を保証（UX向上）
    setTimeout(() => {
      setState(prev => ({ ...prev, progress: 100 }));
    }, 500);
  };

  const completeTransition = () => {
    setState({
      isTransitioning: false,
      fromPath: null,
      toPath: null,
      transitionType: null,
      progress: 0
    });
  };

  return (
    <PageTransitionContext.Provider value={{ state, startTransition, completeTransition }}>
      {children}
    </PageTransitionContext.Provider>
  );
}

/**
 * ページ遷移Hook
 */
export function usePageTransition() {
  const context = useContext(PageTransitionContext);
  if (!context) {
    throw new Error('usePageTransition must be used within PageTransitionProvider');
  }
  return context;
}

/**
 * 高速ページ遷移Hook（統合版）
 */
export function useFastPageTransition() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [navigationQueue, setNavigationQueue] = useState<string[]>([]);

  /**
   * 瞬時UIフィードバック付きナビゲーション
   */
  const navigateWithPreload = async (
    path: string, 
    options: {
      replace?: boolean;
      preloadDelay?: number;
      minLoadingTime?: number;
      // Allow toggling data preloading from callers
      preloadData?: boolean;
    } = {}
  ) => {
    const { replace = false, preloadDelay = 0, minLoadingTime = 200, preloadData = true } = options;
    
    if (isNavigating) {
      // 既に遷移中の場合はキューに追加
      setNavigationQueue(prev => [...prev, path]);
      return;
    }

    setIsNavigating(true);
    const startTime = Date.now();

    try {
      // 1. 即座にローディング表示
      
      // 2. データプリロード（遅延付き、オプションで無効化可能）
      if (preloadData) {
        setTimeout(async () => {
          const yearMatch = path.match(/\/admin\/event\/(\d+)$/);
          if (yearMatch) {
            const year = parseInt(yearMatch[1]);
            const token = localStorage.getItem('authToken');
            
            if (token) {
              try {
                // バックグラウンドでダッシュボードデータを取得
                fetch(`/api/admin/dashboard/${year}`, {
                  headers: { 
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'max-age=30'
                  }
                }).catch(() => {
                  // エラーは無視（プリロード失敗時）
                });
              } catch (error) {
                console.warn('プリロードエラー:', error);
              }
            }
          }
        }, preloadDelay);
      }

      // 3. ナビゲーション実行
      if (replace) {
        router.replace(path);
      } else {
        router.push(path);
      }

      // 4. 最小表示時間を保証
      const elapsed = Date.now() - startTime;
      const remainingTime = Math.max(0, minLoadingTime - elapsed);
      
      await new Promise(resolve => setTimeout(resolve, remainingTime));

    } catch (error) {
      console.error('ナビゲーションエラー:', error);
    } finally {
      setIsNavigating(false);
      
      // キューに次の遷移があれば実行
      if (navigationQueue.length > 0) {
        const nextPath = navigationQueue[0];
        setNavigationQueue(prev => prev.slice(1));
        setTimeout(() => navigateWithPreload(nextPath), 100);
      }
    }
  };

  /**
   * 戻るボタン用の高速ナビゲーション
   */
  const goBackFast = () => {
    setIsNavigating(true);
    router.back();
    setTimeout(() => setIsNavigating(false), 300);
  };

  /**
   * 緊急停止
   */
  const cancelNavigation = () => {
    setIsNavigating(false);
    setNavigationQueue([]);
  };

  return {
    navigateWithPreload,
    goBackFast,
    cancelNavigation,
    isNavigating,
    queueLength: navigationQueue.length
  };
}

/**
 * リンクホバー時のプリロード
 */
export function useLinkPreloader() {
  const preloadedUrls = new Set<string>();

  const preloadOnHover = (path: string) => {
    if (preloadedUrls.has(path)) return;
    
    const yearMatch = path.match(/\/admin\/event\/(\d+)$/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);
      const token = localStorage.getItem('authToken');
      
      if (token) {
        preloadedUrls.add(path);
        
        // 200ms後にプリロード開始（誤ホバー防止）
        setTimeout(() => {
          fetch(`/api/admin/dashboard/${year}`, {
            headers: { 
              'Authorization': `Bearer ${token}`,
              'X-Link-Prefetch': 'true'
            }
          }).catch(() => {
            preloadedUrls.delete(path); // 失敗時は削除
          });
        }, 200);
      }
    }
  };

  return { preloadOnHover };
}
