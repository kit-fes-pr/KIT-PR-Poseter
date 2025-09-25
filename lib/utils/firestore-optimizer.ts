import { adminDb } from '@/lib/firebase-admin';

/**
 * 最適化されたFirestoreクエリヘルパー
 */
export class FirestoreOptimizer {
  private static queryCache = new Map<string, { data: unknown; timestamp: number }>();
  private static CACHE_DURATION = 30 * 1000; // 30秒キャッシュ

  /**
   * 複数のクエリを並列実行し、結果をキャッシュ
   */
  static async parallelQuery(queries: Array<{ key: string; query: () => Promise<unknown> }>): Promise<Record<string, unknown>> {
    const results: Record<string, unknown> = {};
    const activeQueries: Promise<void>[] = [];

    for (const { key, query } of queries) {
      activeQueries.push(
        (async () => {
          try {
            // キャッシュチェック
            const cached = this.queryCache.get(key);
            if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
              results[key] = cached.data;
              return;
            }

            // クエリ実行
            const startTime = Date.now();
            const data = await query();
            const duration = Date.now() - startTime;

            console.log(`🔍 Firestore query "${key}": ${duration}ms`);

            // 結果をキャッシュ
            this.queryCache.set(key, { data, timestamp: Date.now() });
            results[key] = data;
          } catch (error) {
            console.error(`❌ Query "${key}" failed:`, error);
            results[key] = null;
          }
        })()
      );
    }

    await Promise.all(activeQueries);
    return results;
  }

  /**
   * Firestoreインデックス最適化のヒント
   */
  static getIndexHints(collection: string) {
    const hints = {
      teams: [
        'year ASC, updatedAt DESC',
        'year ASC, isActive ASC',
        'year ASC, teamCode ASC'
      ],
      members: [
        'year ASC, teamId ASC',
        'year ASC, createdAt DESC'
      ],
      distributionEvents: [
        'year ASC',
        'year ASC, createdAt DESC'
      ]
    };

    return hints[collection as keyof typeof hints] || [];
  }

  /**
   * バッチ処理でドキュメントを効率的に取得
   */
  static async batchGet(refs: unknown[]): Promise<unknown[]> {
    if (refs.length === 0) return [];
    
    const batchSize = 10; // Firestoreのバッチサイズ制限
    const batches: unknown[][] = [];
    
    for (let i = 0; i < refs.length; i += batchSize) {
      batches.push(refs.slice(i, i + batchSize));
    }
    
    const results = await Promise.all(
      batches.map(batch => 
        adminDb.getAll(...(batch as Parameters<typeof adminDb.getAll>)).then(docs => 
          docs.map(doc => ({ id: doc.id, ...doc.data() }))
        )
      )
    );
    
    return results.flat();
  }

  /**
   * キャッシュクリア
   */
  static clearCache(pattern?: string) {
    if (pattern) {
      for (const key of this.queryCache.keys()) {
        if (key.includes(pattern)) {
          this.queryCache.delete(key);
        }
      }
    } else {
      this.queryCache.clear();
    }
  }

  /**
   * クエリ統計情報
   */
  static getQueryStats() {
    return {
      cacheSize: this.queryCache.size,
      cacheKeys: Array.from(this.queryCache.keys()),
      memory: JSON.stringify(Array.from(this.queryCache.entries())).length
    };
  }
}