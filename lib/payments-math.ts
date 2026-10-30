/**
 * Grouping for the Payments screen. Pure, unit-tested.
 *
 * PRD IN-04: an invoice is overdue 7 days after it was sent. There's no due
 * date column yet, so sent_at is the clock (an unsent invoice can't be late).
 */

export const OVERDUE_DAYS = 7;
const DAY_MS = 86_400_000;

export type PaymentInvoice = {
  id: string;
  status: 'unpaid' | 'partial' | 'paid' | 'refunded';
  total_cents: number;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
};

export function isOverdue(
  inv: Pick<PaymentInvoice, 'status' | 'sent_at'>,
  now = Date.now(),
): boolean {
  if (inv.status !== 'unpaid' && inv.status !== 'partial') return false;
  if (!inv.sent_at) return false;
  return now - Date.parse(inv.sent_at) > OVERDUE_DAYS * DAY_MS;
}

/** Whole days past the overdue threshold, for "3 days overdue". */
export function daysOverdue(sentAt: string, now = Date.now()): number {
  return Math.max(0, Math.floor((now - Date.parse(sentAt)) / DAY_MS) - OVERDUE_DAYS);
}

export type PaymentGroups<T extends PaymentInvoice> = {
  overdue: T[];
  unpaid: T[];
  paid: T[];
  totals: { overdueCents: number; unpaidCents: number; paidLast30Cents: number };
};

/**
 * Overdue (oldest first, so the worst is on top), Unpaid (newest first) and
 * Paid in the last 30 days (most recent first). Refunded invoices are left out.
 */
export function groupInvoices<T extends PaymentInvoice>(
  rows: T[],
  now = Date.now(),
): PaymentGroups<T> {
  const overdue: T[] = [];
  const unpaid: T[] = [];
  const paid: T[] = [];
  for (const r of rows) {
    if (r.status === 'paid') {
      if (r.paid_at && now - Date.parse(r.paid_at) <= 30 * DAY_MS) paid.push(r);
    } else if (r.status === 'unpaid' || r.status === 'partial') {
      (isOverdue(r, now) ? overdue : unpaid).push(r);
    }
  }
  overdue.sort((a, b) => Date.parse(a.sent_at!) - Date.parse(b.sent_at!));
  unpaid.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  paid.sort((a, b) => Date.parse(b.paid_at!) - Date.parse(a.paid_at!));
  const sum = (xs: T[]) => xs.reduce((n, x) => n + x.total_cents, 0);
  return {
    overdue,
    unpaid,
    paid,
    totals: { overdueCents: sum(overdue), unpaidCents: sum(unpaid), paidLast30Cents: sum(paid) },
  };
}
