import { ApiRequestError } from '../types/api';
import { AffectedRowsTable } from './AffectedRowsTable';

/**
 * Renders an ApiRequestError's message plus, when present, the data.affected table
 * (409 ADM_DAY_HAS_BOOKINGS / ADM_LIMIT_BELOW_BOOKED / ADM_DOCTOR_HAS_BOOKINGS) — SVC-07A §7, AW-R6.
 */
export function ErrorBanner({ error }: { error: ApiRequestError | null }) {
  if (!error) return null;

  const affected = error.data?.affected;

  return (
    <div className="error-banner" role="alert">
      <p>{error.message}</p>
      {affected && affected.length > 0 && <AffectedRowsTable rows={affected} />}
    </div>
  );
}
