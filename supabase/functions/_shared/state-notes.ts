/**
 * State-specific disclosures shown under a quote. Static text keyed by state
 * code: no model call needed, identical wording every time, and one place to
 * update when legal review changes it (PRD §8).
 *
 * Thresholds and plain-English summaries only. Not legal advice; wording is
 * pending per-state attorney review.
 */
export const STATE_NOTES: Record<string, string> = {
  TX:
    "Texas: for work over $250, the contractor may have mechanic's lien rights on the property. " +
    'Gas, electrical and plumbing work may require a permit.',
  CA:
    'California: you have the right to cancel this contract within 3 business days of signing. ' +
    'Work over $500 (labor and materials) must be done by a CSLB-licensed contractor.',
  FL:
    'Florida: contractors and suppliers who are not paid may have lien rights on the property ' +
    '(Florida Statutes Chapter 713). You may cancel a home-solicitation sale within 3 business days.',
  NY:
    'New York: home improvement work over $500 requires a written contract with an itemized price, ' +
    'approximate start and completion dates, and a 3-business-day right to cancel.',
  NC: 'North Carolina: projects over $30,000 must be performed by a licensed general contractor.',
};

export function stateNoteFor(stateCode: string | null | undefined): string | null {
  if (!stateCode) return null;
  return STATE_NOTES[stateCode.toUpperCase()] ?? null;
}
