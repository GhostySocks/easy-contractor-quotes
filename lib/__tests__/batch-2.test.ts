import { collectTags, hasTag } from '../customer-form';
import { groupsByDay, sortLibraryRows, type SortableRow } from '../library-sort';
import { atDayAndMinutes, formatSlot, minutesOf, nearestSlot, TIME_SLOTS } from '../schedule-time';

describe('schedule-time', () => {
  it('offers 6:00 AM to 7:00 PM in half hours', () => {
    expect(TIME_SLOTS[0]).toBe(360);
    expect(TIME_SLOTS[TIME_SLOTS.length - 1]).toBe(19 * 60);
    expect(new Set(TIME_SLOTS.slice(1).map((s, i) => s - TIME_SLOTS[i]))).toEqual(new Set([30]));
  });

  it('formats 12-hour times', () => {
    expect(formatSlot(360)).toBe('6:00 AM');
    expect(formatSlot(12 * 60)).toBe('12:00 PM');
    expect(formatSlot(13 * 60 + 30)).toBe('1:30 PM');
    expect(formatSlot(0)).toBe('12:00 AM');
  });

  it('round-trips a local day and time', () => {
    const iso = atDayAndMinutes('2026-11-04', 14 * 60 + 30);
    expect(minutesOf(iso)).toBe(870);
    const d = new Date(iso);
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 11, 4]);
  });

  it('snaps an odd time to the nearest slot, earlier on ties', () => {
    expect(nearestSlot(9 * 60 + 10)).toBe(540);
    expect(nearestSlot(9 * 60 + 15)).toBe(540);
    expect(nearestSlot(9 * 60 + 20)).toBe(570);
    expect(nearestSlot(2 * 60)).toBe(360);
    expect(nearestSlot(23 * 60)).toBe(19 * 60);
  });
});

describe('sortLibraryRows', () => {
  const row = (iso: string, amount: number, customer: string, title = 'Job'): SortableRow => ({
    groupingIso: iso,
    todayJob: { title, customerName: customer, amountCents: amount },
  });
  const now = Date.parse('2026-10-30T12:00:00Z');
  const a = row('2026-10-01T10:00:00Z', 50000, 'zed');
  const b = row('2026-11-05T10:00:00Z', 12000, 'Amy');
  const c = row('2026-11-01T10:00:00Z', 90000, 'bob');
  const d = row('2026-10-20T10:00:00Z', 30000, 'amy', 'Another');

  it('newest first', () => {
    expect(sortLibraryRows([a, b, c, d], 'recent', now)).toEqual([b, c, d, a]);
  });

  it('soonest upcoming first, then past newest first', () => {
    expect(sortLibraryRows([a, b, c, d], 'upcoming', now)).toEqual([c, b, d, a]);
  });

  it('highest amount first', () => {
    expect(sortLibraryRows([a, b, c, d], 'amount', now)).toEqual([c, a, d, b]);
  });

  it('customer A–Z, case-insensitive, then title', () => {
    expect(sortLibraryRows([a, b, c, d], 'customer', now)).toEqual([d, b, c, a]);
  });

  it('does not mutate the input', () => {
    const input = [a, b];
    sortLibraryRows(input, 'amount', now);
    expect(input).toEqual([a, b]);
  });

  it('only date sorts keep day headers', () => {
    expect(groupsByDay('recent')).toBe(true);
    expect(groupsByDay('upcoming')).toBe(true);
    expect(groupsByDay('amount')).toBe(false);
    expect(groupsByDay('customer')).toBe(false);
  });
});

describe('customer tags', () => {
  const customers = [
    { tags: ['Referral', 'net 30'] },
    { tags: ['referral', 'Commercial'] },
    { tags: null },
  ];

  it('collects distinct tags A–Z, keeping the first spelling', () => {
    expect(collectTags(customers)).toEqual(['Commercial', 'net 30', 'Referral']);
  });

  it('matches tags case-insensitively', () => {
    expect(hasTag(customers[1], 'REFERRAL')).toBe(true);
    expect(hasTag(customers[2], 'Referral')).toBe(false);
  });
});
