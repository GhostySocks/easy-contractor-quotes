/**
 * Which job reminders to schedule or cancel. Pure, unit-tested.
 *
 * Reminders are reconciled from the job list (on Home focus and after a
 * schedule change) instead of being hooked into every place a job can be
 * scheduled. That covers jobs scheduled by a quote's start date on signing,
 * the calendar tab, and edits on job detail alike.
 */

export const REMINDER_LEAD_MINUTES = 60;

export type ReminderJob = {
  id: string;
  status: string;
  scheduled_at: string | null;
};

/** jobId -> { notification id, the scheduled_at it was set for } */
export type ReminderMap = Record<string, { notificationId: string; scheduledAt: string }>;

export type ReminderPlan = {
  schedule: { jobId: string; fireAt: number; scheduledAt: string }[];
  cancel: string[];
};

/** When to remind for a job, or null if it shouldn't get one. */
export function reminderTime(
  job: ReminderJob,
  now: number,
  leadMinutes = REMINDER_LEAD_MINUTES,
): number | null {
  if (!job.scheduled_at) return null;
  if (job.status !== 'scheduled' && job.status !== 'todo') return null;
  const fireAt = Date.parse(job.scheduled_at) - leadMinutes * 60_000;
  return fireAt > now ? fireAt : null;
}

/**
 * Compare the jobs we know about with the reminders already scheduled.
 * `knownJobIds` limits cancellation to jobs this list is authoritative for,
 * so reconciling a partial list never cancels reminders for jobs not in it;
 * pass null when the list is every active job.
 */
export function planReminders(
  jobs: ReminderJob[],
  existing: ReminderMap,
  now: number,
  knownJobIds: Set<string> | null = null,
  leadMinutes = REMINDER_LEAD_MINUTES,
): ReminderPlan {
  const schedule: ReminderPlan['schedule'] = [];
  const cancel: string[] = [];
  const wanted = new Map<string, { fireAt: number; scheduledAt: string }>();

  for (const job of jobs) {
    const fireAt = reminderTime(job, now, leadMinutes);
    if (fireAt !== null && job.scheduled_at)
      wanted.set(job.id, { fireAt, scheduledAt: job.scheduled_at });
  }

  for (const [jobId, entry] of Object.entries(existing)) {
    const inScope = knownJobIds === null || knownJobIds.has(jobId);
    if (!inScope) continue;
    const want = wanted.get(jobId);
    if (!want || want.scheduledAt !== entry.scheduledAt) cancel.push(jobId);
  }

  for (const [jobId, want] of wanted) {
    const have = existing[jobId];
    if (!have || have.scheduledAt !== want.scheduledAt) {
      schedule.push({ jobId, fireAt: want.fireAt, scheduledAt: want.scheduledAt });
    }
  }
  return { schedule, cancel };
}
