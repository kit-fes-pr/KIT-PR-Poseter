'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { LoadingInline } from '@/components/ui/Loading';
import { Area } from '@/types';
import { useFastPageTransition } from '@/lib/hooks/usePageTransition';
import YearPageSectionHeader from '@/components/admin/YearPageSectionHeader';

export default function AreasPage() {
  const router = useRouter();
  const { navigateWithPreload } = useFastPageTransition();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);
  const [teams, setTeams] = useState<Array<{
    teamId: string;
    teamCode: string;
    teamName?: string;
    areaId?: string;
    assignedArea?: string;
  }>>([]);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState<string | null>(null);
  const [editingSubmitting, setEditingSubmitting] = useState(false);
  const [form, setForm] = useState({
    areaCode: '',
    areaName: '',
    timeSlot: 'morning',
    description: '',
  });
  const [editForm, setEditForm] = useState({
    areaCode: '',
    areaName: '',
    timeSlot: 'morning',
    description: '',
  });

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
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError('');
        const token = await user.getIdToken();
        const [areasRes, teamsRes] = await Promise.all([
          fetch('/api/admin/areas', {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch('/api/admin/teams?scope=all', {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        const areasData = await areasRes.json();
        if (!areasRes.ok) {
          throw new Error(areasData.error || '配布区域の取得に失敗しました');
        }
        setAreas(areasData.areas || []);

        if (teamsRes.ok) {
          const teamsData = await teamsRes.json();
          setTeams(teamsData.teams || []);
        } else {
          const teamsData = await teamsRes.json().catch(() => ({}));
          throw new Error(teamsData.error || 'チーム情報の取得に失敗しました');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : '配布区域の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const refreshAreas = async () => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/admin/areas', {
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
    if (!user) return;

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
        body: JSON.stringify(form),
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
    if (value === 'morning' || value === '午前' || value === '午前配布') return '午前';
    if (value === 'afternoon' || value === '午後' || value === '午後配布') return '午後';
    return value;
  };

  const getAssignedTeams = (area: Area) => {
    return teams
      .filter((team) => team.areaId === area.areaId || team.assignedArea === area.areaCode)
      .map((team) => team.teamName ? `${team.teamName}（${team.teamCode}）` : team.teamCode);
  };

  const openEditModal = (area: Area) => {
    setEditingAreaId(area.areaId);
    setEditForm({
      areaCode: area.areaCode || '',
      areaName: area.areaName || '',
      timeSlot: area.timeSlot || 'morning',
      description: area.description || '',
    });
  };

  const closeEditModal = () => {
    setEditingAreaId(null);
    setEditingSubmitting(false);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingAreaId) return;

    try {
      setEditingSubmitting(true);
      setError('');
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/areas/${editingAreaId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '配布区域の更新に失敗しました');
      await refreshAreas();
      closeEditModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : '配布区域の更新に失敗しました');
    } finally {
      setEditingSubmitting(false);
    }
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
        <YearPageSectionHeader
          title="配布区域管理"
          description="すべての年度で共通の配布区域を追加、編集、削除します。"
          actions={(
            <button
              onClick={() => navigateWithPreload('/admin/event')}
              className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
            >
              年度一覧へ
            </button>
          )}
        />

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
                  placeholder="本館前"
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
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">区域コード</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">区域名</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">時間帯</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">総チーム数</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">割り当て先チーム</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">説明</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {areas.map((area) => (
                      <tr key={area.areaId}>
                        <td className="px-4 py-3 text-sm text-gray-900">{area.areaCode}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{area.areaName}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{timeSlotLabel(area.timeSlot)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{getAssignedTeams(area).length}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">
                          {getAssignedTeams(area).length > 0 ? getAssignedTeams(area).join(' / ') : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500">{area.description || '-'}</td>
                        <td className="px-4 py-3 text-right text-sm">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditModal(area)}
                              className="text-indigo-600 hover:text-indigo-900"
                            >
                              編集
                            </button>
                            <button
                              onClick={() => handleDelete(area.areaId)}
                              className="text-red-600 hover:text-red-900"
                            >
                              削除
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {editingAreaId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-lg">
              <h2 className="mb-4 text-lg font-medium text-gray-900">配布区域を編集</h2>
              <form onSubmit={handleUpdate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">区域コード *</label>
                  <input
                    value={editForm.areaCode}
                    onChange={(e) => setEditForm({ ...editForm, areaCode: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">区域名 *</label>
                  <input
                    value={editForm.areaName}
                    onChange={(e) => setEditForm({ ...editForm, areaName: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">時間帯 *</label>
                  <select
                    value={editForm.timeSlot}
                    onChange={(e) => setEditForm({ ...editForm, timeSlot: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                  >
                    <option value="morning">午前</option>
                    <option value="afternoon">午後</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">説明</label>
                  <textarea
                    value={editForm.description}
                    onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                    className="w-full rounded-md border border-gray-300 px-3 py-2"
                    rows={4}
                  />
                </div>
                <div className="flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={closeEditModal}
                    className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={editingSubmitting}
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {editingSubmitting ? '更新中...' : '更新'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
