import {
  sanitizeTravel,
  travelLineItem,
  type TravelInput,
} from '../supabase/functions/_shared/travel';

/**
 * The "Charge for travel?" part of New Quote, as typed. Pure, unit-tested
 * (lib/__tests__/travel-form.test.ts). The math itself lives in
 * supabase/functions/_shared/travel.ts so the server saves the same number.
 */
export type TravelForm = {
  charge: boolean;
  mode: 'flat' | 'per_mile';
  /** Dollars as typed: the flat fee, or the rate for one mile. */
  rate: string;
  per: 'job' | 'day';
  days: string;
  /** One-way miles as typed or estimated. */
  miles: string;
};

export const DEFAULT_TRAVEL_FORM: TravelForm = {
  charge: false,
  mode: 'per_mile',
  rate: '',
  per: 'job',
  days: '',
  miles: '',
};

export type TravelFormResult =
  | { ok: true; travel: TravelInput | null }
  | { ok: false; message: string };

function dollarsToCents(text: string): number | null {
  const cleaned = text.replace(/[$,\s]/g, '');
  if (!/^\d*\.?\d{0,2}$/.test(cleaned) || cleaned === '' || cleaned === '.') return null;
  return Math.round(Number(cleaned) * 100);
}

function wholeNumber(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '');
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned));
}

/** What to send with the quote, or what's missing in plain words. */
export function travelFromForm(f: TravelForm): TravelFormResult {
  if (!f.charge) return { ok: true, travel: null };

  const rate = dollarsToCents(f.rate);
  if (!rate) {
    return {
      ok: false,
      message: f.mode === 'flat' ? 'Enter your travel fee.' : 'Enter your rate per mile.',
    };
  }
  const miles = wholeNumber(f.miles) ?? 0;
  if (f.mode === 'per_mile' && miles <= 0) {
    return { ok: false, message: 'Enter the miles to the job.' };
  }
  const days = f.per === 'day' ? wholeNumber(f.days) : 1;
  if (!days || days < 1) {
    return { ok: false, message: 'Enter how many days you will be on site.' };
  }

  const travel = sanitizeTravel({
    mode: f.mode,
    rate_cents: rate,
    per: f.per,
    days,
    miles_one_way: miles,
  });
  return travel
    ? { ok: true, travel }
    : { ok: false, message: 'That travel amount looks too high. Check the rate, miles and days.' };
}

/** The travel total to preview under the fields, or null until it's complete. */
export function travelPreviewCents(f: TravelForm): number | null {
  const result = travelFromForm(f);
  return result.ok && result.travel ? travelLineItem(result.travel).total_cents : null;
}

/** One line for a geocoder: "12 Oak St, Ashland, OH 44805". Null when too thin to look up. */
export function addressQuery(a: {
  line1?: string;
  city?: string;
  state_code?: string;
  postal_code?: string;
}): string | null {
  const city = a.city?.trim();
  const zip = a.postal_code?.trim();
  if (!city && !zip) return null;
  const stateZip = [a.state_code?.trim().toUpperCase(), zip].filter(Boolean).join(' ');
  return [a.line1?.trim(), city, stateZip].filter(Boolean).join(', ');
}
