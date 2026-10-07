"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useApiError } from "@/hooks/useApiError";
import { apiFetch } from "@/lib/apiClient";
import { formatTime24 } from "@/lib/format";
import type { TodayAppointmentsResponse } from "@/lib/types";

function DoctorTodayContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handle } = useApiError();
  const [data, setData] = useState<TodayAppointmentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const justCompleted = searchParams.get("justCompleted") === "1";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<TodayAppointmentsResponse>("/doctor/appointments/today");
      setData(result);
    } catch (err) {
      handle(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    // After completing a consultation, appointment-service applies the status
    // change asynchronously (consumes consultation.completed). Refresh once
    // more after a short delay so the row picks up COMPLETED.
    if (!justCompleted) return;
    const timer = setTimeout(() => {
      load();
      router.replace("/doctor/today");
    }, 3000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCompleted]);

  return (
    <div>
      <div className="page-header">
        <h1>Today&apos;s Appointments</h1>
        <button type="button" className="btn btn-secondary" onClick={load} disabled={loading}>
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {justCompleted && (
        <p className="note">Status updates in a few seconds. Refreshing automatically...</p>
      )}

      {data && (
        <div className="counts-row">
          <div className="count-card">
            <div className="value">{data.total}</div>
            <div className="label">Total</div>
          </div>
          <div className="count-card">
            <div className="value">{data.completed}</div>
            <div className="label">Completed</div>
          </div>
          <div className="count-card">
            <div className="value">{data.pending}</div>
            <div className="label">Pending</div>
          </div>
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Token</th>
              <th>Reporting time</th>
              <th>Patient</th>
              <th>Code</th>
              <th>Age</th>
              <th>Gender</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {data?.appointments.map((apt) => (
              <tr key={apt.appointmentId}>
                <td>{apt.tokenNumber}</td>
                <td>{formatTime24(apt.reportingTime)}</td>
                <td>{apt.patientName}</td>
                <td>{apt.patientCode}</td>
                <td>{apt.age}</td>
                <td>{apt.gender}</td>
                <td>
                  <span
                    className={`status-badge ${apt.status === "COMPLETED" ? "status-completed" : "status-booked"}`}
                  >
                    {apt.status}
                  </span>
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => router.push(`/doctor/consultations/${apt.appointmentId}`)}
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!loading && data?.appointments.length === 0 && (
          <div className="empty-state">No appointments for today.</div>
        )}
      </div>
    </div>
  );
}

export default function DoctorTodayPage() {
  return (
    <Suspense fallback={<div className="page-loading">Loading...</div>}>
      <DoctorTodayContent />
    </Suspense>
  );
}
