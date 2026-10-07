// Display formatting rules — SVC-07A AW-R8: dates dd-MM-yyyy, times hh:mm AM/PM, fee as ₹500.00.

/** Parses "YYYY-MM-DD" (date-only, no timezone conversion) and renders dd-MM-yyyy. */
export function formatDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('T')[0].split('-');
  if (!year || !month || !day) return isoDate;
  return `${day}-${month}-${year}`;
}

/** Formats a "HH:mm" (24h) string as "hh:mm AM/PM". */
export function formatTime(time: string | null | undefined): string {
  if (!time) return '';
  const [hStr, mStr] = time.split(':');
  let hours = parseInt(hStr, 10);
  const minutes = mStr ?? '00';
  const suffix = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${String(hours).padStart(2, '0')}:${minutes.padStart(2, '0')} ${suffix}`;
}

export function formatFee(fee: number | null | undefined): string {
  const value = typeof fee === 'number' ? fee : 0;
  return `₹${value.toFixed(2)}`;
}

export const DAY_NAMES: Record<number, string> = {
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
  5: 'Friday',
  6: 'Saturday',
  7: 'Sunday',
};

export const DAY_SHORT: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  7: 'Sun',
};

/** Returns today's date as "YYYY-MM-DD" in the browser's local time. */
export function todayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
