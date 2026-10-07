"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PatientHistoryList } from "@/components/PatientHistoryList";
import { useApiError } from "@/hooks/useApiError";
import { apiFetch } from "@/lib/apiClient";
import type { DoctorPatientHistoryResponse } from "@/lib/types";

export default function DoctorPatientHistoryPage() {
  const params = useParams<{ patientId: string }>();
  const router = useRouter();
  const { handle } = useApiError();
  const [data, setData] = useState<DoctorPatientHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<DoctorPatientHistoryResponse>(`/doctor/patients/${params.patientId}`);
      setData(result);
    } catch (err) {
      handle(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.patientId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!data) {
    return <div className="empty-state">Unable to load patient history.</div>;
  }

  return (
    <div>
      <div className="page-header">
        <h1>Patient History — {data.patient.name}</h1>
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>
          Back
        </button>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="detail-row">
          <span className="k">Code</span>
          <span>{data.patient.patientCode}</span>
        </div>
        <div className="detail-row">
          <span className="k">Age</span>
          <span>{data.patient.age}</span>
        </div>
        <div className="detail-row">
          <span className="k">Gender</span>
          <span>{data.patient.gender}</span>
        </div>
        <div className="detail-row">
          <span className="k">Phone</span>
          <span>{data.patient.phone ?? "-"}</span>
        </div>
        <div className="detail-row">
          <span className="k">Address</span>
          <span>{data.patient.address ?? "-"}</span>
        </div>
      </div>

      <div className="panel">
        <h2>Visit history</h2>
        <PatientHistoryList history={data.history} />
      </div>
    </div>
  );
}
