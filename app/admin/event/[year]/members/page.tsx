'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, signOut } from 'firebase/auth';

interface Member {
  memberId: string;
  name: string;
  section: string;
  grade: number;
  availableTime: 'morning' | 'afternoon' | 'both' | 'pr' | 'other';
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
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  type ImportResults = { success: number; failed: number; errors: string[] };
  const [importResults, setImportResults] = useState<ImportResults | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const handleLogout = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('authToken');
      router.push('/admin');
    } catch (error) {
      console.error('ログアウトエラー:', error);
      localStorage.removeItem('authToken');
      router.push('/admin');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setImportResults(null);
    } else {
      alert('CSVファイルを選択してください');
    }
  };

  const parseCSV = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const headers = lines[0].split(',').map(h => h.trim());
    
    return lines.slice(1).map(line => {
      const values = line.split(',').map(v => v.trim());
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || '';
      });
      return {
        name: row['名前'] || row['name'] || '',
        section: row['所属セクション'] || row['section'] || '',
        availableTime: row['参加可能時間帯'] || row['availableTime'] || '',
        grade: parseInt(row['学年'] || row['grade'] || '0')
      };
    });
  };

  const handleImport = async () => {
    if (!csvFile) {
      alert('CSVファイルを選択してください');
      return;
    }

    setImporting(true);
    try {
      const text = await csvFile.text();
      const csvData = parseCSV(text);
      
      const token = localStorage.getItem('authToken');
      const response = await fetch('/api/admin/members/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ csvData, year })
      });

      const result = await response.json();
      if (response.ok) {
        setImportResults(result.results);
        await loadMembers();
        setCsvFile(null);
        // ファイル入力をリセット
        const fileInput = document.getElementById('csvFile') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        alert(result.error || 'インポートに失敗しました');
      }
    } catch (error) {
      console.error('インポートエラー:', error);
      alert('インポートに失敗しました');
    } finally {
      setImporting(false);
    }
  };

  const getTimeSlotBadge = (timeSlot: string) => {
    const config = {
      morning: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: '午前' },
      afternoon: { bg: 'bg-purple-100', text: 'text-purple-800', label: '午後' },
      both: { bg: 'bg-green-100', text: 'text-green-800', label: '両方' },
      pr: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'PR' },
      other: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'その他' },
    };
    const { bg, text, label } = config[timeSlot as keyof typeof config] || config.other;
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${bg} ${text}`}>
        {label}
      </span>
    );
  };

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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">読み込み中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold">{year} 年度 メンバー管理</h1>
            </div>
            <div className="flex items-center space-x-2">
              <button onClick={() => router.push('/admin/event')} className="px-3 py-2 border rounded-md text-sm sm:block hidden">年度一覧</button>
              <button onClick={() => router.push(`/admin/event/${year}`)} className="px-3 py-2 border rounded-md text-sm sm:block hidden">イベント管理</button>
              <button onClick={() => router.push(`/admin/event/${year}/form`)} className="px-3 py-2 border rounded-md text-sm sm:block hidden">フォーム管理</button>
              <div className="relative">
                <button className="px-3 py-2 border rounded-md text-sm" onClick={() => setMenuOpen(!menuOpen)}>≡</button>
                {menuOpen && (
                  <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded shadow-md z-10">
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 sm:hidden" onClick={() => router.push('/admin/event')}>年度一覧</button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 sm:hidden" onClick={() => router.push(`/admin/event/${year}`)}>イベント管理</button>
                    <button className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 sm:hidden" onClick={() => router.push(`/admin/event/${year}/form`)}>フォーム管理</button>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 text-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                  <path d="M13 3a1 1 0 011 1v4a1 1 0 11-2 0V5H7a1 1 0 00-1 1v12a1 1 0 001 1h5v-3a1 1 0 112 0v4a1 1 0 01-1 1H7a3 3 0 01-3-3V6a3 3 0 013-3h6z" />
                  <path d="M16.293 8.293a1 1 0 011.414 0L21 11.586a2 2 0 010 2.828l-3.293 3.293a1 1 0 11-1.414-1.414L17.586 14H11a1 1 0 110-2h6.586l-1.293-1.293a1 1 0 010-1.414z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        {/* CSVインポートセクション */}
        <div className="bg-white shadow rounded-lg mb-6 p-6">
          <h2 className="text-lg font-medium mb-4">CSVインポート</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                CSVファイル形式例:
              </label>
              <div className="bg-gray-50 p-3 rounded text-sm">
                <code>名前,所属セクション,参加可能時間帯,学年</code><br/>
                <code>田中太郎,企画部,午前,3</code><br/>
                <code>佐藤花子,広報部,午後,2</code><br/>
                <code>山田次郎,総務部,両方,4</code>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              />
              <button
                onClick={handleImport}
                disabled={!csvFile || importing}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {importing ? 'インポート中...' : 'インポート'}
              </button>
            </div>

            {importResults && (
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-blue-800">インポート結果</h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>成功: {importResults.success}件</p>
                  <p>失敗: {importResults.failed}件</p>
                  {importResults.errors.length > 0 && (
                    <div className="mt-2">
                      <p className="font-medium">エラー詳細:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {importResults.errors.map((error: string, index: number) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

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
                        {getTimeSlotBadge(member.availableTime)}
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
