/**
 * Turn a reverse-geocode result into the New Quote address fields. Pure,
 * unit-tested. Field availability varies by platform: iOS often puts the full
 * "123 Main St" in `name`; Android tends to split streetNumber + street.
 */
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

export function addressFromGeocode(g: GeocodedAddress): { line1: string; city: string } | null {
  const fromParts = [g.streetNumber, g.street].filter(Boolean).join(' ').trim();
  // `name` is only a street address when it starts with a house number;
  // otherwise it's a place name ("Home Depot") or just the city.
  const nameIsAddress = !!g.name && /^\d/.test(g.name.trim());
  const line1 = fromParts || (nameIsAddress ? g.name!.trim() : '');
  const city = (g.city || g.district || g.subregion || '').trim();
  if (!line1 && !city) return null;
  return { line1, city };
}
