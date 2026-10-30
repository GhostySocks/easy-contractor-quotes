import { useAuth } from './auth-store';
import { isActive } from './entitlement';

/**
 * True when someone is signed in but their subscription isn't active
 * (PRD AP-02). The app then stays browsable read-only: no New Quote, a
 * reactivate banner. Server-side write blocking is separate (punch list,
 * security phase).
 */
export function usePaused(): boolean {
  const signedIn = useAuth((s) => !!s.session);
  const subscription = useAuth((s) => s.subscription);
  return signedIn && !isActive(subscription);
}
