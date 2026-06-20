/**
 * 高性能サーバーサイドキャッシュシステム
 */
export class ServerCache {
  private static cache = new Map<
    string,
    {
      data: unknown;
      timestamp: number;
      ttl: number;
      accessCount: number;
      lastAccess: number;
    }
  >();

  private static readonly DEFAULT_TTL = 30 * 1000; // 30秒
  private static readonly MAX_CACHE_SIZE = 1000;
  private static readonly CLEANUP_INTERVAL = 60 * 1000; // 1分

  static {
    // 定期的なキャッシュクリーンアップ
    if (typeof setInterval !== 'undefined') {
      setInterval(() => {
        this.cleanup();
      }, this.CLEANUP_INTERVAL);
    }
  }

  /**
   * キャッシュからデータを取得
   */
  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // アクセス統計を更新
    entry.accessCount++;
    entry.lastAccess = now;

    return entry.data as T;
  }

  /**
   * データをキャッシュに保存
   */
  static set(key: string, data: unknown, ttl: number = this.DEFAULT_TTL): void {
    // キャッシュサイズ制限
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      accessCount: 1,
      lastAccess: Date.now(),
    });
  }

  /**
   * キャッシュから削除
   */
  static delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * パターンマッチで削除
   */
  static deletePattern(pattern: string): number {
    let deletedCount = 0;
    const regex = new RegExp(pattern.replace('*', '.*'));

    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    return deletedCount;
  }

  /**
   * キャッシュまたは計算実行
   */
  static async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    ttl: number = this.DEFAULT_TTL,
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      console.log(`🎯 キャッシュヒット: ${key}`);
      return cached;
    }

    console.log(`⚡ キャッシュミス、実行中: ${key}`);
    const startTime = Date.now();

    try {
      const result = await factory();
      this.set(key, result, ttl);

      const executionTime = Date.now() - startTime;
      console.log(`✅ キャッシュ保存完了: ${key} (${executionTime}ms)`);

      return result;
    } catch (error) {
      console.error(`❌ キャッシュ生成エラー: ${key}`, error);
      throw error;
    }
  }

  /**
   * LRU方式で古いキャッシュを削除
   */
  private static evictLRU(): void {
    let oldestKey = '';
    let oldestTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      console.log(`🗑️ LRU削除: ${oldestKey}`);
    }
  }

  /**
   * 期限切れキャッシュを削除
   */
  private static cleanup(): void {
    const now = Date.now();
    let deletedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`🧹 キャッシュクリーンアップ: ${deletedCount}件削除`);
    }
  }

  /**
   * キャッシュ統計情報
   */
  static getStats() {
    const entries = Array.from(this.cache.entries());
    const now = Date.now();

    return {
      size: this.cache.size,
      maxSize: this.MAX_CACHE_SIZE,
      utilization: (this.cache.size / this.MAX_CACHE_SIZE) * 100,
      entries: entries.map(([key, entry]) => ({
        key,
        age: now - entry.timestamp,
        ttl: entry.ttl,
        accessCount: entry.accessCount,
        dataSize: JSON.stringify(entry.data).length,
        expired: now - entry.timestamp > entry.ttl,
      })),
      totalHits: entries.reduce((sum, [, entry]) => sum + entry.accessCount, 0),
      avgAccessCount:
        entries.length > 0
          ? entries.reduce((sum, [, entry]) => sum + entry.accessCount, 0) / entries.length
          : 0,
    };
  }

  /**
   * 全キャッシュクリア
   */
  static clear(): void {
    this.cache.clear();
    console.log('🧹 全キャッシュクリア完了');
  }

  /**
   * キャッシュウォームアップ（事前読み込み）
   */
  static async warmup(
    tasks: Array<{ key: string; factory: () => Promise<unknown>; ttl?: number }>,
  ): Promise<void> {
    console.log(`🔥 キャッシュウォームアップ開始: ${tasks.length}件`);
    const startTime = Date.now();

    const promises = tasks.map(async ({ key, factory, ttl }) => {
      try {
        const result = await factory();
        this.set(key, result, ttl);
        return { key, success: true };
      } catch (error) {
        console.error(`ウォームアップエラー [${key}]:`, error);
        return { key, success: false, error };
      }
    });

    const results = await Promise.allSettled(promises);
    const successful = results.filter((r) => r.status === 'fulfilled').length;
    const duration = Date.now() - startTime;

    console.log(`🔥 ウォームアップ完了: ${successful}/${tasks.length} (${duration}ms)`);
  }
}

/**
 * Firestore専用キャッシュヘルパー
 */
export class FirestoreCache {
  /**
   * 年度別データの統一キャッシュキー生成
   */
  static getYearKey(collection: string, year: number, suffix?: string): string {
    return `firestore:${collection}:${year}${suffix ? `:${suffix}` : ''}`;
  }

  /**
   * カウントクエリキャッシュ（長時間保持）
   */
  static async getCachedCount(
    collection: string,
    year: number,
    queryFn: () => Promise<number>,
  ): Promise<number> {
    const key = this.getYearKey(collection, year, 'count');
    return ServerCache.getOrSet(key, queryFn, 5 * 60 * 1000); // 5分キャッシュ
  }

  /**
   * ダッシュボード用最小限データキャッシュ
   */
  static async getCachedMinimalData(
    year: number,
    queryFn: () => Promise<unknown>,
  ): Promise<unknown> {
    const key = this.getYearKey('dashboard', year, 'minimal');
    return ServerCache.getOrSet(key, queryFn, 30 * 1000); // 30秒キャッシュ
  }

  /**
   * イベント情報キャッシュ（比較的長時間）
   */
  static async getCachedEvent(year: number, queryFn: () => Promise<unknown>): Promise<unknown> {
    const key = this.getYearKey('events', year);
    return ServerCache.getOrSet(key, queryFn, 2 * 60 * 1000); // 2分キャッシュ
  }

  /**
   * 年度データ無効化
   */
  static invalidateYear(year: number): void {
    const patterns = [`firestore:*:${year}:*`, `firestore:*:${year}`, `dashboard:${year}:*`];

    let totalDeleted = 0;
    patterns.forEach((pattern) => {
      totalDeleted += ServerCache.deletePattern(pattern);
    });

    console.log(`🗑️ 年度${year}のキャッシュ無効化: ${totalDeleted}件`);
  }
}
