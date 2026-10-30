/**
 * The job row created when a quote's contract is signed. Pure so it's
 * unit-tested; used by post-sign.ts.
 *
 * A quote with a requested start date becomes a job already scheduled for
 * that time. Without one it starts as 'todo' so it shows up as needing to be
 * scheduled (it used to jump straight to 'in_progress').
 */
export type QuoteForJob = {
  scope_of_work: string | null;
  total_cents: number;
  requested_start_at?: string | null;
  photos?: string[] | null;
};

export type JobInsertFields = {
  title: string;
  description: string | null;
  status: 'todo' | 'scheduled';
  scheduled_at: string | null;
  total_cents: number;
  photos: string[];
};

export function jobFieldsFromQuote(quote: QuoteForJob): JobInsertFields {
  const start = quote.requested_start_at ?? null;
  return {
    title: jobTitleFromScope(quote.scope_of_work),
    description: quote.scope_of_work,
    status: start ? 'scheduled' : 'todo',
    scheduled_at: start,
    total_cents: quote.total_cents,
    photos: quote.photos ?? [],
  };
}

export function jobTitleFromScope(scope: string | null): string {
  const s = (scope ?? '').trim();
  if (!s) return 'Job';
  // First sentence, capped at 60 chars.
  const firstSentence = s.split(/[.!?\n]/)[0].trim();
  const trimmed = firstSentence.length > 0 ? firstSentence : s;
  return trimmed.length > 60 ? trimmed.slice(0, 57).trimEnd() + '…' : trimmed;
}
