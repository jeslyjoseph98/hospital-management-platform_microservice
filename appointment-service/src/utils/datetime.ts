import { config } from '../config/env';

/**
 * All "today" / day-boundary computations are done in the hospital time zone
 * (Asia/Kolkata), per SVC-00 §5, regardless of the host machine's TZ.
 */

const DAY_NAMES = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY'
];

/** Returns the parts (year, month, day, hour, minute, second) of "now" in Asia/Kolkata. */
function nowPartsInTz(date: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number; // 0=Sunday .. 6=Saturday
} {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: config.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });
  const parts = fmt.formatToParts(date);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const weekdayShort = map.weekday; // e.g. "Mon"
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };
  // hour12:false with Intl can produce "24" for midnight; normalize to 0
  let hour = parseInt(map.hour, 10);
  if (hour === 24) hour = 0;
  return {
    year: parseInt(map.year, 10),
    month: parseInt(map.month, 10),
    day: parseInt(map.day, 10),
    hour,
    minute: parseInt(map.minute, 10),
    second: parseInt(map.second, 10),
    weekday: weekdayMap[weekdayShort]
  };
}

/** Today's date (Asia/Kolkata) as YYYY-MM-DD. */
export function todayDateStr(date: Date = new Date()): string {
  const p = nowPartsInTz(date);
  return `${p.year.toString().padStart(4, '0')}-${p.month.toString().padStart(2, '0')}-${p.day
    .toString()
    .padStart(2, '0')}`;
}

/** Current time-of-day (Asia/Kolkata) as HH:MM (24h). */
export function nowTimeStr(date: Date = new Date()): string {
  const p = nowPartsInTz(date);
  return `${p.hour.toString().padStart(2, '0')}:${p.minute.toString().padStart(2, '0')}`;
}

/** Adds `days` calendar days to a YYYY-MM-DD date string, returns YYYY-MM-DD. */
export function addDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  // Use UTC noon to avoid any DST-like shifting; date-only arithmetic.
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  dt.setUTCDate(dt.getUTCDate() + days);
  const yy = dt.getUTCFullYear();
  const mm = (dt.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = dt.getUTCDate().toString().padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

/** Day-of-week name (MONDAY, TUESDAY, ...) for a YYYY-MM-DD date string, independent of host TZ. */
export function dayOfWeekName(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return DAY_NAMES[dt.getUTCDay()];
}

/** Day-of-week ISO-ish number used by doctor-service timings: 1=Monday..7=Sunday. */
export function dayOfWeekNumber(dateStr: string): number {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const jsDay = dt.getUTCDay(); // 0=Sunday..6=Saturday
  return jsDay === 0 ? 7 : jsDay;
}

/** Compares two HH:MM time strings. Returns negative/0/positive like a normal comparator. */
export function compareTimeStr(a: string, b: string): number {
  return a.localeCompare(b);
}

/** Minutes between two HH:MM time strings (b - a). */
export function minutesBetween(a: string, b: string): number {
  const [ah, am] = a.split(':').map(Number);
  const [bh, bm] = b.split(':').map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

/** Adds minutes to an HH:MM time string, returns HH:MM (not wrapping past 24h expected here). */
export function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  const hh = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const mm = (total % 60).toString().padStart(2, '0');
  return `${hh}:${mm}`;
}

/** Formats a YYYY-MM-DD date string as dd-MM-yyyy for user-facing messages. */
export function formatDateDMY(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}-${m}-${y}`;
}

/** Computes age in years from a YYYY-MM-DD date of birth, as of today (Asia/Kolkata). */
export function ageFromDob(dob: string, asOf: Date = new Date()): number {
  const todayStr = todayDateStr(asOf);
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [by, bm, bd] = dob.split('-').map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age--;
  return age;
}
