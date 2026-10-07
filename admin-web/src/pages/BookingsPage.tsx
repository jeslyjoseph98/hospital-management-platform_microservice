import { useEffect, useState } from 'react';
import { getAdminBookings } from '../api/bookings';
import { listDepartments } from '../api/departments';
import { getDoctor, listDoctors } from '../api/doctors';
import { ApiRequestError } from '../types/api';
import { AdminBookingsView, Department, DoctorDetail, DoctorListItem } from '../types/domain';
import { formatTime, todayIso } from '../utils/format';

export function BookingsPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');

  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [doctorId, setDoctorId] = useState<string>('');
  const [doctorDetail, setDoctorDetail] = useState<DoctorDetail | null>(null);

  const [date, setDate] = useState<string>(todayIso());

  const [view, setView] = useState<AdminBookingsView | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    setDoctorId('');
    setDoctorDetail(null);
    setView(null);
    if (!departmentId) {
      setDoctors([]);
      return;
    }
    listDoctors({ departmentId: Number(departmentId), active: true, page: 0, size: 100 })
      .then((data) => setDoctors(data.content))
      .catch(() => setDoctors([]));
  }, [departmentId]);

  useEffect(() => {
    if (!doctorId) {
      setDoctorDetail(null);
      return;
    }
    getDoctor(Number(doctorId))
      .then(setDoctorDetail)
      .catch(() => setDoctorDetail(null));
  }, [doctorId]);

  useEffect(() => {
    if (!doctorId || !date) {
      setView(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    getAdminBookings(Number(doctorId), date)
      .then((data) => {
        if (!cancelled) setView(data);
      })
      .catch((err) => {
        if (cancelled) return;
        setView(null);
        setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load bookings.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [doctorId, date]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Bookings</h1>
      </div>

      <div className="filters-bar">
        <div className="form-field">
          <label htmlFor="booking-department">Department</label>
          <select id="booking-department" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
            <option value="">Select department</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.deptName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="booking-doctor">Doctor</label>
          <select
            id="booking-doctor"
            value={doctorId}
            onChange={(e) => setDoctorId(e.target.value)}
            disabled={!departmentId}
          >
            <option value="">Select doctor</option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.fullName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="booking-date">Date</label>
          <input
            id="booking-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={!doctorId}
          />
        </div>
      </div>

      {loadError && <p className="error-banner">{loadError}</p>}

      {!doctorId && <p>Select a department and doctor to view bookings.</p>}

      {doctorId && isLoading && <p>Loading…</p>}

      {doctorId && !isLoading && view && (
        <>
          <p className="booking-count">
            {view.booked} / {doctorDetail?.dailyLimit ?? '—'} booked
          </p>

          <table className="data-table">
            <thead>
              <tr>
                <th>Token</th>
                <th>Patient</th>
                <th>Code</th>
                <th>Reporting time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {view.tokens.map((t) => (
                <tr key={t.tokenNumber}>
                  <td>{t.tokenNumber}</td>
                  <td>{t.patientName}</td>
                  <td>{t.patientCode}</td>
                  <td>{formatTime(t.reportingTime)}</td>
                  <td>{t.status}</td>
                </tr>
              ))}
              {view.tokens.length === 0 && (
                <tr>
                  <td colSpan={5}>No bookings for this date.</td>
                </tr>
              )}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
