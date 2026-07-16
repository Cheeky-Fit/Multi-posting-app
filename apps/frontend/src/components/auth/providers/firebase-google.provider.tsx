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

export const FirebaseGoogleProvider = ({ mode, company }: Props) => {
  const fetch = useFetch();
  const t = useT();
  const [loading, setLoading] = useState(false);

  const onClick = useCallback(async () => {
    setLoading(true);
    try {
      const auth = getFirebaseAuth();
      const result = await signInWithPopup(auth, new GoogleAuthProvider());
      const idToken = await result.user.getIdToken();
      const email = result.user.email || '';
      const workspace =
        company?.trim() ||
        result.user.displayName?.trim() ||
        email.split('@')[0] ||
        'My workspace';

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

      // Existing auth flows set cookie via response; hard navigate home.
      window.location.href = '/';
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [company, fetch, mode]);

  return (
    <div
      onClick={loading ? undefined : onClick}
      className="cursor-pointer flex-1 bg-white h-[52px] rounded-[10px] flex justify-center items-center text-[#0E0E0E] gap-[10px]"
    >
      <span>{t('continue_with_google', 'Continue with Google')}</span>
    </div>
  );
};
