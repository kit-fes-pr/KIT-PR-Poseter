'use client';

// import { mutate } from 'swr'; // Currently unused

/**
 * エラー回復システム
 */
export class ErrorRecoverySystem {
  private static instance: ErrorRecoverySystem;
  private retryAttempts = new Map<string, number>();
  private maxRetries = 3;
  private baseDelay = 1000;
  
  static getInstance(): ErrorRecoverySystem {
    if (!this.instance) {
      this.instance = new ErrorRecoverySystem();
    }
    return this.instance;
  }

  /**
   * 指数バックオフでリトライ
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    key: string,
    options: {
      maxRetries?: number;
      baseDelay?: number;
      onRetry?: (attempt: number, error: unknown) => void;
    } = {}
  ): Promise<T> {
    const { 
      maxRetries = this.maxRetries, 
      baseDelay = this.baseDelay,
      onRetry
    } = options;
    
    const attempts = this.retryAttempts.get(key) || 0;
    
    try {
      const result = await operation();
      // 成功時はカウンターをリセット
      this.retryAttempts.delete(key);
      return result;
    } catch (error) {
      if (attempts >= maxRetries) {
        // 最大リトライ回数に達した
        this.retryAttempts.delete(key);
        throw new Error(`最大リトライ回数(${maxRetries})に達しました: ${error}`);
      }
      
      const nextAttempt = attempts + 1;
      this.retryAttempts.set(key, nextAttempt);
      
      // コールバック実行
      onRetry?.(nextAttempt, error);
      
      // 指数バックオフで待機
      const delay = baseDelay * Math.pow(2, attempts) + Math.random() * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
      
      // 再帰的にリトライ
      return this.retryWithBackoff(operation, key, options);
    }
  }

  /**
   * ネットワークエラーの詳細診断
   */
  diagnoseNetworkError(error: unknown): {
    type: 'network' | 'server' | 'auth' | 'timeout' | 'unknown';
    message: string;
    suggestion: string;
    recoverable: boolean;
  } {
    if (!navigator.onLine) {
      return {
        type: 'network',
        message: 'インターネット接続がありません',
        suggestion: 'ネットワーク接続を確認してください',
        recoverable: true
      };
    }

    const httpError = error as { status?: number };
    if (httpError?.status === 401 || httpError?.status === 403) {
      return {
        type: 'auth',
        message: '認証エラーが発生しました',
        suggestion: '再ログインが必要です',
        recoverable: false
      };
    }

    if (httpError?.status && httpError.status >= 500) {
      return {
        type: 'server',
        message: 'サーバーエラーが発生しました',
        suggestion: 'しばらく待ってから再試行してください',
        recoverable: true
      };
    }

    if ((error as { name?: string })?.name === 'TimeoutError' || (error as { code?: string })?.code === 'TIMEOUT') {
      return {
        type: 'timeout',
        message: '通信がタイムアウトしました',
        suggestion: '接続が遅い可能性があります。再試行してください',
        recoverable: true
      };
    }

    return {
      type: 'unknown',
      message: '不明なエラーが発生しました',
      suggestion: 'ページを更新してみてください',
      recoverable: true
    };
  }

  /**
   * SWR用のエラー回復フック
   */
  createRecoveryFetcher(originalFetcher: (url: string) => Promise<unknown>) {
    return async (url: string) => {
      return this.retryWithBackoff(
        () => originalFetcher(url),
        `fetcher_${url}`,
        {
          onRetry: (attempt, error) => {
            console.warn(`🔄 リトライ ${attempt}回目: ${url}`, error);
          }
        }
      );
    };
  }

  /**
   * 緊急時のオフライン対応
   */
  enableOfflineMode(urls: string[]) {
    if ('serviceWorker' in navigator) {
      // Service Worker経由でオフラインキャッシュを有効化
      navigator.serviceWorker.ready.then(registration => {
        registration.active?.postMessage({
          type: 'ENABLE_OFFLINE_CACHE',
          urls
        });
      });
    }
  }

  /**
   * 統計情報
   */
  getRetryStats() {
    return {
      activeRetries: Array.from(this.retryAttempts.entries()).map(([key, attempts]) => ({
        key,
        attempts
      })),
      totalRetrying: this.retryAttempts.size
    };
  }
}

/**
 * React Hook for error recovery
 */
export function useErrorRecovery() {
  const recovery = ErrorRecoverySystem.getInstance();

  const handleError = (error: unknown, context?: string) => {
    const diagnosis = recovery.diagnoseNetworkError(error);
    
    console.error(`エラー発生 [${context || 'unknown'}]:`, {
      error,
      diagnosis
    });

    return diagnosis;
  };

  const retryOperation = async <T>(
    operation: () => Promise<T>,
    key: string,
    options?: {
      maxRetries?: number;
      onRetry?: (attempt: number, error: unknown) => void;
    }
  ) => {
    return recovery.retryWithBackoff(operation, key, options);
  };

  const createRobustFetcher = (baseFetcher: (url: string) => Promise<unknown>) => {
    return recovery.createRecoveryFetcher(baseFetcher);
  };

  return {
    handleError,
    retryOperation,
    createRobustFetcher,
    getRetryStats: () => recovery.getRetryStats()
  };
}

/**
 * エラー境界用のエラーレポートシステム
 */
export class ErrorReporter {
  private static errors: Array<{
    timestamp: number;
    error: Error;
    context?: string;
    userAgent: string;
    url: string;
  }> = [];

  static reportError(error: Error, context?: string) {
    this.errors.push({
      timestamp: Date.now(),
      error,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href
    });

    // 開発環境では詳細ログ
    if (process.env.NODE_ENV === 'development') {
      console.group(`🚨 Error Report [${context}]`);
      console.error('Error:', error);
      console.log('Context:', context);
      console.log('URL:', window.location.href);
      console.log('Time:', new Date().toLocaleString('ja-JP'));
      console.groupEnd();
    }

    // 本番環境では外部サービスに送信（実装例）
    // if (process.env.NODE_ENV === 'production') {
    //   // Sentry, LogRocket, などに送信
    // }
  }

  static getErrorHistory() {
    return this.errors.slice(-10); // 直近10件
  }

  static clearErrors() {
    this.errors = [];
  }
}