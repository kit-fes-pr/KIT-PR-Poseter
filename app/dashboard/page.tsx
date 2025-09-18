'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import useSWR from 'swr';
import { Store, StoreFormData } from '@/types';

const fetcher = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!response.ok) throw new Error('認証が必要です');
  return response.json();
};

export default function Dashboard() {
  const router = useRouter();
  const [isAddingStore, setIsAddingStore] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { data: storesData, mutate } = useSWR('/api/stores', fetcher);
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<StoreFormData>();

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) {
      router.push('/');
    }
  }, [router]);

  const filteredStores = storesData?.stores?.filter((store: Store) => {
    const matchesStatus = filterStatus === 'all' || store.distributionStatus === filterStatus;
    const matchesSearch = store.storeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         store.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  }) || [];

  const onSubmitStore = async (data: StoreFormData) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/stores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        reset();
        setIsAddingStore(false);
        mutate();
      } else {
        const error = await response.json();
        alert(error.error || '店舗の登録に失敗しました');
      }
    } catch {
      alert('店舗の登録に失敗しました');
    }
  };

  const updateStoreStatus = async (storeId: string, status: Store['distributionStatus'], count?: number, reason?: string) => {
    try {
      const token = localStorage.getItem('authToken');
      const response = await fetch(`/api/stores/${storeId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          distributionStatus: status,
          distributedCount: count || 0,
          failureReason: reason,
        }),
      });

      if (response.ok) {
        mutate();
      } else {
        const error = await response.json();
        alert(error.error || '更新に失敗しました');
      }
    } catch {
      alert('更新に失敗しました');
    }
  };

  const getStatusColor = (status: Store['distributionStatus']) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'revisit': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: Store['distributionStatus']) => {
    switch (status) {
      case 'completed': return '配布済み';
      case 'failed': return '配布不可';
      case 'revisit': return '要再訪問';
      default: return '未配布';
    }
  };

  const totalStores = filteredStores.length;
  const completedStores = filteredStores.filter((s: Store) => s.distributionStatus === 'completed').length;
  const progressRate = totalStores > 0 ? (completedStores / totalStores) * 100 : 0;


  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">配布管理ダッシュボード</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsAddingStore(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm"
              >
                店舗を追加
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('authToken');
                  router.push('/');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm"
              >
                ログアウト
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">配布進捗</h3>
            <p className="text-3xl font-bold text-indigo-600">{progressRate.toFixed(1)}%</p>
            <p className="text-sm text-gray-500">{completedStores} / {totalStores} 店舗</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">配布済み店舗</h3>
            <p className="text-3xl font-bold text-green-600">{completedStores}</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium">残り店舗</h3>
            <p className="text-3xl font-bold text-gray-600">{totalStores - completedStores}</p>
          </div>
        </div>

        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
              <div className="flex space-x-3">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                >
                  <option value="all">すべて</option>
                  <option value="pending">未配布</option>
                  <option value="completed">配布済み</option>
                  <option value="failed">配布不可</option>
                  <option value="revisit">要再訪問</option>
                </select>
                <input
                  type="text"
                  placeholder="店名・住所で検索"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="overflow-hidden">
            <div className="space-y-2 p-4">
              {filteredStores.map((store: Store) => (
                <div key={store.storeId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex-1">
                      <h3 className="text-lg font-medium">{store.storeName}</h3>
                      <p className="text-gray-600">{store.address}</p>
                      <span className={`inline-block px-2 py-1 text-xs rounded-full ${getStatusColor(store.distributionStatus)}`}>
                        {getStatusText(store.distributionStatus)}
                      </span>
                    </div>
                    <div className="mt-3 sm:mt-0 sm:ml-4 flex space-x-2">
                      {store.distributionStatus === 'pending' && (
                        <>
                          <button
                            onClick={() => {
                              const count = prompt('配布枚数を入力してください:', '1');
                              if (count) updateStoreStatus(store.storeId, 'completed', parseInt(count));
                            }}
                            className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                          >
                            配布完了
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt('配布不可理由を選択してください\n1: 不在\n2: 断られた\n3: 閉店\n4: その他', '1');
                              const reasons = ['absent', 'refused', 'closed', 'other'];
                              if (reason && ['1','2','3','4'].includes(reason)) {
                                updateStoreStatus(store.storeId, 'failed', 0, reasons[parseInt(reason)-1]);
                              }
                            }}
                            className="px-3 py-1 bg-red-600 text-white rounded text-sm"
                          >
                            配布不可
                          </button>
                          <button
                            onClick={() => updateStoreStatus(store.storeId, 'revisit')}
                            className="px-3 py-1 bg-yellow-600 text-white rounded text-sm"
                          >
                            要再訪問
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {isAddingStore && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h2 className="text-lg font-medium mb-4">新しい店舗を追加</h2>
            <form onSubmit={handleSubmit(onSubmitStore)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">店名</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  {...register('storeName', { required: '店名は必須です' })}
                />
                {errors.storeName && (
                  <p className="text-red-600 text-sm">{errors.storeName.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">住所</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  {...register('address', { required: '住所は必須です' })}
                />
                {errors.address && (
                  <p className="text-red-600 text-sm">{errors.address.message}</p>
                )}
              </div>
              <div className="flex space-x-3">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-md disabled:opacity-50"
                >
                  {isSubmitting ? '追加中...' : '追加'}
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingStore(false)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}