import { router } from 'expo-router';
import { useEffect } from 'react';

import { useAuth } from './auth-store';

/**
 * On the Welcome and sign-in screens: if a saved login finishes restoring
 * while someone is looking at them (slow network at startup), go back to the
 * root guard, which routes to Home or App paused. Not used on sign-up, which
 * routes itself after creating the account.
 */
export function useLeaveWhenSignedIn(): void {
  const signedIn = useAuth((s) => !!s.session);
  useEffect(() => {
    if (signedIn) router.replace('/');
  }, [signedIn]);
}
