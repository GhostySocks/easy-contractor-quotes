import { supabase } from './supabase';

export type ProfileRow = {
  id: string;
  business_name: string;
  logo_url: string | null;
  state_code: string;
  default_tax_rate: number;
  trade: string | null;
  stripe_account_id: string | null;
  onboarding_completed_at: string | null;
  created_at: string;
};

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[profile] fetch failed', error.message);
    return null;
  }
  return (data as ProfileRow) ?? null;
}

export type UpdateProfileResult =
  | { ok: true; profile: ProfileRow }
  | { ok: false; message: string };

/**
 * Update editable profile fields. RLS restricts the update to the calling
 * user's own row. Returns a tagged result so the caller can show the actual
 * server error instead of a generic "try again".
 */
export async function updateProfile(
  userId: string,
  patch: Partial<Pick<ProfileRow, 'business_name' | 'state_code' | 'trade' | 'logo_url'>>,
): Promise<UpdateProfileResult> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();
  if (error) {
    console.warn('[profile] update failed', error.message);
    return { ok: false, message: error.message };
  }
  if (!data) {
    return { ok: false, message: 'No profile row matched — RLS or session may be stale.' };
  }
  return { ok: true, profile: data as ProfileRow };
}

export function firstNameFromProfile(profile: ProfileRow | null): string {
  if (!profile) return 'there';
  const first = profile.business_name.trim().split(/\s+/)[0];
  return first || 'there';
}

export function initialsFromProfile(profile: ProfileRow | null): string {
  if (!profile) return '—';
  const parts = profile.business_name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? '';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase() || '—';
}
