/**
 * What to show while the AI writes a quote. Pure, unit-tested. The steps are
 * honest about what the pipeline does (read, price, check the math); the
 * timing is approximate since the call is one request.
 */
export const QUOTE_PROGRESS_STEPS = [
  { afterMs: 0, label: 'Reading the job…' },
  { afterMs: 1500, label: 'Pricing labor and materials…' },
  { afterMs: 3500, label: 'Checking the math…' },
  { afterMs: 8000, label: 'Almost there…' },
] as const;

export function progressLabel(elapsedMs: number): string {
  let label: string = QUOTE_PROGRESS_STEPS[0].label;
  for (const step of QUOTE_PROGRESS_STEPS) {
    if (elapsedMs >= step.afterMs) label = step.label;
  }
  return label;
}
