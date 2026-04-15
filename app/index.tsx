import { Redirect } from 'expo-router';

import { SplashBrand } from '@/components/ui/SplashBrand';
import { useAuth } from '@/lib/auth-store';
import { isActive } from '@/lib/entitlement';

/**
 * Root guard. Decides where to send the user on cold start and on resume.
 *
 *   not-bootstrapped  -> branded splash
 *   no session        -> /welcome
 *   session + paused  -> /app-paused
 *   session + active  -> /(tabs)/home
 */
export default function Splash() {
  const bootstrapped = useAuth((s) => s.bootstrapped);
  const session = useAuth((s) => s.session);
  const subscription = useAuth((s) => s.subscription);

  if (!bootstrapped) {
    return <SplashBrand />;
  }

  if (!session) {
    return <Redirect href="/(onboarding)/welcome" />;
  }

  if (!isActive(subscription)) {
    return <Redirect href="/app-paused" />;
  }

  return <Redirect href="/(tabs)/home" />;
}
