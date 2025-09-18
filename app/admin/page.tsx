'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { AdminLoginFormData } from '@/types';

export default function AdminLogin() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AdminLoginFormData>();

  const onSubmit = async (data: AdminLoginFormData) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/admin-login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        // カスタムトークンを使ってFirebase認証
        const { auth } = await import('@/lib/firebase');
        const { signInWithCustomToken, getIdToken } = await import('firebase/auth');
        
        if (result.customToken) {
          try {
            // カスタムトークンでサインイン
            const userCredential = await signInWithCustomToken(auth, result.customToken);
            console.log('Signed in with custom token:', userCredential.user.uid);
            
            // IDトークンを取得
            const idToken = await getIdToken(userCredential.user);
            localStorage.setItem('authToken', idToken);
            console.log('ID Token stored:', idToken.substring(0, 50) + '...');
            
            router.push('/admin/event');
          } catch (authError) {
            console.error('Custom token authentication failed:', authError);
            setError('認証に失敗しました');
          }
        } else {
          setError('認証トークンの取得に失敗しました');
        }
      } else {
        setError(result.error || 'ログインに失敗しました');
      }
    } catch {
      setError('ログインに失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          管理者ログイン
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          st.kanazawa-it.ac.jp ドメインのメールアドレスでログインしてください
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

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? 'ログイン中...' : 'ログイン'}
              </button>
            </div>
          </form>

          <div className="mt-6 space-y-3">
            <button
              onClick={() => router.push('/admin/register')}
              className="w-full flex justify-center py-2 px-4 border border-indigo-300 rounded-md shadow-sm text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              初回利用の方はアカウント作成
            </button>
            <button
              onClick={() => router.push('/')}
              className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              ← ログインコード入力画面に戻る
            </button>
          </div>

          <div className="mt-6">
            <div className="text-xs text-gray-500">
              <p className="mb-2">初回利用時:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>st.kanazawa-it.ac.jp ドメインのメールアドレスでアカウント作成</li>
                <li>メール認証後、管理者権限が自動付与されます</li>
                <li>パスワードは安全な場所に保管してください</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}