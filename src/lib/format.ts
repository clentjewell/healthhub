/** Shared formatting helpers for classes/events (used by Health Hub + /hub/ proposal). */

const TZ = 'Australia/Sydney';

export function formatEventDate(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: TZ,
  }).format(date);
}

export function formatEventTime(date: Date): string {
  return new Intl.DateTimeFormat('en-AU', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TZ,
  }).format(date);
}

/** "9:00am" from a "HH:MM" string. */
export function formatClock(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'am' : 'pm';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')}${period}`;
}

export const DAY_ORDER = [
  'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday',
] as const;

export const CATEGORY_LABEL: Record<string, string> = {
  yoga: 'Yoga',
  pilates: 'Pilates',
  sound: 'Sound',
  movement: 'Movement',
  meditation: 'Meditation',
  workshop: 'Workshop',
  seminar: 'Seminar',
  'sound-bath': 'Sound Bath',
  course: 'Course',
  community: 'Community',
  other: 'Class',
};
