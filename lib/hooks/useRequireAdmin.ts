'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { useErrorRecovery } from '@/lib/utils/error-recovery';

interface UseRequireAdminOptions {
  onRedirect?: (path: string) => void;
}

export function useRequireAdmin(options: UseRequireAdminOptions = {}) {
  const router = useRouter();
  const { onRedirect } = options;
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { handleError, retryOperation } = useErrorRecovery();

  const handleRedirect = (path: string) => {
    if (onRedirect) {
      onRedirect(path);
    } else {
      router.replace(path);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let authVerified = false;

    const verifyToken = async (token: string, currentUser?: User, isCached = false) => {
      try {
        const response = await retryOperation(
          () =>
            fetch('/api/auth/verify', {
              headers: { Authorization: `Bearer ${token}` },
              signal: AbortSignal.timeout(5000),
            }),
          `require-admin-verify-${isCached ? 'cached' : 'fresh'}`,
          { maxRetries: 2 },
        );

        if (!response.ok) {
          if (!isCached && isMounted) {
            localStorage.removeItem('authToken');
            handleRedirect('/admin/login');
          }
          return false;
        }

        const data = await response.json();
        if (!data?.user?.isAdmin) {
          if (!isCached && isMounted) {
            localStorage.removeItem('authToken');
            handleRedirect('/admin/login');
          }
          return false;
        }

        if (isMounted) {
          localStorage.setItem('authToken', token);
          if (currentUser) {
            setUser(currentUser);
          }
          setIsAdmin(true);
          setError(null);
          setLoading(false);
        }
        return true;
      } catch (err) {
        if (isCached) {
          // If cached verification fails due to error, we do not redirect yet.
          // We wait for onAuthStateChanged to check if there is a valid Firebase session.
          return false;
        }

        const diagnosis = handleError(err, 'require-admin-verify');
        if (isMounted) {
          if (diagnosis.type === 'auth') {
            localStorage.removeItem('authToken');
            handleRedirect('/admin/login');
          } else if (diagnosis.recoverable) {
            setError('認証の確認中にエラーが発生しました');
          } else {
            setError('システムエラーが発生しました');
          }
        }
        return false;
      }
    };

    // Fast path: if token is cached, try to verify it immediately
    const verifyCachedToken = async () => {
      const cachedToken = localStorage.getItem('authToken');
      if (!cachedToken) return;

      const success = await verifyToken(cachedToken, undefined, true);
      if (success) {
        authVerified = true;
      }
    };

    verifyCachedToken();

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        if (isMounted) {
          setUser(null);
          setIsAdmin(false);
          localStorage.removeItem('authToken');
          handleRedirect('/admin/login');
          setLoading(false);
        }
        return;
      }

      // If already verified using cached token, just update the User object and stop loading
      if (authVerified && isMounted) {
        setUser(currentUser);
        setLoading(false);
        return;
      }

      try {
        const token = await currentUser.getIdToken();
        await verifyToken(token, currentUser, false);
      } catch (err) {
        console.error('Failed to get token:', err);
        if (isMounted) {
          localStorage.removeItem('authToken');
          handleRedirect('/admin/login');
        }
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, [router, onRedirect, handleError, retryOperation]);

  return { user, loading, isAdmin, error };
}
