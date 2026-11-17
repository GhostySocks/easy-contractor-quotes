import type { LineItem } from './ai';
import { type ChangeOrderLine, cleanLines } from '../supabase/functions/_shared/change-order';
import { travelLineItem, type TravelInput } from '../supabase/functions/_shared/travel';

/**
 * The change order screen's rules, kept out of the screen so they are
 * unit-tested (lib/__tests__/change-order-form.test.ts).
 */

export type ChangeOrderDraft = {
  description: string;
  lines: LineItem[];
  /** Extra days as typed. */
  extraDays: string;
};

/** Whole days from the field: blank or junk is 0. */
export function parseExtraDays(text: string): number {
  const n = Number(text.trim());
  return Number.isInteger(n) && n > 0 && n <= 365 ? n : 0;
}

/** Lines worth sending: rows left completely empty by the editor are dropped. */
export function filledLines(lines: readonly LineItem[]): LineItem[] {
  return lines.filter((l) => l.label.trim() !== '' || l.unit_price_cents !== 0);
}

export type DraftCheck =
  | { ok: true; lines: ChangeOrderLine[]; extraDays: number }
  | { ok: false; message: string };

/** What to save, or what's missing in plain words. Mirrors the server's checks. */
export function checkDraft(draft: ChangeOrderDraft): DraftCheck {
  if (draft.description.trim().length < 5) {
    return { ok: false, message: 'Describe what is changing in a sentence or two.' };
  }
  const filled = filledLines(draft.lines);
  if (filled.length === 0) {
    return { ok: false, message: 'Add at least one line with a price.' };
  }
  if (filled.some((l) => !l.label.trim())) {
    return { ok: false, message: 'Give every line a name.' };
  }
  if (filled.some((l) => l.unit_price_cents === 0)) {
    return { ok: false, message: 'Give every line a price.' };
  }
  const lines = cleanLines(filled);
  if (!lines) {
    return { ok: false, message: 'Check the lines: each needs a name, a quantity and a price.' };
  }
  return { ok: true, lines, extraDays: parseExtraDays(draft.extraDays) };
}

/** True when what's on screen differs from what was last saved. */
export function isDirty(
  draft: ChangeOrderDraft,
  saved: { description: string; line_items: ChangeOrderLine[]; extra_days: number } | null,
): boolean {
  if (!saved) return true;
  const strip = (lines: readonly LineItem[]) =>
    lines.map((l) => [l.label.trim(), l.qty, l.unit_price_cents]);
  return (
    draft.description.trim() !== saved.description.trim() ||
    parseExtraDays(draft.extraDays) !== saved.extra_days ||
    JSON.stringify(strip(filledLines(draft.lines))) !== JSON.stringify(strip(saved.line_items))
  );
}

/**
 * When the quote charged travel per day and this change adds days, the line
 * to offer for those extra days. Null when it doesn't apply, or when the
 * change order already has a travel line.
 */
export function travelSuggestion(
  quoteTravel: TravelInput | null | undefined,
  extraDays: number,
  lines: readonly LineItem[],
): LineItem | null {
  if (!quoteTravel || quoteTravel.per !== 'day' || extraDays <= 0) return null;
  if (lines.some((l) => /^travel\b/i.test(l.label.trim()))) return null;
  const item = travelLineItem({ ...quoteTravel, days: extraDays });
  return {
    label: item.label,
    qty: item.qty,
    unit_price_cents: item.unit_price_cents,
    total_cents: item.total_cents,
  };
}
