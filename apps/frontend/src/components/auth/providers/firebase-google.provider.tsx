'use client';

import { useCallback, useState } from 'react';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { getFirebaseAuth } from '@gitroom/frontend/lib/firebase.client';
import { useFetch } from '@gitroom/helpers/utils/custom.fetch';
import { useT } from '@gitroom/react/translation/get.transation.service.client';

type Props = {
  mode: 'login' | 'register';
  company?: string;
};

function resolveCompanyName(
  company?: string,
  displayName?: string | null,
  email?: string
): string {
  const candidate =
    company?.trim() ||
    displayName?.trim() ||
    email?.split('@')[0]?.trim() ||
    '';
  if (candidate.length >= 3) {
    return candidate.slice(0, 128);
  }
  return 'My workspace';
}

export const FirebaseGoogleProvider = ({ mode, company }: Props) => {
  const fetch = useFetch();
  const t = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();
      const email = result.user.email || '';
      const workspace = resolveCompanyName(
        company,
        result.user.displayName,
        email
      );

      const path = mode === 'register' ? '/auth/register' : '/auth/login';
      const body =
        mode === 'register'
          ? {
              provider: 'FIREBASE',
              providerToken: idToken,
              email,
              company: workspace,
              password: '',
            }
          : {
              provider: 'FIREBASE',
              providerToken: idToken,
              email,
              password: '',
            };

      const res = await fetch(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Auth failed');
      }
    } catch (e) {
      console.error(e);
      setError(
        e instanceof Error
          ? e.message
          : t('auth_failed', 'Sign-in failed. Please try again.')
      );
      setLoading(false);
    }
  }, [company, fetch, mode, t]);

  return (
    <div className="flex flex-col gap-[8px] flex-1">
      <div
        onClick={loading ? undefined : onClick}
        className="cursor-pointer flex-1 bg-white h-[52px] rounded-[10px] flex justify-center items-center text-[#0E0E0E] gap-[10px]"
      >
        <span>
          {loading
            ? t('signing_in', 'Signing in…')
            : t('continue_with_google', 'Continue with Google')}
        </span>
      </div>
      {error ? (
        <div className="text-[12px] text-red-400 text-center">{error}</div>
      ) : null}
    </div>
  );
};
