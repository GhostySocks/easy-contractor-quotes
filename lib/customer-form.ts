import type { CustomerRow } from './customers';

/**
 * Pure helpers for editing customer contact details. No I/O here so the
 * validation and write-back rules are unit-tested (lib/__tests__/customer-form.test.ts).
 */

export type CustomerFormValues = {
  name: string;
  phone: string;
  email: string;
  address_line1: string;
  address_line2: string;
  city: string;
  state_code: string;
  postal_code: string;
  notes: string;
  /** Comma-separated in the form; stored as text[]. */
  tags: string;
};

export type CustomerPatch = Partial<
  Pick<
    CustomerRow,
    | 'name'
    | 'phone'
    | 'email'
    | 'address_line1'
    | 'address_line2'
    | 'city'
    | 'state_code'
    | 'postal_code'
    | 'notes'
    | 'tags'
  >
>;

export type CustomerFormErrors = Partial<Record<keyof CustomerFormValues, string>>;

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PHONE_RE = /^[+]?[-\d\s().]{7,}$/;
const POSTAL_RE = /^\d{5}(-\d{4})?$/;
const MAX_TAGS = 10;
const MAX_TAG_LEN = 24;

export function formValuesFromCustomer(c: CustomerRow): CustomerFormValues {
  return {
    name: c.name ?? '',
    phone: c.phone ?? '',
    email: c.email ?? '',
    address_line1: c.address_line1 ?? '',
    address_line2: c.address_line2 ?? '',
    city: c.city ?? '',
    state_code: c.state_code ?? '',
    postal_code: c.postal_code ?? '',
    notes: c.notes ?? '',
    tags: (c.tags ?? []).join(', '),
  };
}

/** "Repeat, Gate code 1234 , , repeat" -> ["Repeat", "Gate code 1234"] (case-insensitive dedupe). */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(',')) {
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, MAX_TAG_LEN);
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

/**
 * Every tag in use across these customers, for the Customers tab filter.
 * Case-insensitive dedupe keeping the first spelling seen, sorted A–Z.
 */
export function collectTags(customers: { tags: string[] | null }[]): string[] {
  const byKey = new Map<string, string>();
  for (const c of customers) {
    for (const tag of c.tags ?? []) {
      const key = tag.toLowerCase();
      if (!byKey.has(key)) byKey.set(key, tag);
    }
  }
  return [...byKey.values()].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

export function hasTag(customer: { tags: string[] | null }, tag: string): boolean {
  const key = tag.toLowerCase();
  return (customer.tags ?? []).some((t) => t.toLowerCase() === key);
}

export function validateCustomerForm(v: CustomerFormValues): CustomerFormErrors {
  const errors: CustomerFormErrors = {};
  if (!v.name.trim()) errors.name = 'Name is required';
  if (v.email.trim() && !EMAIL_RE.test(v.email.trim())) errors.email = 'Looks incomplete';
  if (v.phone.trim() && !PHONE_RE.test(v.phone.trim())) errors.phone = 'Looks incomplete';
  if (v.state_code.trim() && !/^[A-Za-z]{2}$/.test(v.state_code.trim())) {
    errors.state_code = '2 letters, e.g. TX';
  }
  if (v.postal_code.trim() && !POSTAL_RE.test(v.postal_code.trim())) {
    errors.postal_code = '5 digits';
  }
  return errors;
}

function blankToNull(s: string): string | null {
  const t = s.trim();
  return t ? t : null;
}

/** The full patch a Save writes: trimmed, empty strings become null. */
export function patchFromForm(v: CustomerFormValues): CustomerPatch {
  return {
    name: v.name.trim(),
    phone: blankToNull(v.phone),
    email: blankToNull(v.email)?.toLowerCase() ?? null,
    address_line1: blankToNull(v.address_line1),
    address_line2: blankToNull(v.address_line2),
    city: blankToNull(v.city),
    state_code: blankToNull(v.state_code)?.toUpperCase() ?? null,
    postal_code: blankToNull(v.postal_code),
    notes: blankToNull(v.notes),
    tags: parseTags(v.tags),
  };
}

/**
 * What to write back to a customer after the contractor used new contact
 * details somewhere else (the Send sheet, the New Quote address fields).
 * The value the contractor just typed is the freshest, so a valid non-empty
 * value replaces what's stored; blanks never erase stored data. Returns only
 * the fields that actually change, or null when nothing does.
 */
export function contactBackfill(
  existing: Pick<CustomerRow, 'name' | 'email' | 'phone' | 'address_line1' | 'city'>,
  used: { name?: string; email?: string; phone?: string; address_line1?: string; city?: string },
): CustomerPatch | null {
  const patch: CustomerPatch = {};

  const email = used.email?.trim().toLowerCase();
  if (email && EMAIL_RE.test(email) && email !== (existing.email ?? '').toLowerCase()) {
    patch.email = email;
  }
  const phone = used.phone?.trim();
  if (phone && PHONE_RE.test(phone) && digits(phone) !== digits(existing.phone ?? '')) {
    patch.phone = phone;
  }
  const line1 = used.address_line1?.trim();
  if (line1 && line1 !== (existing.address_line1 ?? '')) patch.address_line1 = line1;
  const city = used.city?.trim();
  if (city && city !== (existing.city ?? '')) patch.city = city;

  // A name typed in passing only fills a blank one; renaming a customer is a
  // deliberate act that belongs on the edit screen.
  const name = used.name?.trim();
  if (name && !existing.name?.trim()) patch.name = name;

  return Object.keys(patch).length > 0 ? patch : null;
}

function digits(s: string): string {
  return s.replace(/\D/g, '');
}
