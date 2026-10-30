import * as Calendar from 'expo-calendar';

/** Default length of a calendar entry when the job has no end time. */
const DEFAULT_DURATION_MS = 2 * 60 * 60_000;

/**
 * Open the phone's own "new event" screen prefilled with the job, so the
 * contractor picks which calendar it goes in. Uses the system dialog, so no
 * calendar permission is needed and nothing is written without their tap.
 */
export async function addJobToPhoneCalendar(job: {
  title: string;
  scheduled_at: string;
  description: string | null;
  address: string | null;
  customerName: string | null;
}): Promise<void> {
  const start = new Date(job.scheduled_at);
  await Calendar.createEventInCalendarAsync({
    title: job.customerName ? `${job.title} · ${job.customerName}` : job.title,
    startDate: start,
    endDate: new Date(start.getTime() + DEFAULT_DURATION_MS),
    location: job.address ?? undefined,
    notes: job.description ?? undefined,
  });
}
