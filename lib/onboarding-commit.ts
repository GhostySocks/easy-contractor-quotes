import { useOnboardingDraft } from './onboarding-store';
import { uploadLogo } from './photos';
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

  // A logo picked during onboarding is uploaded now that there's an account.
  // A failed upload drops the logo rather than blocking sign-up; it can be
  // added later from Settings > Business.
  let logoUrl = draft.logo_url;
  if (draft.logo_local) {
    try {
      logoUrl = await uploadLogo(draft.logo_local, userId);
    } catch (err) {
      console.warn('[profiles] logo upload failed', err);
    }
  }

  if (!draft.state_code) {
    console.warn('[profiles] no state in onboarding draft; profile left for Settings');
    return;
  }

  const { error } = await supabase.from('profiles').upsert({
    id: userId,
    business_name: draft.business_name || 'My business',
    logo_url: logoUrl,
    state_code: draft.state_code,
    trade: draft.trade,
    onboarding_completed_at: new Date().toISOString(),
  });
  if (error) {
    console.warn('[profiles] upsert failed', error.message);
  }
}
