import type { LineItem } from '../ai';
import {
  checkDraft,
  filledLines,
  isDirty,
  parseExtraDays,
  travelSuggestion,
} from '../change-order-form';

const gate: LineItem = {
  label: 'Add a second gate',
  qty: 1,
  unit_price_cents: 65000,
  total_cents: 65000,
};
const blank: LineItem = { label: '', qty: 1, unit_price_cents: 0, total_cents: 0 };
const draft = { description: 'Add a second walk gate.', lines: [gate], extraDays: '' };

describe('parseExtraDays', () => {
  it('reads whole days and treats blank or junk as none', () => {
    expect(parseExtraDays('3')).toBe(3);
    expect(parseExtraDays(' 2 ')).toBe(2);
    expect(parseExtraDays('')).toBe(0);
    expect(parseExtraDays('1.5')).toBe(0);
    expect(parseExtraDays('-1')).toBe(0);
    expect(parseExtraDays('abc')).toBe(0);
  });
});

describe('checkDraft', () => {
  it('passes a described change with a priced line', () => {
    expect(checkDraft({ ...draft, extraDays: '2' })).toEqual({
      ok: true,
      lines: [gate],
      extraDays: 2,
    });
  });

  it('drops rows the editor left empty', () => {
    expect(filledLines([gate, blank])).toEqual([gate]);
    expect(checkDraft({ ...draft, lines: [gate, blank] }).ok).toBe(true);
  });

  it('accepts a credit', () => {
    const credit = { ...gate, label: 'Customer supplied hardware', unit_price_cents: -20000 };
    const result = checkDraft({ ...draft, lines: [credit] });
    expect(result.ok && result.lines[0].total_cents).toBe(-20000);
  });

  it('says what is missing', () => {
    expect(checkDraft({ ...draft, description: 'x' })).toEqual({
      ok: false,
      message: 'Describe what is changing in a sentence or two.',
    });
    expect(checkDraft({ ...draft, lines: [blank] })).toEqual({
      ok: false,
      message: 'Add at least one line with a price.',
    });
    expect(checkDraft({ ...draft, lines: [{ ...gate, label: ' ' }] })).toEqual({
      ok: false,
      message: 'Give every line a name.',
    });
    expect(checkDraft({ ...draft, lines: [{ ...gate, unit_price_cents: 0 }] }).ok).toBe(false);
  });
});

describe('isDirty', () => {
  const saved = { description: 'Add a second walk gate.', line_items: [gate], extra_days: 0 };

  it('is clean right after saving, whatever empty rows are on screen', () => {
    expect(isDirty(draft, saved)).toBe(false);
    expect(isDirty({ ...draft, lines: [gate, blank] }, saved)).toBe(false);
  });

  it('is dirty when the text, a price or the days change', () => {
    expect(isDirty({ ...draft, description: 'Add two gates.' }, saved)).toBe(true);
    expect(isDirty({ ...draft, lines: [{ ...gate, unit_price_cents: 70000 }] }, saved)).toBe(true);
    expect(isDirty({ ...draft, extraDays: '1' }, saved)).toBe(true);
  });

  it('is dirty when nothing has been saved yet', () => {
    expect(isDirty(draft, null)).toBe(true);
  });
});

describe('travelSuggestion', () => {
  const perDay = {
    mode: 'per_mile' as const,
    rate_cents: 150,
    per: 'day' as const,
    days: 3,
    miles_one_way: 42,
  };

  it('offers travel for the extra days when the quote charged it per day', () => {
    expect(travelSuggestion(perDay, 2, [gate])).toEqual({
      label: 'Travel per day (84 mi round trip × $1.50/mi)',
      qty: 2,
      unit_price_cents: 12600,
      total_cents: 25200,
    });
  });

  it('offers nothing when no days are added, or travel was charged once or not at all', () => {
    expect(travelSuggestion(perDay, 0, [gate])).toBeNull();
    expect(travelSuggestion({ ...perDay, per: 'job' }, 2, [gate])).toBeNull();
    expect(travelSuggestion(null, 2, [gate])).toBeNull();
  });

  it('offers nothing when the change order already has a travel line', () => {
    const travel = { ...gate, label: 'Travel per day (84 mi round trip × $1.50/mi)' };
    expect(travelSuggestion(perDay, 2, [gate, travel])).toBeNull();
  });
});
