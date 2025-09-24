import { useSWRConfig } from 'swr';

// ローカルストレージベースのキャッシュマネージャー
export class LocalCacheManager {
  private prefix = 'kitpr_cache_';
  
  // キャッシュデータの保存
  setCache(key: string, data: any, timestamp?: string): void {
    try {
      const cacheData = {
        data,
        timestamp: timestamp || new Date().toISOString(),
        cachedAt: Date.now()
      };
      localStorage.setItem(this.prefix + key, JSON.stringify(cacheData));
    } catch (error) {
      console.warn('キャッシュ保存失敗:', error);
    }
  }
  
  // キャッシュデータの取得
  getCache(key: string): { data: any; timestamp: string } | null {
    try {
      const cached = localStorage.getItem(this.prefix + key);
      if (!cached) return null;
      
      const cacheData = JSON.parse(cached);
      
      // 1時間以上古いキャッシュは無効
      if (Date.now() - cacheData.cachedAt > 60 * 60 * 1000) {
        this.removeCache(key);
        return null;
      }
      
      return {
        data: cacheData.data,
        timestamp: cacheData.timestamp
      };
    } catch (error) {
      console.warn('キャッシュ取得失敗:', error);
      return null;
    }
  }
  
  // キャッシュの削除
  removeCache(key: string): void {
    localStorage.removeItem(this.prefix + key);
  }
  
  // 差分データをマージ
  mergeIncrementalData(existing: any[], incremental: any[], keyField = 'teamId'): any[] {
    const result = [...existing];
    
    incremental.forEach(newItem => {
      const index = result.findIndex(item => item[keyField] === newItem[keyField]);
      if (index >= 0) {
        // 既存データを更新
        result[index] = { ...result[index], ...newItem };
      } else {
        // 新しいデータを追加
        result.push(newItem);
      }
    });
    
    return result;
  }
  
  // 削除されたアイテムを除去
  removeDeletedItems(existing: any[], deleted: any[], keyField = 'teamId'): any[] {
    const deletedIds = new Set(deleted.map(item => item[keyField]));
    return existing.filter(item => !deletedIds.has(item[keyField]));
  }
}

// SWR用の差分取得fetcher
export const createIncrementalFetcher = (cacheManager: LocalCacheManager) => {
  return async (url: string): Promise<any> => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('認証が必要です');
    
    // URLからキャッシュキーを生成
    const cacheKey = url.replace(/^\/api\//, '').replace(/\?.*$/, '').replace(/\//g, '_');
    const cached = cacheManager.getCache(cacheKey);
    
    // 差分取得用のURL構築
    const baseUrl = url.replace('/teams?', '/teams/incremental?');
    const incrementalUrl = cached 
      ? `${baseUrl}&lastUpdated=${encodeURIComponent(cached.timestamp)}&includeDeleted=true`
      : baseUrl;
    
    const response = await fetch(incrementalUrl, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache'
      }
    });
    
    if (!response.ok) {
      throw new Error('データ取得に失敗しました');
    }
    
    const result = await response.json();
    
    if (result.isIncremental && cached) {
      // 差分データをマージ
      let mergedData = cacheManager.mergeIncrementalData(cached.data, result.teams);
      
      // 削除されたアイテムを除去
      if (result.deletedTeams?.length > 0) {
        mergedData = cacheManager.removeDeletedItems(mergedData, result.deletedTeams);
      }
      
      // 新しいキャッシュを保存
      cacheManager.setCache(cacheKey, mergedData, result.lastUpdated);
      
      return mergedData;
    } else {
      // 初回取得またはフル更新
      cacheManager.setCache(cacheKey, result.teams, result.lastUpdated);
      return result.teams;
    }
  };
};

// SWR設定の最適化
export const optimizedSWRConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  refreshInterval: 0, // ポーリングを無効化（リアルタイム更新を使用）
  dedupingInterval: 10000, // 10秒間は重複リクエストを防ぐ
  errorRetryInterval: 5000,
  errorRetryCount: 3,
  shouldRetryOnError: (error: any) => {
    // 認証エラーの場合はリトライしない
    return ![401, 403].includes(error?.status);
  }
};