import { progressLabel } from '../ai-progress';
import { planReminders, reminderTime, type ReminderJob } from '../reminder-plan';

const now = Date.parse('2026-10-30T12:00:00Z');
const at = (hoursFromNow: number) => new Date(now + hoursFromNow * 3_600_000).toISOString();

describe('reminderTime', () => {
  it('fires an hour before a future scheduled job', () => {
    expect(reminderTime({ id: 'a', status: 'scheduled', scheduled_at: at(3) }, now)).toBe(
      now + 2 * 3_600_000,
    );
  });

  it('skips jobs that are past, too close, unscheduled, or not upcoming', () => {
    expect(reminderTime({ id: 'a', status: 'scheduled', scheduled_at: at(-1) }, now)).toBeNull();
    expect(reminderTime({ id: 'a', status: 'scheduled', scheduled_at: at(0.5) }, now)).toBeNull();
    expect(reminderTime({ id: 'a', status: 'scheduled', scheduled_at: null }, now)).toBeNull();
    expect(reminderTime({ id: 'a', status: 'completed', scheduled_at: at(5) }, now)).toBeNull();
    expect(reminderTime({ id: 'a', status: 'cancelled', scheduled_at: at(5) }, now)).toBeNull();
  });
});

describe('planReminders', () => {
  const jobs: ReminderJob[] = [
    { id: 'new', status: 'scheduled', scheduled_at: at(5) },
    { id: 'same', status: 'scheduled', scheduled_at: at(6) },
    { id: 'moved', status: 'scheduled', scheduled_at: at(9) },
    { id: 'cancelled', status: 'cancelled', scheduled_at: at(7) },
  ];
  const existing = {
    same: { notificationId: 'n1', scheduledAt: at(6) },
    moved: { notificationId: 'n2', scheduledAt: at(8) },
    cancelled: { notificationId: 'n3', scheduledAt: at(7) },
    gone: { notificationId: 'n4', scheduledAt: at(10) },
  };

  it('schedules new and moved jobs, cancels moved, cancelled and vanished ones', () => {
    const plan = planReminders(jobs, existing, now);
    expect(plan.schedule.map((s) => s.jobId).sort()).toEqual(['moved', 'new']);
    expect(plan.cancel.sort()).toEqual(['cancelled', 'gone', 'moved']);
  });

  it('only cancels jobs inside the known set for a partial list', () => {
    const plan = planReminders([jobs[0]], existing, now, new Set(['new']));
    expect(plan.cancel).toEqual([]);
    expect(plan.schedule.map((s) => s.jobId)).toEqual(['new']);
  });
});

describe('progressLabel', () => {
  it('steps through the stages as time passes', () => {
    expect(progressLabel(0)).toBe('Reading the job…');
    expect(progressLabel(2000)).toBe('Pricing labor and materials…');
    expect(progressLabel(4000)).toBe('Checking the math…');
    expect(progressLabel(20000)).toBe('Almost there…');
  });
});
