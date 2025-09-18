'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cardo } from 'next/font/google';

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
  const [isCreating, setIsCreating] = useState(false);
  const [form, setForm] = useState<{ year: string; eventName: string; distributionDate: string }>({ year: '', eventName: '', distributionDate: '' });
  const [menuEventId, setMenuEventId] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<any | null>(null);
  const [editForm, setEditForm] = useState<{ eventName: string; distributionDate: string }>({ eventName: '', distributionDate: '' });

  // Close popup menu on outside click
  useEffect(() => {
    if (!menuEventId) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest('[data-menu-root]')) setMenuEventId(null);
    };
    document.addEventListener('mousedown', onDown as any);
    return () => document.removeEventListener('mousedown', onDown as any);
  }, [menuEventId]);

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
              <h1 className="text-xl font-semibold">学外配布年度管理</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm"
              >学外配布年度を追加</button>
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
                  <div
                    key={ev.id}
                    onClick={() => router.push(`/admin/event/${ev.year}`)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/admin/event/${ev.year}`); } }}
                    className="border border-gray-200 rounded-lg p-4 bg-white cursor-pointer transition transform duration-150 ease-out hover:shadow-md hover:-translate-y-0.5 md:hover:shadow-lg md:hover:-translate-y-1 active:translate-y-0 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-base font-semibold">{ev.year} 年度</p>
                        <p className="text-sm text-gray-500">{ev.eventName || '学外配布'} / {ev.distributionDate ? new Date(ev.distributionDate._seconds ? ev.distributionDate._seconds * 1000 : ev.distributionDate).toLocaleDateString('ja-JP') : '-'}</p>
                      </div>
                      <div className="relative" data-menu-root onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                        <button
                          className="px-2 py-1 border rounded text-sm"
                          onClick={(e) => { e.stopPropagation(); setMenuEventId(menuEventId === ev.id ? null : ev.id); }}
                          aria-label="メニュー"
                          title="メニュー"
                        >≡</button>
                        {menuEventId === ev.id && (
                          <div className="absolute right-0 mt-2 w-32 bg-white border border-gray-200 rounded shadow-md z-10">
                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={(e) => { e.stopPropagation(); router.push(`/admin/event/${ev.year}`); setMenuEventId(null); }}>開く</button>
                            <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50" onClick={() => {
                              setEditTarget(ev);
                              const d = ev.distributionDate ? (ev.distributionDate._seconds ? new Date(ev.distributionDate._seconds * 1000) : new Date(ev.distributionDate)) : null;
                              setEditForm({ eventName: ev.eventName || '', distributionDate: d ? d.toISOString().slice(0,10) : '' });
                              setIsEditing(true);
                              setMenuEventId(null);
                            }}>編集</button>
                            <button className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={async (e) => {
                              e.stopPropagation();
                              if (!confirm(`${ev.year}年度のイベントを削除しますか？関連データがある場合は削除できません。`)) return;
                              try {
                                const token = localStorage.getItem('authToken');
                                const res = await fetch('/api/admin/events', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: ev.id }) });
                                const data = await res.json();
                                if (!res.ok) throw new Error(data.error || '削除に失敗しました');
                                const { events, latest } = await fetcher('/api/admin/events');
                                setEvents(events || []);
                                setLatest(latest || null);
                                setMenuEventId(null);
                              } catch (e: any) {
                                alert(e.message || '削除に失敗しました');
                              }
                            }}>削除</button>
                          </div>
                        )}
                      </div>
                    </div>
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

      {isCreating && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">イベントを追加</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">配布年度（西暦）</label>
                <input
                  type="number"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  value={form.year}
                  onChange={(e) => setForm({ ...form, year: e.target.value })}
                  placeholder="例: 2025"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">イベント名（任意）</label>
                <input
                  type="text"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  value={form.eventName}
                  onChange={(e) => setForm({ ...form, eventName: e.target.value })}
                  placeholder="例: 工大祭2025 学外配布"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">配布日</label>
                <input
                  type="date"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  value={form.distributionDate}
                  onChange={(e) => setForm({ ...form, distributionDate: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsCreating(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">キャンセル</button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken');
                    const res = await fetch('/api/admin/events', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ year: Number(form.year), eventName: form.eventName, distributionDate: form.distributionDate }),
                    });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '作成に失敗しました');
                    // 再読み込み
                    const { events, latest } = await fetcher('/api/admin/events');
                    setEvents(events || []);
                    setLatest(latest || null);
                    setIsCreating(false);
                    setForm({ year: '', eventName: '', distributionDate: '' });
                  } catch (e: any) {
                    alert(e.message || '作成に失敗しました');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
                disabled={!form.year || !form.distributionDate}
              >作成</button>
            </div>
          </div>
        </div>
      )}

      {isEditing && editTarget && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold mb-4">イベントを編集（{editTarget.year}年度）</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">イベント名</label>
                <input type="text" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={editForm.eventName} onChange={(e) => setEditForm({ ...editForm, eventName: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">配布日</label>
                <input type="date" className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2" value={editForm.distributionDate} onChange={(e) => setEditForm({ ...editForm, distributionDate: e.target.value })} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setIsEditing(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md">キャンセル</button>
              <button
                onClick={async () => {
                  try {
                    const token = localStorage.getItem('authToken');
                    const res = await fetch('/api/admin/events', { method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ id: editTarget.id, eventName: editForm.eventName, distributionDate: editForm.distributionDate }) });
                    const data = await res.json();
                    if (!res.ok) throw new Error(data.error || '更新に失敗しました');
                    const { events, latest } = await fetcher('/api/admin/events');
                    setEvents(events || []);
                    setLatest(latest || null);
                    setIsEditing(false);
                    setEditTarget(null);
                  } catch (e: any) {
                    alert(e.message || '更新に失敗しました');
                  }
                }}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md"
              >保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
