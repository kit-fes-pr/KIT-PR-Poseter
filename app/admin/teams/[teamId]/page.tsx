'use client';

import useSWR from 'swr';
import { useRouter } from 'next/navigation';
import { useEffect, use as usePromise } from 'react';

const fetcher = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('認証が必要です');
  return res.json();
};

export default function TeamDetail({ params }: { params: Promise<{ teamId: string }> }) {
  const router = useRouter();
  const { teamId } = usePromise(params);

  useEffect(() => {
    const token = localStorage.getItem('authToken');
    if (!token) router.push('/admin');
  }, [router]);

  const { data, error } = useSWR(`/api/admin/teams/${teamId}/stores`, fetcher);

  const stores = data?.stores || [];
  const completed = stores.filter((s: any) => s.distributionStatus === 'completed');
  const failed = stores.filter((s: any) => s.distributionStatus === 'failed');
  const revisit = stores.filter((s: any) => s.distributionStatus === 'revisit');

  const StatusBadge = ({ status }: { status: string }) => {
    const map: Record<string, string> = {
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      revisit: 'bg-yellow-100 text-yellow-800',
      pending: 'bg-gray-100 text-gray-800',
    };
    const label: Record<string, string> = {
      completed: '配布済み',
      failed: '配布不可',
      revisit: '要再訪問',
      pending: '未配布',
    };
    return <span className={`inline-block px-2 py-1 text-xs rounded-full ${map[status] || map.pending}`}>{label[status] || label.pending}</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <h1 className="text-xl font-semibold">チーム詳細</h1>
            <button onClick={() => router.push('/admin/dashboard')} className="px-4 py-2 text-sm border rounded-md">戻る</button>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <h2 className="text-lg font-medium">{data?.team?.teamName}（{data?.team?.teamCode}）</h2>
          <p className="text-sm text-gray-600 mt-1">担当区域: {data?.team?.assignedArea}</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
            <div>
              <p className="text-sm text-gray-600">総件数</p>
              <p className="text-2xl font-bold">{data?.summary?.total || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">配布済み</p>
              <p className="text-2xl font-bold text-green-600">{data?.summary?.completed || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">配布不可</p>
              <p className="text-2xl font-bold text-red-600">{data?.summary?.failed || 0}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">要再訪問</p>
              <p className="text-2xl font-bold text-yellow-600">{data?.summary?.revisit || 0}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-3">配布済み</h3>
            <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
              {completed.map((s: any) => (
                <div key={s.storeId} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{s.storeName}</p>
                    <StatusBadge status={s.distributionStatus} />
                  </div>
                  <p className="text-sm text-gray-600">{s.address}</p>
                  <p className="text-xs text-gray-500 mt-1">配布枚数: {s.distributedCount || 0}</p>
                  {s.notes && (
                    <p className="text-xs text-gray-500 mt-1">備考: {s.notes}</p>
                  )}
                </div>
              ))}
              {completed.length === 0 && <p className="text-sm text-gray-500">なし</p>}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-3">配布不可</h3>
            <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
              {failed.map((s: any) => (
                <div key={s.storeId} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{s.storeName}</p>
                    <StatusBadge status={s.distributionStatus} />
                  </div>
                  <p className="text-sm text-gray-600">{s.address}</p>
                  <p className="text-xs text-gray-500 mt-1">理由: {s.failureReason || '-'}</p>
                  {s.notes && (
                    <p className="text-xs text-gray-500 mt-1">備考: {s.notes}</p>
                  )}
                </div>
              ))}
              {failed.length === 0 && <p className="text-sm text-gray-500">なし</p>}
            </div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-medium mb-3">要再訪問</h3>
            <div className="space-y-3 max-h-[60vh] overflow-auto pr-2">
              {revisit.map((s: any) => (
                <div key={s.storeId} className="border rounded p-3">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{s.storeName}</p>
                    <StatusBadge status={s.distributionStatus} />
                  </div>
                  <p className="text-sm text-gray-600">{s.address}</p>
                  {s.notes && (
                    <p className="text-xs text-gray-500 mt-1">備考: {s.notes}</p>
                  )}
                </div>
              ))}
              {revisit.length === 0 && <p className="text-sm text-gray-500">なし</p>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
