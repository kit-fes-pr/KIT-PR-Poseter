'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const fetcher = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('認証が必要です');
  return res.json();
};

export default function AdminEventIndex() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [latest, setLatest] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem('authToken');
      if (!token) return router.push('/admin');
      try {
        const v = await fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } });
        if (!v.ok) throw new Error('unauthorized');
        const data = await v.json();
        if (!data?.user?.isAdmin) throw new Error('forbidden');
        setIsAdmin(true);
        const { events, latest } = await fetcher('/api/admin/events');
        setEvents(events || []);
        setLatest(latest || null);
      } catch (e) {
        localStorage.removeItem('authToken');
        router.push('/admin');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router]);

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">イベント管理</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  localStorage.removeItem('authToken');
                  router.push('/admin');
                }}
                className="px-4 py-2 bg-gray-600 text-white rounded-md text-sm"
              >ログアウト</button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {loading ? (
          <p className="text-sm text-gray-500">読み込み中...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : (
          <div className="space-y-6">
            {latest && (
              <div className="bg-white p-6 rounded-lg shadow">
                <h2 className="text-lg font-medium mb-2">最新年度</h2>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold">{latest.year} 年度</p>
                    <p className="text-sm text-gray-600">{latest.eventName || '学外配布'}</p>
                  </div>
                  <button
                    onClick={() => router.push(`/admin/event/${latest.year}`)}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm"
                  >この年度を開く</button>
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-lg shadow">
              <h2 className="text-lg font-medium mb-4">年度一覧</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {events.map((ev) => (
                  <div key={ev.id} className="border border-gray-200 rounded-lg p-4 flex items-center justify-between">
                    <div>
                      <p className="text-base font-semibold">{ev.year} 年度</p>
                      <p className="text-sm text-gray-500">{ev.eventName || '学外配布'} / {ev.distributionDate ? new Date(ev.distributionDate._seconds * 1000).toLocaleDateString('ja-JP') : '-'}</p>
                    </div>
                    <button onClick={() => router.push(`/admin/event/${ev.year}`)} className="px-3 py-1 border rounded-md text-sm">開く</button>
                  </div>
                ))}
                {events.length === 0 && (
                  <p className="text-sm text-gray-500">イベントが登録されていません</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

