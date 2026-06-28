'use client';

import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { sendPasswordResetEmail } from 'firebase/auth';
import { LoadingInline } from '@/components/ui/Loading';
import { Modal } from '@/components/ui/Modal';
import { ADMIN_EMAIL_PATTERN } from '@/lib/utils/admin/invites';
import { useRequireAdmin } from '@/lib/hooks/useRequireAdmin';

export default function AdminInvitePage() {
  const { user, loading } = useRequireAdmin();
  const [submitting, setSubmitting] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{
    email: string;
    operation: 'created' | 'updated';
    passwordResetSent: boolean;
  } | null>(null);

  const submitInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
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

      let passwordResetSent = true;
      try {
        auth.languageCode = 'ja';
        await sendPasswordResetEmail(auth, normalizedEmail);
      } catch (sendError) {
        passwordResetSent = false;
        console.error('パスワード再設定メールの送信に失敗しました:', sendError);
      }

      setSuccess({
        ...(data?.invite || { email: normalizedEmail, operation: 'created' }),
        passwordResetSent,
      });
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

        <form
          className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm"
          onSubmit={submitInvite}
        >
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
              type="submit"
              disabled={!email || submitting}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? '送信中...' : '招待メールを送信'}
            </button>
          </div>
        </form>
      </div>

      <Modal open={Boolean(success)} onClose={() => setSuccess(null)} panelClassName="max-w-md p-6">
        {success && (
          <div>
            <h2 className="text-lg font-semibold text-gray-900">招待を送信しました</h2>
            <p className="mt-3 text-sm text-gray-600">
              {success.email} 宛の管理者登録は完了しました。
            </p>
            {!success.passwordResetSent && (
              <p className="mt-2 text-sm text-amber-700">
                パスワード再設定メールの送信には失敗しました。必要なら手動で再送してください。
              </p>
            )}
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
