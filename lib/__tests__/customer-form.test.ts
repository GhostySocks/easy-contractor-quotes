import {
  contactBackfill,
  type CustomerFormValues,
  parseTags,
  patchFromForm,
  validateCustomerForm,
} from '../customer-form';

const blank: CustomerFormValues = {
  name: 'Jane Doe',
  phone: '',
  email: '',
  address_line1: '',
  address_line2: '',
  city: '',
  state_code: '',
  postal_code: '',
  notes: '',
  tags: '',
};

describe('parseTags', () => {
  it('splits on commas, trims, drops blanks and dedupes case-insensitively', () => {
    expect(parseTags(' Repeat, Gate code 1234 , , repeat,Referral')).toEqual([
      'Repeat',
      'Gate code 1234',
      'Referral',
    ]);
  });

  it('caps tag length and count', () => {
    expect(parseTags('x'.repeat(40))[0]).toHaveLength(24);
    expect(parseTags(Array.from({ length: 15 }, (_, i) => `t${i}`).join(','))).toHaveLength(10);
  });

  it('returns an empty list for empty input', () => {
    expect(parseTags('')).toEqual([]);
  });
});

describe('validateCustomerForm', () => {
  it('accepts a name-only customer', () => {
    expect(validateCustomerForm(blank)).toEqual({});
  });

  it('requires a name', () => {
    expect(validateCustomerForm({ ...blank, name: '  ' }).name).toBeDefined();
  });

  it('flags malformed email, phone, state and ZIP', () => {
    const e = validateCustomerForm({
      ...blank,
      email: 'jane@',
      phone: '12',
      state_code: 'Tex',
      postal_code: '7870',
    });
    expect(Object.keys(e).sort()).toEqual(['email', 'phone', 'postal_code', 'state_code']);
  });

  it('accepts well-formed values', () => {
    expect(
      validateCustomerForm({
        ...blank,
        email: 'jane@example.com',
        phone: '(512) 555-0142',
        state_code: 'tx',
        postal_code: '78701-1234',
      }),
    ).toEqual({});
  });
});

describe('patchFromForm', () => {
  it('trims, nulls blanks, lowercases email, uppercases state and parses tags', () => {
    expect(
      patchFromForm({
        ...blank,
        name: '  Jane Doe ',
        email: ' Jane@Example.COM ',
        state_code: 'tx',
        notes: '   ',
        tags: 'Repeat, Referral',
      }),
    ).toEqual({
      name: 'Jane Doe',
      phone: null,
      email: 'jane@example.com',
      address_line1: null,
      address_line2: null,
      city: null,
      state_code: 'TX',
      postal_code: null,
      notes: null,
      tags: ['Repeat', 'Referral'],
    });
  });
});

describe('contactBackfill', () => {
  const existing = {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '(512) 555-0142',
    address_line1: '12 Oak St',
    city: 'Austin',
  };

  it('returns null when nothing new was used', () => {
    expect(contactBackfill(existing, {})).toBeNull();
    expect(
      contactBackfill(existing, {
        email: 'JANE@example.com',
        phone: '512-555-0142',
        address_line1: '12 Oak St',
        city: 'Austin',
      }),
    ).toBeNull();
  });

  it('fills blanks on a name-only customer', () => {
    expect(
      contactBackfill(
        { name: 'Jane', email: null, phone: null, address_line1: null, city: null },
        { email: 'jane@example.com', phone: '512 555 0142', address_line1: '9 Elm', city: 'Waco' },
      ),
    ).toEqual({
      email: 'jane@example.com',
      phone: '512 555 0142',
      address_line1: '9 Elm',
      city: 'Waco',
    });
  });

  it('replaces stored values with a newer valid one', () => {
    expect(contactBackfill(existing, { email: 'jane.new@example.com' })).toEqual({
      email: 'jane.new@example.com',
    });
  });

  it('never writes blanks or invalid values', () => {
    expect(contactBackfill(existing, { email: '', phone: '  ', city: '' })).toBeNull();
    expect(contactBackfill(existing, { email: 'nope', phone: '12' })).toBeNull();
  });

  it('only fills a name when the stored one is blank', () => {
    expect(contactBackfill(existing, { name: 'Janet' })).toBeNull();
    expect(contactBackfill({ ...existing, name: '' }, { name: 'Janet' })).toEqual({
      name: 'Janet',
    });
  });
});
