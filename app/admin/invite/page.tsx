'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, sendPasswordResetEmail, User } from 'firebase/auth';
import { LoadingInline } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import { ADMIN_EMAIL_PATTERN } from '@/lib/utils/admin/invites';

export default function AdminInvitePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    email: string;
    operation: 'created' | 'updated';
  } | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (!currentUser) {
        localStorage.removeItem('authToken');
        router.push('/admin/login');
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        const response = await fetch('/api/auth/verify', {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!response.ok) {
          localStorage.removeItem('authToken');
          router.push('/admin/login');
          return;
        }

        const data = await response.json();
        if (!data?.user?.isAdmin) {
          localStorage.removeItem('authToken');
          router.push('/admin/login');
          return;
        }

        localStorage.setItem('authToken', token);
        setLoading(false);
      } catch {
        localStorage.removeItem('authToken');
        router.push('/admin/login');
      }
    });

    return () => unsubscribe();
  }, [router]);

  const submitInvite = async () => {
    const normalizedEmail = email.trim();
    if (!user || !normalizedEmail) return;

    if (!ADMIN_EMAIL_PATTERN.test(normalizedEmail)) {
      setError('kanazawa-it.ac.jp のメールアドレスを入力してください');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      const token = await user.getIdToken();
      const response = await fetch('/api/admin/invites', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: normalizedEmail }),
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || '招待に失敗しました');
      }

      await sendPasswordResetEmail(auth, normalizedEmail);
      setSuccess(data.invite || { email: normalizedEmail, operation: 'created' });
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '招待に失敗しました');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingInline size="lg" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <p className="text-sm font-medium text-gray-500">Admin</p>
          <h1 className="text-2xl font-semibold text-gray-900">ユーザー招待</h1>
          <p className="mt-1 text-sm text-gray-600">
            メールアドレスを入力すると、Firebase からパスワード再設定メールを送信します。
          </p>
        </div>

        {error && (
          <div className="mb-6 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-gray-900">メールアドレスを招待</h2>
            <p className="mt-1 text-sm text-gray-600">
              Firebase
              からパスワード再設定メールを送信します。初回はメール内リンクからパスワードを設定します。
            </p>
          </div>

          <label className="block text-sm font-medium text-gray-700">メールアドレス</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@sub.kanazawa-it.ac.jp"
            className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-3 text-sm"
          />

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={submitInvite}
              disabled={!email || submitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? '送信中...' : '招待メールを送信'}
            </button>
          </div>
        </div>
      </div>

      <Modal open={Boolean(success)} onClose={() => setSuccess(null)} panelClassName="max-w-md p-6">
        {success && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">招待を送信しました</h2>
            <p className="mt-3 text-sm text-gray-600">
              {success.email} 宛にパスワード再設定メールを送信しました。
            </p>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSuccess(null)}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
              >
                閉じる
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
