'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LoadingInline } from '@/components/ui/Loading';
import { Area } from '@/types';
import { useFastPageTransition } from '@/lib/hooks/usePageTransition';

export default function AreasPage({ params }: { params: Promise<{ year: string }> }) {
  const router = useRouter();
  const { navigateWithPreload } = useFastPageTransition();
  const [resolvedParams, setResolvedParams] = useState<{ year: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    areaCode: '',
    areaName: '',
    timeSlot: 'morning',
    description: '',
  });

  useEffect(() => {
    params.then(setResolvedParams);
  }, [params]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!resolvedParams || !user) return;

    const loadAreas = async () => {
      try {
        setLoading(true);
        setError('');
        const token = await user.getIdToken();
        const eventId = `kohdai${resolvedParams.year}`;
        const res = await fetch(`/api/admin/areas?eventId=${eventId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || '配布区域の取得に失敗しました');
        }
        setAreas(data.areas || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : '配布区域の取得に失敗しました');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    loadAreas();
  }, [resolvedParams, user]);

  const refreshAreas = async () => {
    if (!resolvedParams || !user) return;
    const token = await user.getIdToken();
    const eventId = `kohdai${resolvedParams.year}`;
    const res = await fetch(`/api/admin/areas?eventId=${eventId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || '配布区域の取得に失敗しました');
    }
    setAreas(data.areas || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedParams || !user) return;

    try {
      setSubmitting(true);
      setError('');
      const token = await user.getIdToken();
      const res = await fetch('/api/admin/areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...form,
          eventId: `kohdai${resolvedParams.year}`,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '配布区域の作成に失敗しました');
      setForm({ areaCode: '', areaName: '', timeSlot: 'morning', description: '' });
      await refreshAreas();
    } catch (err) {
      setError(err instanceof Error ? err.message : '配布区域の作成に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (areaId: string) => {
    if (!user || !confirm('この配布区域を削除しますか？')) return;
    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/areas/${areaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '削除に失敗しました');
      await refreshAreas();
    } catch (err) {
      setError(err instanceof Error ? err.message : '削除に失敗しました');
    }
  };

  const timeSlotLabel = (value: string) => {
    if (value === 'morning') return '午前';
    if (value === 'afternoon') return '午後';
    return value;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingInline size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
        <div className="space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              配布区域管理 ({resolvedParams?.year}年度)
            </h1>
            <p className="mt-1 text-sm text-gray-600">
              配布区域の追加と一覧確認を行います。
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => navigateWithPreload(`/admin/event/${resolvedParams?.year}`)}
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              イベント管理へ戻る
            </button>
            <button
              onClick={() => navigateWithPreload(`/admin/event/${resolvedParams?.year}/team`)}
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              チーム管理へ
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1 bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">新しい配布区域を追加</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">区域コード *</label>
                <input
                  value={form.areaCode}
                  onChange={(e) => setForm({ ...form, areaCode: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="A-01"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">区域名 *</label>
                <input
                  value={form.areaName}
                  onChange={(e) => setForm({ ...form, areaName: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  placeholder="本館1F"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">時間帯 *</label>
                <select
                  value={form.timeSlot}
                  onChange={(e) => setForm({ ...form, timeSlot: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                >
                  <option value="morning">午前</option>
                  <option value="afternoon">午後</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full rounded-md border border-gray-300 px-3 py-2"
                  rows={4}
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-md bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {submitting ? '作成中...' : '配布区域を作成'}
              </button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">配布区域一覧</h2>
              <span className="text-sm text-gray-500">{areas.length} 件</span>
            </div>

            {areas.length === 0 ? (
              <div className="py-12 text-center text-gray-500">
                配布区域が登録されていません
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">区域コード</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">区域名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間帯</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">説明</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {areas.map((area) => (
                      <tr key={area.areaId}>
                        <td className="px-4 py-3 text-sm text-gray-900">{area.areaCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{area.areaName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{timeSlotLabel(area.timeSlot)}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{area.description || '-'}</td>
                        <td className="px-4 py-3 text-sm">
                          <button
                            onClick={() => handleDelete(area.areaId)}
                            className="text-red-600 hover:text-red-800"
                          >
                            削除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
