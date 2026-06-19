'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { LoadingInline } from '@/components/ui/Loading';
import YearPageSectionHeader from '@/components/admin/YearPageSectionHeader';
import { formatAvailabilitySlotLabel } from '@/lib/utils/availability';

interface Member {
  memberId: string;
  name: string;
  section: string;
  grade: number;
  availableSlots?: string[];
  source: 'csv' | 'form' | 'manual';
  teamId?: string;
  createdAt: Date;
}

const fetcher = async (url: string) => {
  const token = localStorage.getItem('authToken');
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('認証が必要です');
  return res.json();
};

export default function MembersPage() {
  const router = useRouter();
  const params = useParams<{ year: string }>();
  const year = params?.year;
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Firebase認証状態を監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        localStorage.removeItem('authToken');
        router.push('/admin');
      }
    });
    return () => unsubscribe();
  }, [router]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await fetcher(`/api/admin/members?year=${year}`);
      setMembers(data.members || []);
    } catch (error) {
      console.error('メンバー読み込みエラー:', error);
    }
  }, [year]);

  // 管理者認証とデータ読み込み
  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem('authToken');
        if (!token) return router.push('/admin');
        
        const v = await fetch('/api/auth/verify', { headers: { Authorization: `Bearer ${token}` } });
        if (!v.ok) throw new Error('unauthorized');
        const data = await v.json();
        if (!data?.user?.isAdmin) throw new Error('forbidden');
        setIsAdmin(true);

        await loadMembers();
      } catch (error) {
        console.error('エラー内容:', error);
        localStorage.removeItem('authToken');
        router.push('/admin');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [router, year, loadMembers]);

  const getSourceBadge = (source: string) => {
    const config = {
      csv: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'CSV' },
      form: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'フォーム' },
      manual: { bg: 'bg-gray-100', text: 'text-gray-800', label: '手動' }
    };
    const { bg, text, label } = config[source as keyof typeof config] || config.manual;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${bg} ${text}`}>
        {label}
      </span>
    );
  };

  if (!isAdmin || loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <LoadingInline size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8 space-y-6">
        <YearPageSectionHeader
          title={`${year} 年度 メンバー一覧`}
          description="参加メンバー全体の確認を行います。"
          actions={(
            <>
              <button
                onClick={() => router.push(`/admin/event/${year}`)}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
              >
                イベント管理へ戻る
              </button>
              <button
                onClick={() => router.push(`/admin/event/${year}/team`)}
                className="px-4 py-2 rounded-md border border-gray-300 bg-white text-sm text-gray-700 hover:bg-gray-50"
              >
                チーム管理へ
              </button>
            </>
          )}
        />

        {/* メンバー一覧 */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 border-b border-gray-200 sm:px-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                メンバー一覧 ({members.length}名)
              </h3>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">氏名</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">学年</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">セクション</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">参加可能時間帯</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">登録方法</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">チーム割り当て</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {members
                  .sort((a, b) => (b.grade - a.grade) || a.name.localeCompare(b.name, 'ja'))
                  .map((member) => (
                    <tr key={member.memberId}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {member.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.grade}年
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.section}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex flex-wrap gap-2">
                          {(member.availableSlots || []).length > 0 ? (
                            member.availableSlots!.map((slot) => (
                              <span
                                key={slot}
                                className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800"
                              >
                                {formatAvailabilitySlotLabel(slot)}
                              </span>
                            ))
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                              未設定
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getSourceBadge(member.source)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {member.teamId ? (
                          <span className="text-indigo-600 font-medium">{member.teamId}</span>
                        ) : (
                          <span className="text-gray-400">未割り当て</span>
                        )}
                      </td>
                    </tr>
                  ))}
                {members.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-6 text-center text-sm text-gray-400">
                      メンバーが登録されていません
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
