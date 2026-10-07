// Formatting helpers per CW-R10: dates dd-MM-yyyy, times hh:mm AM/PM.

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Accepts "YYYY-MM-DD" or any ISO date/datetime string; returns dd-MM-yyyy. */
export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const datePart = value.length >= 10 ? value.slice(0, 10) : value;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(datePart);
  if (!match) return value;
  const [, y, m, d] = match;
  return `${d}-${m}-${y}`;
}

/** Accepts "HH:mm" (24h) and returns hh:mm AM/PM. */
export function formatTime24(value: string | null | undefined): string {
  if (!value) return "-";
  const match = /^(\d{1,2}):(\d{2})/.exec(value);
  if (!match) return value;
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${pad(hours)}:${minutes} ${suffix}`;
}

/** Accepts an ISO datetime string (e.g. from MongoDB) and returns dd-MM-yyyy hh:mm AM/PM. */
export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  let hours = d.getHours();
  const minutes = pad(d.getMinutes());
  const suffix = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${day}-${month}-${year} ${pad(hours)}:${minutes} ${suffix}`;
}

/** Today as YYYY-MM-DD, suitable for <input type="date"> default value. */
export function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
