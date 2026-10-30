import { supabase } from './supabase';

export type ProfileRow = {
  id: string;
  business_name: string;
  logo_url: string | null;
  state_code: string;
  default_tax_rate: number;
  /** Travel time kept clear around jobs when scheduling: 0, 15, 30 or 60. */
  travel_buffer_minutes: number;
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
  patch: Partial<
    Pick<
      ProfileRow,
      | 'business_name'
      | 'state_code'
      | 'trade'
      | 'logo_url'
      | 'default_tax_rate'
      | 'travel_buffer_minutes'
    >
  >,
): Promise<UpdateProfileResult> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .maybeSingle();
  if (error) {
    console.warn('[profile] update failed', error.message);
    return { ok: false, message: error.message };
  }
  if (data) return { ok: true, profile: data as ProfileRow };

  // No row yet: an account that never finished onboarding. Create it, which
  // needs the two required fields (business name and state).
  if (!patch.business_name || !patch.state_code) {
    return { ok: false, message: 'Save your business name and state first.' };
  }
  const { data: created, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, ...patch, onboarding_completed_at: new Date().toISOString() })
    .select('*')
    .single();
  if (insertError || !created) {
    console.warn('[profile] create failed', insertError?.message);
    return { ok: false, message: insertError?.message ?? 'Could not create your profile.' };
  }
  return { ok: true, profile: created as ProfileRow };
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
