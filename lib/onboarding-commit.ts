import { useOnboardingDraft } from './onboarding-store';
import { supabase } from './supabase';

/**
 * Upsert the in-memory onboarding draft into the `profiles` table.
 *
 * Called from two places:
 *   1. After a successful paywall purchase (production flow).
 *   2. After sign-up when DEV_BYPASS_PAYWALL is on (skip the paywall).
 *
 * Both produce the same row shape so the rest of the app can rely on a single
 * source of truth.
 */
export async function commitOnboardingProfile(userId: string | undefined): Promise<void> {
  if (!userId) return;
  const draft = useOnboardingDraft.getState();
  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    business_name: draft.business_name || 'My business',
    logo_url: draft.logo_url,
    state_code: draft.state_code || 'TX',
    trade: draft.trade,
    onboarding_completed_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('[profiles] upsert failed', error.message);
  }
}
