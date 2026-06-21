'use client';

import { mutate } from 'swr';

/**
 * スマートプリフェッチシステム
 * ユーザーの行動パターンを学習して先読みする
 */
export class SmartPrefetcher {
  private static instance: SmartPrefetcher;
  private userPatterns: Map<string, { count: number; lastAccess: number }> = new Map();
  private prefetchQueue: Set<string> = new Set();
  private isEnabled = true;

  static getInstance(): SmartPrefetcher {
    if (!this.instance) {
      this.instance = new SmartPrefetcher();
    }
    return this.instance;
  }

  /**
   * ユーザーのアクセスパターンを記録
   */
  recordAccess(path: string) {
    const current = this.userPatterns.get(path) || { count: 0, lastAccess: 0 };
    this.userPatterns.set(path, {
      count: current.count + 1,
      lastAccess: Date.now(),
    });

    // 関連データの予測プリフェッチ
    this.predictAndPrefetch(path);
  }

  /**
   * アクセスパターンから次のデータを予測
   */
  private predictAndPrefetch(currentPath: string) {
    if (!this.isEnabled) return;

    const token = localStorage.getItem('authToken');
    if (!token) return;

    // 年度ページからの予測
    const yearMatch = currentPath.match(/\/admin\/event\/(\d+)$/);
    if (yearMatch) {
      const year = parseInt(yearMatch[1]);

      // よくアクセスされるサブページを先読み
      const subPages = [
        `/api/admin/dashboard/${year}`,
        `/api/admin/teams/incremental?year=${year}`,
        `/api/admin/stats?year=${year}`,
      ];

      subPages.forEach((url) => this.queuePrefetch(url));

      // 前年・来年のダッシュボードも予測先読み
      if (this.shouldPrefetchAdjacentYears(year)) {
        this.queuePrefetch(`/api/admin/dashboard/${year - 1}`);
        this.queuePrefetch(`/api/admin/dashboard/${year + 1}`);
      }
    }

    // チーム詳細ページからの予測
    const teamMatch = currentPath.match(/\/admin\/event\/(\d+)\/team\/(.+)$/);
    if (teamMatch) {
      const [, , teamId] = teamMatch;
      this.queuePrefetch(`/api/admin/teams/${teamId}`);
      this.queuePrefetch(`/api/admin/members?teamId=${teamId}`);
    }

    // プリフェッチキューを処理
    this.processPrefetchQueue();
  }

  /**
   * 隣接年度のプリフェッチが必要かを判定
   */
  private shouldPrefetchAdjacentYears(year: number): boolean {
    // 現在年度の前後2年以内なら先読み対象
    const currentYear = new Date().getFullYear();
    return Math.abs(year - currentYear) <= 2;
  }

  /**
   * プリフェッチキューに追加
   */
  private queuePrefetch(url: string) {
    if (this.prefetchQueue.has(url)) return;
    this.prefetchQueue.add(url);
  }

  /**
   * プリフェッチキューを処理（非ブロッキング）
   */
  private processPrefetchQueue() {
    if (this.prefetchQueue.size === 0) return;

    // 最大3つまで同時プリフェッチ
    const batch = Array.from(this.prefetchQueue).slice(0, 3);

    batch.forEach(async (url) => {
      this.prefetchQueue.delete(url);

      try {
        // バックグラウンドで低優先度取得
        await this.backgroundFetch(url);
        console.log(`📦 プリフェッチ完了: ${url}`);
      } catch (error) {
        console.warn(`プリフェッチ失敗: ${url}`, error);
      }
    });

    // 残りがあれば500ms後に処理
    if (this.prefetchQueue.size > 0) {
      setTimeout(() => this.processPrefetchQueue(), 500);
    }
  }

  /**
   * バックグラウンドでの低優先度取得
   */
  private async backgroundFetch(url: string): Promise<unknown> {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('認証が必要');

    // Request Idle Callback があれば使用
    if ('requestIdleCallback' in window) {
      return new Promise((resolve, reject) => {
        (window as { requestIdleCallback: (callback: () => void) => void }).requestIdleCallback(
          async () => {
            try {
              const response = await fetch(url, {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'X-Prefetch': 'true',
                },
                priority: 'low', // 可能であれば低優先度
              } as RequestInit);

              if (response.ok) {
                const data = await response.json();
                // SWRキャッシュに格納
                mutate(url, data, false);
                resolve(data);
              } else {
                reject(new Error(`HTTP ${response.status}`));
              }
            } catch (error) {
              reject(error);
            }
          },
        );
      });
    } else {
      // Idle Callback がない場合は通常のfetch
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Prefetch': 'true',
        },
      });

      if (response.ok) {
        const data = await response.json();
        mutate(url, data, false);
        return data;
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    }
  }

  /**
   * プリフェッチの有効/無効切り替え
   */
  setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (!enabled) {
      this.prefetchQueue.clear();
    }
  }

  /**
   * 統計情報取得
   */
  getStats() {
    return {
      patterns: Array.from(this.userPatterns.entries()).map(([path, data]) => ({
        path,
        accessCount: data.count,
        lastAccess: new Date(data.lastAccess).toLocaleString('ja-JP'),
      })),
      queueSize: this.prefetchQueue.size,
      isEnabled: this.isEnabled,
    };
  }

  /**
   * キャッシュクリア
   */
  clearCache() {
    this.userPatterns.clear();
    this.prefetchQueue.clear();
  }
}

// Hookとして使用するための関数
export function useSmartPrefetch() {
  const prefetcher = SmartPrefetcher.getInstance();

  const recordPageVisit = (path: string) => {
    prefetcher.recordAccess(path);
  };

  const getStats = () => prefetcher.getStats();

  const setEnabled = (enabled: boolean) => {
    prefetcher.setEnabled(enabled);
  };

  return {
    recordPageVisit,
    getStats,
    setEnabled,
  };
}
