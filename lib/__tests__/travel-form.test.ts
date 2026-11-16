import {
  addressQuery,
  DEFAULT_TRAVEL_FORM,
  travelFromForm,
  travelPreviewCents,
  type TravelForm,
} from '../travel-form';

const perMile: TravelForm = {
  charge: true,
  mode: 'per_mile',
  rate: '1.50',
  per: 'job',
  days: '',
  miles: '42',
};

describe('travelFromForm', () => {
  it('sends no travel when the contractor says no, whatever else is typed', () => {
    expect(travelFromForm(DEFAULT_TRAVEL_FORM)).toEqual({ ok: true, travel: null });
    expect(travelFromForm({ ...perMile, charge: false })).toEqual({ ok: true, travel: null });
  });

  it('turns a per-mile choice into cents and whole miles', () => {
    expect(travelFromForm(perMile)).toEqual({
      ok: true,
      travel: { mode: 'per_mile', rate_cents: 150, per: 'job', days: 1, miles_one_way: 42 },
    });
  });

  it('accepts a dollar sign and commas in the fee', () => {
    const result = travelFromForm({ ...perMile, mode: 'flat', rate: '$1,250', miles: '' });
    expect(result).toMatchObject({ ok: true, travel: { mode: 'flat', rate_cents: 125000 } });
  });

  it('asks for the rate when it is blank or zero', () => {
    expect(travelFromForm({ ...perMile, rate: '' })).toEqual({
      ok: false,
      message: 'Enter your rate per mile.',
    });
    expect(travelFromForm({ ...perMile, mode: 'flat', rate: '0' })).toEqual({
      ok: false,
      message: 'Enter your travel fee.',
    });
  });

  it('asks for miles on a per-mile charge, but not on a flat fee', () => {
    expect(travelFromForm({ ...perMile, miles: '' })).toEqual({
      ok: false,
      message: 'Enter the miles to the job.',
    });
    expect(travelFromForm({ ...perMile, mode: 'flat', rate: '75', miles: '' }).ok).toBe(true);
  });

  it('asks for days when charging per day', () => {
    expect(travelFromForm({ ...perMile, per: 'day', days: '' })).toEqual({
      ok: false,
      message: 'Enter how many days you will be on site.',
    });
    expect(travelFromForm({ ...perMile, per: 'day', days: '3' })).toMatchObject({
      ok: true,
      travel: { per: 'day', days: 3 },
    });
  });

  it('stops an amount that is clearly a typo', () => {
    expect(travelFromForm({ ...perMile, rate: '150' }).ok).toBe(false);
  });
});

describe('travelPreviewCents', () => {
  it('shows the total once the fields are complete', () => {
    expect(travelPreviewCents(perMile)).toBe(12600);
    expect(travelPreviewCents({ ...perMile, per: 'day', days: '2' })).toBe(25200);
  });

  it('shows nothing while it is off or incomplete', () => {
    expect(travelPreviewCents(DEFAULT_TRAVEL_FORM)).toBeNull();
    expect(travelPreviewCents({ ...perMile, miles: '' })).toBeNull();
  });
});

describe('addressQuery', () => {
  it('builds one line for the lookup', () => {
    expect(
      addressQuery({ line1: '12 Oak St', city: 'Ashland', state_code: 'oh', postal_code: '44805' }),
    ).toBe('12 Oak St, Ashland, OH 44805');
  });

  it('works from a ZIP alone', () => {
    expect(addressQuery({ postal_code: '44805', state_code: 'OH' })).toBe('OH 44805');
  });

  it('is null without a city or ZIP, since a street alone could be anywhere', () => {
    expect(addressQuery({ line1: '12 Oak St', state_code: 'OH' })).toBeNull();
  });
});
