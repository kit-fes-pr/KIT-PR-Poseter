'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { mutate as swrMutate } from 'swr';
import { writeDashboardCache } from '@/lib/utils/dashboard-cache';

interface DashboardData {
  event: {
    id: string;
    eventName: string;
    year: number;
    distributionStartDate?: string;
    distributionEndDate?: string;
  } | null;
  teams: Array<{
    teamId: string;
    teamCode: string;
    teamName: string;
    assignedArea: string;
    memberCount?: number;
  }>;
  stats: {
    totalTeams: number;
    totalMembers: number;
    byArea: Record<string, { teamCount: number; memberCount: number; teams?: string[] }>;
    teamStats: Array<{
      teamId: string;
      teamCode: string;
      memberCount: number;
      assignedArea: string;
    }>;
  };
  performance: {
    responseTime: number;
    dataFreshnessTime: string;
  };
}

const fastFetcher = async (url: string): Promise<DashboardData> => {
  const token = localStorage.getItem('authToken');
  if (!token) throw new Error('認証が必要です');
  
  const startTime = Date.now();
  const response = await fetch(url, {
    headers: { 
      'Authorization': `Bearer ${token}`,
      'Cache-Control': 'no-cache',
      'X-Request-Start': startTime.toString()
    }
  });
  
  if (!response.ok) {
    throw new Error('データ取得に失敗しました');
  }
  
  const data = await response.json();
  const clientTime = Date.now() - startTime;
  
  console.log(`🚀 ダッシュボード取得時間: ${clientTime}ms (API: ${data.performance?.responseTime || '不明'}ms)`);
  
  return data;
};

export function useFastDashboard(year: number | null, enabled = true) {
  const [loadingStage, setLoadingStage] = useState<'idle' | 'loading' | 'ready'>('idle');
  const loadStartRef = useRef<number>(0);
  
  const swrResult = useSWR(
    enabled && year ? `/api/admin/dashboard/${year}` : null,
    fastFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: true,
      refreshInterval: 30000, // 30秒間隔で自動更新
      dedupingInterval: 5000,  // 5秒間は重複リクエストを防ぐ
      errorRetryInterval: 3000,
      errorRetryCount: 3,
      onLoadingSlow: () => {
        console.warn('⚠️ データ取得が遅延しています...');
      },
      loadingTimeout: 3000, // 3秒でスロー判定
      onSuccess: () => {
        const totalTime = Date.now() - loadStartRef.current;
        setLoadingStage('ready');
        console.log(`✅ ダッシュボード読み込み完了 (合計: ${totalTime}ms)`);
      },
      onError: (error) => {
        setLoadingStage('idle');
        console.error('❌ ダッシュボードエラー:', error);
      }
    }
  );
  
  // 読み込み開始時の処理
  useEffect(() => {
    if (swrResult.isLoading && loadingStage === 'idle') {
      setLoadingStage('loading');
      loadStartRef.current = Date.now();
      console.log('🔄 ダッシュボード読み込み開始...');
    }
  }, [swrResult.isLoading, loadingStage]);
  
  // データの整理とメモ化
  const processedData = swrResult.data ? {
    // イベント情報
    event: swrResult.data.event,
    
    // ソート済みチーム一覧
    sortedTeams: [...(swrResult.data.teams || [])].sort((a, b) => {
      const codeA = String(a.teamCode || '').toLowerCase();
      const codeB = String(b.teamCode || '').toLowerCase();
      
      const getOrderPriority = (code: string) => {
        if (code.includes('am')) return 1;
        if (code.includes('pm')) return 2;
        return 3;
      };
      
      const priorityA = getOrderPriority(codeA);
      const priorityB = getOrderPriority(codeB);
      
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      
      return codeA.localeCompare(codeB);
    }),
    
    // 統計情報
    stats: swrResult.data.stats,
    
    // パフォーマンス情報
    performance: swrResult.data.performance
  } : null;
  
  return {
    ...swrResult,
    data: processedData,
    loadingStage,
    isSlowLoading: swrResult.isLoading && Date.now() - loadStartRef.current > 2000
  };
}

// プリロード機能
export function preloadDashboard(year: number) {
  const token = localStorage.getItem('authToken');
  if (!token || !year) return;
  
  const minimalKey = `/api/admin/dashboard/${year}/minimal`;
  const fullKey = `/api/admin/dashboard/${year}`;
  const progressiveKey = `/api/admin/dashboard/${year}/progressive?offset=0&limit=10&includeMembers=true`;

  // バックグラウンドでデータを取得してキャッシュ
  Promise.allSettled([
    fetch(minimalKey, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.ok ? res.json() : null),
    fetch(fullKey, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.ok ? res.json() : null),
    fetch(progressiveKey, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => res.ok ? res.json() : null)
  ]).then((results) => {
    const minimalResult = results[0].status === 'fulfilled' ? results[0].value : null;
    const fullResult = results[1].status === 'fulfilled' ? results[1].value : null;
    const progressiveResult = results[2].status === 'fulfilled' ? results[2].value : null;

    if (minimalResult) {
      swrMutate(minimalKey, minimalResult, false);
    }
    if (fullResult) {
      swrMutate(fullKey, fullResult, false);
    }
    if (minimalResult) {
      const totalTeams = Number((minimalResult as { stats?: { totalTeams?: number } }).stats?.totalTeams || 0);
      const progressiveTeams = Array.isArray((progressiveResult as { teams?: unknown[] } | null)?.teams)
        ? ((progressiveResult as { teams?: unknown[] } | null)?.teams as unknown[])
        : [];
      writeDashboardCache(year, {
        minimalData: minimalResult,
        progressiveTeams,
        loadingProgress: totalTeams > 0 ? Math.min(100, (progressiveTeams.length / totalTeams) * 100) : 0,
        totalExpected: totalTeams,
        hasMore: Boolean((progressiveResult as { pagination?: { hasMore?: boolean } } | null)?.pagination?.hasMore)
      });
    }
    console.log(`📦 年度${year}のダッシュボードデータをプリロードしました`);
  }).catch(err => {
    console.warn('プリロード失敗:', err);
  });
}
