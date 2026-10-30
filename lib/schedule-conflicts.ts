/**
 * Scheduling conflicts: another job too close (with travel time around it)
 * or a blocked-out window. Pure, unit-tested.
 *
 * Jobs have a start time but no end time, so a job is assumed to take
 * DEFAULT_JOB_MINUTES. Travel buffer (PRD CL-04) pads both sides of every job.
 */

export const DEFAULT_JOB_MINUTES = 120;
export const TRAVEL_BUFFER_OPTIONS = [0, 15, 30, 60] as const;
export type TravelBuffer = (typeof TRAVEL_BUFFER_OPTIONS)[number];

const MIN = 60_000;

export type ScheduledJob = {
  id: string;
  title: string;
  scheduled_at: string | null;
  status: string;
  customer_name?: string | null;
};

export type Block = { id: string; starts_at: string; ends_at: string };

export type Conflict =
  | { kind: 'job'; jobId: string; label: string; at: string }
  | { kind: 'block'; blockId: string; label: string; at: string };

const ACTIVE = new Set(['todo', 'scheduled', 'in_progress']);

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

export function findConflicts(input: {
  startIso: string;
  jobs: ScheduledJob[];
  blocks: Block[];
  bufferMinutes: number;
  excludeJobId?: string;
  durationMinutes?: number;
}): Conflict[] {
  const duration = (input.durationMinutes ?? DEFAULT_JOB_MINUTES) * MIN;
  const buffer = input.bufferMinutes * MIN;
  const start = Date.parse(input.startIso);
  const end = start + duration;
  const out: Conflict[] = [];

  for (const job of input.jobs) {
    if (job.id === input.excludeJobId || !job.scheduled_at || !ACTIVE.has(job.status)) continue;
    const s = Date.parse(job.scheduled_at);
    // The new job plus travel on both sides must not touch the other job.
    if (overlaps(start - buffer, end + buffer, s, s + duration)) {
      out.push({
        kind: 'job',
        jobId: job.id,
        label: job.customer_name ? `${job.title} · ${job.customer_name}` : job.title,
        at: job.scheduled_at,
      });
    }
  }

  for (const block of input.blocks) {
    if (overlaps(start, end, Date.parse(block.starts_at), Date.parse(block.ends_at))) {
      out.push({
        kind: 'block',
        blockId: block.id,
        label: 'Time you blocked off',
        at: block.starts_at,
      });
    }
  }

  return out.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
}

/** Local days (YYYY-MM-DD) a block touches, for marking the month grid. */
export function blockDays(block: Pick<Block, 'starts_at' | 'ends_at'>): string[] {
  const days: string[] = [];
  const end = new Date(Date.parse(block.ends_at) - 1);
  const d = new Date(block.starts_at);
  d.setHours(0, 0, 0, 0);
  while (d <= end) {
    days.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
    );
    d.setDate(d.getDate() + 1);
  }
  return days;
}

/** A block covering the whole local day. */
export function wholeDay(day: string): { starts_at: string; ends_at: string } {
  const [y, m, d] = day.split('-').map(Number);
  return {
    starts_at: new Date(y, m - 1, d, 0, 0, 0).toISOString(),
    ends_at: new Date(y, m - 1, d + 1, 0, 0, 0).toISOString(),
  };
}

export function isWholeDay(block: Pick<Block, 'starts_at' | 'ends_at'>): boolean {
  const s = new Date(block.starts_at);
  const e = new Date(block.ends_at);
  return (
    s.getHours() === 0 &&
    s.getMinutes() === 0 &&
    e.getHours() === 0 &&
    e.getMinutes() === 0 &&
    e.getTime() - s.getTime() >= 24 * 60 * MIN - 60 * MIN // tolerate DST days
  );
}
