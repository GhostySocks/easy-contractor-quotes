/**
 * A job's history, assembled from timestamps already stored on the job, its
 * contract and its invoice. Pure, unit-tested. There is no event log table,
 * so this shows what happened and when, not who did it.
 */

export type TimelineEvent = {
  key: string;
  label: string;
  /** ISO timestamp; null for an event with no recorded time (cancelled). */
  at: string | null;
  /** True for the event that describes where the job is now. */
  current?: boolean;
};

type Input = {
  job: {
    status: string;
    created_at: string;
    scheduled_at: string | null;
    completed_at: string | null;
  };
  contract?: { signed_at: string | null } | null;
  invoice?: { created_at: string; sent_at: string | null; paid_at: string | null } | null;
  now?: number;
};

export function buildTimeline({
  job,
  contract,
  invoice,
  now = Date.now(),
}: Input): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  if (contract?.signed_at) {
    events.push({ key: 'signed', label: 'Contract signed', at: contract.signed_at });
  }
  events.push({ key: 'created', label: 'Job created', at: job.created_at });

  if (job.scheduled_at) {
    const upcoming = Date.parse(job.scheduled_at) > now;
    events.push({
      key: 'scheduled',
      label: upcoming ? 'Scheduled to start' : 'Started on schedule',
      at: job.scheduled_at,
    });
  }
  if (job.completed_at) {
    events.push({ key: 'completed', label: 'Marked completed', at: job.completed_at });
  }
  if (invoice) {
    events.push({ key: 'invoiced', label: 'Invoice created', at: invoice.created_at });
    if (invoice.sent_at) events.push({ key: 'sent', label: 'Invoice sent', at: invoice.sent_at });
    if (invoice.paid_at) events.push({ key: 'paid', label: 'Paid', at: invoice.paid_at });
  }

  events.sort((a, b) => Date.parse(a.at ?? '') - Date.parse(b.at ?? ''));

  if (job.status === 'cancelled') {
    events.push({ key: 'cancelled', label: 'Cancelled', at: null });
  }

  // The latest event that has already happened is "current"; an upcoming
  // scheduled start is shown but not current.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.at === null || Date.parse(e.at) <= now) {
      events[i] = { ...e, current: true };
      break;
    }
  }
  return events;
}
