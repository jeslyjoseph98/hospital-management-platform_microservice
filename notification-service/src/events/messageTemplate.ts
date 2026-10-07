import { AppointmentBookedPayload } from './types';

function pad2(n: number): string {
  return n.toString().padStart(2, '0');
}

function formatDateDdMmYyyy(dateStr: string): string {
  // Accept 'YYYY-MM-DD' (date-only) or a full ISO timestamp; format as dd-MM-yyyy.
  const datePart = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
  const [yyyy, mm, dd] = datePart.split('-');
  return `${dd}-${mm}-${yyyy}`;
}

function formatTimeHhMmA(timeStr: string): string {
  // Accept 'HH:mm', 'HH:mm:ss', or a full ISO timestamp; format as hh:mm AM/PM.
  let timePart = timeStr;
  if (timeStr.includes('T')) {
    timePart = timeStr.split('T')[1].replace('Z', '');
  }
  const [hStr, mStr] = timePart.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${pad2(h)}:${pad2(m)} ${period}`;
}

/**
 * Builds the "Booking successful" notification message per SVC-06 §4:
 * "Your appointment with {doctorName} ({departmentName}) on {dd-MM-yyyy} is confirmed.
 *  Token No: {tokenNumber}. Please report by {hh:mm a}."
 */
export function renderBookingConfirmedMessage(payload: AppointmentBookedPayload): string {
  const date = formatDateDdMmYyyy(payload.appointmentDate);
  const time = formatTimeHhMmA(payload.reportingTime);
  return `Your appointment with ${payload.doctorName} (${payload.departmentName}) on ${date} is confirmed. Token No: ${payload.tokenNumber}. Please report by ${time}.`;
}

export const BOOKING_CONFIRMED_TITLE = 'Booking successful';
