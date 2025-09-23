'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';

interface Area {
  areaId: string;
  areaCode: string;
  areaName: string;
  timeSlot: 'morning' | 'afternoon';
  description?: string;
  eventId: string;
  createdAt: Date;
}

export default function AreaManagementPage({ params }: { params: Promise<{ year: string }> }) {
  const router = useRouter();
  const [resolvedParams, setResolvedParams] = useState<{ year: string } | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState({
    areaCode: '',
    areaName: '',
    timeSlot: 'morning' as 'morning' | 'afternoon',
    description: ''
  });

  useEffect(() => { params.then(setResolvedParams); }, [params]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
      if (!u) {
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!resolvedParams || !user || authLoading) return;
    loadAreas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedParams, user, authLoading]);

  const loadAreas = async () => {
    if (!resolvedParams || !user) return;
    try {
      setLoading(true);
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/areas?eventId=kohdai${resolvedParams.year}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setAreas(data.areas || []);
      } else {
        throw new Error('配布区域の取得に失敗しました');
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '配布区域の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resolvedParams || !user) return;

    try {
      const token = await user.getIdToken();
      const method = editingArea ? 'PUT' : 'POST';
      const url = editingArea ? `/api/admin/areas/${editingArea.areaId}` : '/api/admin/areas';
      
      const body = {
        ...formData,
        eventId: `kohdai${resolvedParams.year}`
      };

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        await loadAreas();
        resetForm();
        setShowCreateModal(false);
        setEditingArea(null);
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || '保存に失敗しました');
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '保存に失敗しました');
    }
  };

  const handleDelete = async (areaId: string) => {
    if (!confirm('この配布区域を削除しますか？')) return;
    if (!user) return;

    try {
      const token = await user.getIdToken();
      const res = await fetch(`/api/admin/areas/${areaId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.ok) {
        await loadAreas();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || '削除に失敗しました');
      }
    } catch (e) {
      console.error(e);
      setError(e instanceof Error ? e.message : '削除に失敗しました');
    }
  };

  const resetForm = () => {
    setFormData({
      areaCode: '',
      areaName: '',
      timeSlot: 'morning',
      description: ''
    });
  };

  const openEditModal = (area: Area) => {
    setEditingArea(area);
    setFormData({
      areaCode: area.areaCode,
      areaName: area.areaName,
      timeSlot: area.timeSlot,
      description: area.description || ''
    });
    setShowCreateModal(true);
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* ヘッダー */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                配布区域管理 ({resolvedParams?.year}年度)
              </h1>
              <p className="mt-1 text-sm text-gray-600">
                配布区域の作成・編集・削除を行います
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetForm();
                  setEditingArea(null);
                  setShowCreateModal(true);
                }}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
              >
                新規区域作成
              </button>
              <Link
                href={`/admin/event/${resolvedParams?.year}`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
              >
                イベント管理に戻る
              </Link>
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* 配布区域一覧 */}
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">配布区域一覧</h3>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">登録済みの配布区域</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    区域コード
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    区域名
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    時間帯
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    説明
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {areas.map((area) => (
                  <tr key={area.areaId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {area.areaCode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {area.areaName}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        area.timeSlot === 'morning' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-orange-100 text-orange-800'
                      }`}>
                        {area.timeSlot === 'morning' ? '午前' : '午後'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                      {area.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => openEditModal(area)}
                        className="text-indigo-600 hover:text-indigo-900 mr-4"
                      >
                        編集
                      </button>
                      <button
                        onClick={() => handleDelete(area.areaId)}
                        className="text-red-600 hover:text-red-900"
                      >
                        削除
                      </button>
                    </td>
                  </tr>
                ))}
                {areas.length === 0 && (
                  <tr>
                    <td className="px-6 py-12 text-center text-sm text-gray-500" colSpan={5}>
                      配布区域が登録されていません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* 作成・編集モーダル */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <form onSubmit={handleSubmit}>
                <div className="mt-3">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">
                      {editingArea ? '配布区域編集' : '新規配布区域作成'}
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingArea(null);
                        resetForm();
                      }}
                      className="text-gray-400 hover:text-gray-600"
                    >
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        区域コード *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.areaCode}
                        onChange={(e) => setFormData({ ...formData, areaCode: e.target.value })}
                        placeholder="例: 午前1"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        区域名 *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.areaName}
                        onChange={(e) => setFormData({ ...formData, areaName: e.target.value })}
                        placeholder="例: 午前1区域"
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        時間帯 *
                      </label>
                      <select
                        required
                        value={formData.timeSlot}
                        onChange={(e) => setFormData({ ...formData, timeSlot: e.target.value as 'morning' | 'afternoon' })}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="morning">午前</option>
                        <option value="afternoon">午後</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        説明
                      </label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="区域の詳細説明（任意）"
                        rows={3}
                        className="block w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-3 mt-6">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateModal(false);
                        setEditingArea(null);
                        resetForm();
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700"
                    >
                      {editingArea ? '更新' : '作成'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}