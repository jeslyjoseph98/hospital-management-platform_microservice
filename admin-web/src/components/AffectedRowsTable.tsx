import { AffectedRow } from '../types/api';
import { formatDate } from '../utils/format';

/**
 * Small table of affected dates/booked counts shown alongside a 409 error message
 * (e.g. ADM_DAY_HAS_BOOKINGS, ADM_LIMIT_BELOW_BOOKED, ADM_DOCTOR_HAS_BOOKINGS) — SVC-07A §7.
 */
export function AffectedRowsTable({ rows }: { rows: AffectedRow[] }) {
  if (!rows || rows.length === 0) return null;

  return (
    <table className="affected-rows-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Booked</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.date}>
            <td>{formatDate(row.date)}</td>
            <td>{row.booked}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
