/**
 * Turn a reverse-geocode result into the New Quote address fields. Pure,
 * unit-tested. Field availability varies by platform: iOS often puts the full
 * "123 Main St" in `name`; Android tends to split streetNumber + street.
 */
import { stateCodeFromRegion } from './us-states';

export type GeocodedAddress = {
  name: string | null;
  streetNumber: string | null;
  street: string | null;
  city: string | null;
  subregion: string | null;
  district: string | null;
  region: string | null;
  postalCode: string | null;
};

export type FilledAddress = {
  line1: string;
  city: string;
  /** 2-letter code, or null when the region isn't a US state we recognize. */
  state_code: string | null;
  postal_code: string | null;
};

export function addressFromGeocode(g: GeocodedAddress): FilledAddress | null {
  const fromParts = [g.streetNumber, g.street].filter(Boolean).join(' ').trim();
  // `name` is only a street address when it starts with a house number;
  // otherwise it's a place name ("Home Depot") or just the city.
  const nameIsAddress = !!g.name && /^\d/.test(g.name.trim());
  const line1 = fromParts || (nameIsAddress ? g.name!.trim() : '');
  const city = (g.city || g.district || g.subregion || '').trim();
  if (!line1 && !city) return null;
  return {
    line1,
    city,
    state_code: stateCodeFromRegion(g.region),
    postal_code: g.postalCode?.trim() || null,
  };
}

/** "12 Oak St, Ashland, OH 44805" for a job site, or null when none was recorded. */
export function siteLine(site: {
  site_address_line1?: string | null;
  site_city?: string | null;
  site_state_code?: string | null;
  site_postal_code?: string | null;
}): string | null {
  if (!site.site_address_line1 && !site.site_city) return null;
  const stateZip = [site.site_state_code, site.site_postal_code].filter(Boolean).join(' ');
  return [site.site_address_line1, site.site_city, stateZip].filter(Boolean).join(', ');
}
