'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { AdminLoginFormData } from '@/types';

export default function AdminRegister() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormData>();

  const onSubmit = async (data: AdminLoginFormData) => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const response = await fetch('/api/auth/admin-register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        setSuccess('管理者アカウントが作成されました！管理者ダッシュボードに移動します...');
        
        // カスタムトークンを使ってFirebase認証
        const { auth } = await import('@/lib/firebase');
        const { signInWithCustomToken, getIdToken } = await import('firebase/auth');
        
        if (result.customToken) {
          try {
            // カスタムトークンでサインイン
            const userCredential = await signInWithCustomToken(auth, result.customToken);
            console.log('Signed in with custom token after registration:', userCredential.user.uid);
            
            // IDトークンを取得
            const idToken = await getIdToken(userCredential.user);
            localStorage.setItem('authToken', idToken);
            console.log('ID Token stored after registration:', idToken.substring(0, 50) + '...');
            
            setTimeout(() => {
              router.push('/admin/dashboard');
            }, 2000);
          } catch (authError) {
            console.error('Custom token authentication failed after registration:', authError);
            setTimeout(() => {
              router.push('/admin');
            }, 2000);
          }
        } else {
          setTimeout(() => {
            router.push('/admin');
          }, 2000);
        }
      } else {
        setError(result.error || 'アカウント作成に失敗しました');
      }
    } catch {
      setError('アカウント作成に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          管理者アカウント作成
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          st.kanazawa-it.ac.jp ドメインのメールアドレスで管理者アカウントを作成してください
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                メールアドレス
              </label>
              <div className="mt-1">
                <input
                  id="email"
                  type="email"
                  placeholder="example@st.kanazawa-it.ac.jp"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  {...register('email', {
                    required: 'メールアドレスを入力してください',
                    pattern: {
                      value: /^[^\s@]+@st\.kanazawa-it\.ac\.jp$/,
                      message: 'st.kanazawa-it.ac.jp ドメインのメールアドレスを入力してください'
                    }
                  })}
                />
              </div>
              {errors.email && (
                <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                パスワード
              </label>
              <div className="mt-1">
                <input
                  id="password"
                  type="password"
                  className="appearance-none block w-full px-3 py-2 border border-gray-300 rounded-md placeholder-gray-400 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  {...register('password', {
                    required: 'パスワードを入力してください',
                    minLength: {
                      value: 6,
                      message: 'パスワードは6文字以上で入力してください'
                    }
                  })}
                />
              </div>
              {errors.password && (
                <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-red-50 p-4">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {success && (
              <div className="rounded-md bg-green-50 p-4">
                <div className="text-sm text-green-700">{success}</div>
              </div>
            )}

            <div>
              <button
                type="submit"
                disabled={isLoading || success}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? 'アカウント作成中...' : 'アカウント作成'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <button
              onClick={() => router.push('/admin')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ← 既にアカウントをお持ちの場合はログイン
            </button>
          </div>

          <div className="mt-6">
            <div className="text-xs text-gray-500">
              <p className="mb-2">注意事項:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>st.kanazawa-it.ac.jp ドメインのメールアドレスのみ使用可能</li>
                <li>パスワードは6文字以上で設定してください</li>
                <li>作成後は管理者権限が自動的に付与されます</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}