'use client';

import { useState, useEffect, useCallback } from 'react';
import useSWR from 'swr';
import { useErrorRecovery } from '@/lib/utils/error-recovery';

interface ProgressiveDataState {
  minimalData: any;
  progressiveTeams: any[];
  isLoadingMinimal: boolean;
  isLoadingProgressive: boolean;
  loadingProgress: number;
  totalExpected: number;
  error: any;
  hasMore: boolean;
}

/**
 * 段階的データ読み込みHook - 超高速初期表示
 */
export function useProgressiveData(year: number | null, enabled = true) {
  const [state, setState] = useState<ProgressiveDataState>({
    minimalData: null,
    progressiveTeams: [],
    isLoadingMinimal: true,
    isLoadingProgressive: false,
    loadingProgress: 0,
    totalExpected: 0,
    error: null,
    hasMore: false
  });

  const { createRobustFetcher } = useErrorRecovery();
  
  // 1. 最小限データを超高速取得
  const minimalFetcher = createRobustFetcher(async (url: string) => {
    const token = localStorage.getItem('authToken');
    if (!token) throw new Error('認証が必要');
    
    const startTime = Date.now();
    const response = await fetch(url, {
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Priority': 'high' // 高優先度
      }
    });
    
    if (!response.ok) throw new Error('データ取得に失敗');
    
    const data = await response.json();
    const clientTime = Date.now() - startTime;
    
    console.log(`⚡ 最小限データ取得: ${clientTime}ms (API: ${data.performance?.responseTime}ms)`);
    
    return data;
  });

  const { data: minimalData, error: minimalError } = useSWR(
    enabled && year ? `/api/admin/dashboard/${year}/minimal` : null,
    minimalFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 30000,
      onSuccess: (data) => {
        setState(prev => ({
          ...prev,
          minimalData: data,
          isLoadingMinimal: false,
          totalExpected: data.stats?.totalTeams || 0,
          hasMore: (data.stats?.totalTeams || 0) > 0
        }));
      },
      onError: (error) => {
        setState(prev => ({
          ...prev,
          error,
          isLoadingMinimal: false
        }));
      }
    }
  );

  // 2. 段階的にチーム詳細データを取得
  const loadProgressiveData = useCallback(async (offset = 0, limit = 10) => {
    if (!year || !state.hasMore) return;

    setState(prev => ({ ...prev, isLoadingProgressive: true }));

    try {
      const token = localStorage.getItem('authToken');
      if (!token) throw new Error('認証が必要');

      const url = `/api/admin/dashboard/${year}/progressive?offset=${offset}&limit=${limit}&includeMembers=true`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('段階的データ取得に失敗');

      const data = await response.json();
      
      setState(prev => {
        const newTeams = [...prev.progressiveTeams, ...data.teams];
        const progress = Math.min(100, (newTeams.length / prev.totalExpected) * 100);
        
        return {
          ...prev,
          progressiveTeams: newTeams,
          loadingProgress: progress,
          hasMore: data.pagination.hasMore,
          isLoadingProgressive: false
        };
      });

      // 次のチャンクを自動読み込み（遅延付き）
      if (data.pagination.hasMore && offset + limit < 50) { // 最大50件まで自動読み込み
        setTimeout(() => {
          loadProgressiveData(data.pagination.nextOffset, limit);
        }, 100); // 100ms間隔で段階的読み込み
      }

    } catch (error) {
      console.error('段階的データエラー:', error);
      setState(prev => ({
        ...prev,
        error,
        isLoadingProgressive: false
      }));
    }
  }, [year, state.hasMore]);

  // 3. 最小限データ取得後に段階的読み込み開始
  useEffect(() => {
    if (minimalData && state.hasMore && state.progressiveTeams.length === 0) {
      // 500ms後に段階的読み込み開始（初期表示を優先）
      const timer = setTimeout(() => {
        loadProgressiveData(0, 10);
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [minimalData, loadProgressiveData, state.hasMore, state.progressiveTeams.length]);

  // 4. 手動での追加読み込み
  const loadMore = useCallback(() => {
    if (!state.isLoadingProgressive && state.hasMore) {
      loadProgressiveData(state.progressiveTeams.length, 10);
    }
  }, [loadProgressiveData, state.isLoadingProgressive, state.hasMore, state.progressiveTeams.length]);

  // 5. データマージ
  const combinedData = minimalData ? {
    ...minimalData,
    teams: state.progressiveTeams,
    stats: {
      ...minimalData.stats,
      loadedTeams: state.progressiveTeams.length,
      totalTeams: state.totalExpected
    },
    progressive: {
      progress: state.loadingProgress,
      hasMore: state.hasMore,
      isLoading: state.isLoadingProgressive
    }
  } : null;

  return {
    data: combinedData,
    error: minimalError || state.error,
    isInitialLoading: state.isLoadingMinimal,
    isLoadingMore: state.isLoadingProgressive,
    loadingProgress: state.loadingProgress,
    hasMore: state.hasMore,
    loadMore,
    
    // デバッグ情報
    debug: {
      minimalDataSize: minimalData ? JSON.stringify(minimalData).length : 0,
      progressiveTeamsCount: state.progressiveTeams.length,
      totalExpected: state.totalExpected,
      stage: state.isLoadingMinimal ? 'minimal' : 
             state.isLoadingProgressive ? 'progressive' : 'complete'
    }
  };
}

/**
 * ストリーミングデータHook（WebStreamを活用）
 */
export function useStreamingData(year: number | null, enabled = true) {
  const [chunks, setChunks] = useState<any[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    if (!enabled || !year) return;

    let mounted = true;
    setIsStreaming(true);
    setError(null);

    const streamData = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) throw new Error('認証が必要');

        const response = await fetch(`/api/admin/dashboard/${year}/stream`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('ストリーミング開始に失敗');

        const reader = response.body?.getReader();
        if (!reader) throw new Error('ストリームリーダーが利用できません');

        const decoder = new TextDecoder();
        let buffer = '';

        while (mounted) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                if (mounted) {
                  setChunks(prev => [...prev, data]);
                }
              } catch (parseError) {
                console.warn('ストリームデータ解析エラー:', parseError);
              }
            }
          }
        }

      } catch (streamError) {
        console.error('ストリーミングエラー:', streamError);
        if (mounted) {
          setError(streamError);
        }
      } finally {
        if (mounted) {
          setIsStreaming(false);
        }
      }
    };

    streamData();

    return () => {
      mounted = false;
    };
  }, [year, enabled]);

  // チャンクデータを統合
  const combinedData = chunks.reduce((acc, chunk) => {
    switch (chunk.type) {
      case 'event':
        return { ...acc, event: chunk.data.event };
      case 'quick-stats':
        return { ...acc, stats: { ...acc.stats, ...chunk.data.quickStats } };
      case 'teams-partial':
      case 'teams-remaining':
        const existingTeams = acc.teams || [];
        return { ...acc, teams: [...existingTeams, ...chunk.data.teams] };
      case 'final':
        return { ...acc, ...chunk.data };
      default:
        return acc;
    }
  }, {} as any);

  return {
    data: combinedData,
    chunks,
    isStreaming,
    error,
    progress: chunks.length
  };
}