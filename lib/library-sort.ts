/**
 * Sorting and sectioning for the Library (Jobs tab). Pure, unit-tested.
 *
 * Date sorts keep the by-day section headers; amount and customer sorts are a
 * single flat section, since day headers would scatter them.
 */

export type LibrarySort = 'recent' | 'upcoming' | 'amount' | 'customer';

export const LIBRARY_SORTS: { key: LibrarySort; label: string }[] = [
  { key: 'recent', label: 'Newest' },
  { key: 'upcoming', label: 'Soonest' },
  { key: 'amount', label: 'Amount' },
  { key: 'customer', label: 'A–Z' },
];

export type SortableRow = {
  groupingIso: string;
  todayJob: { title: string; customerName: string; amountCents: number };
};

function time(iso: string): number {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? 0 : t;
}

export function sortLibraryRows<T extends SortableRow>(
  rows: T[],
  sort: LibrarySort,
  now = Date.now(),
): T[] {
  const copy = [...rows];
  switch (sort) {
    case 'recent':
      return copy.sort((a, b) => time(b.groupingIso) - time(a.groupingIso));
    case 'upcoming': {
      // Upcoming jobs soonest first, then everything already past, most recent first.
      const future = copy.filter((r) => time(r.groupingIso) >= now);
      const past = copy.filter((r) => time(r.groupingIso) < now);
      future.sort((a, b) => time(a.groupingIso) - time(b.groupingIso));
      past.sort((a, b) => time(b.groupingIso) - time(a.groupingIso));
      return [...future, ...past];
    }
    case 'amount':
      return copy.sort((a, b) => b.todayJob.amountCents - a.todayJob.amountCents);
    case 'customer':
      return copy.sort(
        (a, b) =>
          a.todayJob.customerName.localeCompare(b.todayJob.customerName, undefined, {
            sensitivity: 'base',
          }) || a.todayJob.title.localeCompare(b.todayJob.title),
      );
  }
}

/** Whether a sort keeps the day-by-day section headers. */
export function groupsByDay(sort: LibrarySort): boolean {
  return sort === 'recent' || sort === 'upcoming';
}

export function flatSectionTitle(sort: LibrarySort): string {
  return sort === 'amount' ? 'Highest amount first' : 'By customer';
}
