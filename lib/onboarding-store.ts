import { create } from 'zustand';

export type TradeCode = 'handyman' | 'plumber' | 'electrician' | 'hvac' | 'landscaping' | 'other';

/** A logo picked during onboarding, before there's an account to upload it to. */
export type LocalLogo = { uri: string; width: number; height: number };

export type OnboardingDraft = {
  trade: TradeCode | null;
  business_name: string;
  logo_url: string | null;
  /** Uploaded by commitOnboardingProfile once the user has signed up. */
  logo_local: LocalLogo | null;
  state_code: string;
};

export type OnboardingState = OnboardingDraft & {
  setTrade: (trade: TradeCode) => void;
  setBusinessName: (name: string) => void;
  setLogoUrl: (url: string | null) => void;
  setLogoLocal: (logo: LocalLogo | null) => void;
  setStateCode: (state: string) => void;
  reset: () => void;
};

const initial: OnboardingDraft = {
  trade: null,
  business_name: '',
  logo_url: null,
  logo_local: null,
  state_code: '',
};

/**
 * Cross-screen draft of onboarding data. Committed to Supabase `profiles` in
 * a single insert after the paywall purchase completes (so we never orphan a
 * half-written profile row).
 */
export const useOnboardingDraft = create<OnboardingState>((set) => ({
  ...initial,
  setTrade: (trade) => set({ trade }),
  setBusinessName: (business_name) => set({ business_name }),
  setLogoUrl: (logo_url) => set({ logo_url }),
  setLogoLocal: (logo_local) => set({ logo_local }),
  setStateCode: (state_code) => set({ state_code: state_code.toUpperCase().slice(0, 2) }),
  reset: () => set(initial),
}));
