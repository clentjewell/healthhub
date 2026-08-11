/**
 * "Add to calendar" link + .ics generation for the studio's recurring classes.
 *
 * The offerings repeat weekly rather than happening once, so a session is
 * stored as a weekday plus a start/end time (see `sessions` in the events
 * schema) and turned into a WEEKLY recurring entry here. Nothing is inferred
 * from prose — an event with no `sessions` simply gets no calendar links.
 *
 * Times are written as ICS "floating" local times (no Z, no TZID). The studio
 * and its attendees are all in one place, so local time is what everyone means,
 * and floating times avoid shipping a VTIMEZONE block that some clients ignore
 * anyway. NSW observes DST, so a hardcoded UTC offset would be wrong for half
 * the year — hence no offset in the Outlook links either.
 */

export interface Session {
  /** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
  day: number;
  /** "HH:MM", 24-hour. */
  start: string;
  /** "HH:MM", 24-hour. */
  end: string;
  /** Optional name, when one listing covers several distinct classes. */
  label?: string;
}

export interface CalendarEvent {
  title: string;
  description: string;
  location: string;
  /** Absolute URL of the event page. */
  url: string;
  slug: string;
  sessions: Session[];
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

export const dayName = (day: number) => DAY_NAMES[day] ?? '';

/** Human-readable "Sundays 8:00am – 9:15am", prefixed with the class name if set. */
export function sessionLabel(s: Session): string {
  const when = `${DAY_NAMES[s.day]}s ${time12(s.start)} – ${time12(s.end)}`;
  return s.label ? `${s.label} — ${when}` : when;
}

export function time12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const hour = h % 12 === 0 ? 12 : h % 12;
  // Always show minutes: "8:00am – 9:15am" reads more evenly than "8am – 9:15am".
  return `${hour}:${String(m).padStart(2, '0')}${suffix}`;
}

/**
 * The next date this weekday falls on, at or after `from`. Used as the DTSTART
 * of the recurring entry; because the rule repeats weekly, a start that has
 * since slipped into the past still yields the right future occurrences.
 */
export function nextOccurrence(day: number, from: Date = new Date()): Date {
  const d = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  d.setDate(d.getDate() + ((day - d.getDay() + 7) % 7));
  return d;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** "20260215T080000" — ICS/Google local-time format. */
export function stampCompact(date: Date, hhmm: string): string {
  const [h, m] = hhmm.split(':');
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${h}${m}00`;
}

/** "2026-02-15T08:00:00" — the format Outlook's compose URL expects. */
export function stampIso(date: Date, hhmm: string): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${hhmm}:00`;
}

/** Escape a value for an ICS text field. */
function icsText(v: string): string {
  return v
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** RFC 5545 caps a content line at 75 octets; continuations start with a space. */
function fold(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [line.slice(0, 75)];
  let rest = line.slice(75);
  while (rest.length > 74) {
    parts.push(' ' + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  if (rest) parts.push(' ' + rest);
  return parts.join('\r\n');
}

/**
 * One VEVENT per session, each repeating weekly — so an event running on three
 * days imports as three recurring entries rather than one wrong one.
 */
export function buildIcs(ev: CalendarEvent, now: Date = new Date()): string {
  const dtstamp =
    `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}` +
    `T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Health Hub Tweed Coast//Classes and Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${icsText(ev.title)}`,
    'X-WR-TIMEZONE:Australia/Sydney',
  ];

  ev.sessions.forEach((s, i) => {
    const date = nextOccurrence(s.day, now);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${ev.slug}-${i}@healthhubtweedcoast.com.au`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${stampCompact(date, s.start)}`,
      `DTEND:${stampCompact(date, s.end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.day]}`,
      // Name the slot when it has its own label, so a listing covering three
      // different classes imports as three recognisable entries.
      `SUMMARY:${icsText(s.label ?? ev.title)}`,
      `DESCRIPTION:${icsText(`${ev.description}\n\n${ev.url}`)}`,
      `LOCATION:${icsText(ev.location)}`,
      `URL:${ev.url}`,
      'END:VEVENT',
    );
  });

  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

/**
 * Google and Outlook compose URLs take a single event, so they use the soonest
 * session. The .ics carries every session — that difference is surfaced in the
 * dropdown when an event runs more than once a week.
 */
export function googleUrl(ev: CalendarEvent, now: Date = new Date()): string | undefined {
  const s = soonest(ev.sessions, now);
  if (!s) return undefined;
  const date = nextOccurrence(s.day, now);
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: s.label ?? ev.title,
    dates: `${stampCompact(date, s.start)}/${stampCompact(date, s.end)}`,
    details: `${ev.description}\n\n${ev.url}`,
    location: ev.location,
    ctz: 'Australia/Sydney',
  });
  // Not via URLSearchParams: Google needs the RRULE colon and semicolons raw.
  return `https://calendar.google.com/calendar/render?${p}&recur=RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[s.day]}`;
}

export function outlookUrl(
  ev: CalendarEvent,
  host: 'office' | 'live',
  now: Date = new Date(),
): string | undefined {
  const s = soonest(ev.sessions, now);
  if (!s) return undefined;
  const date = nextOccurrence(s.day, now);
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: s.label ?? ev.title,
    startdt: stampIso(date, s.start),
    enddt: stampIso(date, s.end),
    location: ev.location,
    body: `${ev.description}\n\n${ev.url}`,
  });
  const domain = host === 'office' ? 'outlook.office.com' : 'outlook.live.com';
  return `https://${domain}/owa/?${p}`;
}

/** The session happening soonest from `now`. */
export function soonest(sessions: Session[], now: Date = new Date()): Session | undefined {
  if (sessions.length === 0) return undefined;
  return [...sessions].sort(
    (a, b) => nextOccurrence(a.day, now).getTime() - nextOccurrence(b.day, now).getTime()
      || a.start.localeCompare(b.start),
  )[0];
}
