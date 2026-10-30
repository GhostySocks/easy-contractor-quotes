/**
 * Start-time slots for scheduling. Pure, unit-tested. Times are minutes after
 * local midnight; days are local YYYY-MM-DD.
 */

export const DEFAULT_START_MINUTES = 9 * 60;

/** 6:00 AM to 7:00 PM in 30-minute steps: the working day for a solo trade. */
export const TIME_SLOTS: number[] = Array.from({ length: 27 }, (_, i) => 6 * 60 + i * 30);

export function formatSlot(minutes: number): string {
  const h24 = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Local timestamp for a day + minutes, as ISO. */
export function atDayAndMinutes(day: string, minutes: number): string {
  const [y, mo, d] = day.split('-').map(Number);
  return new Date(y, mo - 1, d, Math.floor(minutes / 60), minutes % 60, 0).toISOString();
}

/** Local minutes-after-midnight of an ISO timestamp. */
export function minutesOf(iso: string): number {
  const d = new Date(iso);
  return d.getHours() * 60 + d.getMinutes();
}

/** The slot closest to `minutes` (ties go earlier), so an odd stored time still shows selected. */
export function nearestSlot(minutes: number): number {
  let best = TIME_SLOTS[0];
  for (const slot of TIME_SLOTS) {
    if (Math.abs(slot - minutes) < Math.abs(best - minutes)) best = slot;
  }
  return best;
}
