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
