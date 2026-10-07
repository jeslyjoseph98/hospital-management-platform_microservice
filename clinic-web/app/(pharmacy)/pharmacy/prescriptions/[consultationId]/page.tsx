"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/context/ToastContext";
import { useApiError } from "@/hooks/useApiError";
import { apiFetch, ApiRequestError } from "@/lib/apiClient";
import { formatDate, formatDateTime } from "@/lib/format";
import type { DispenseResponse, PrescriptionDetail } from "@/lib/types";

export default function PharmacyDispenseDetailPage() {
  const params = useParams<{ consultationId: string }>();
  const router = useRouter();
  const { handle } = useApiError();
  const { showToast } = useToast();

  const [detail, setDetail] = useState<PrescriptionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiFetch<PrescriptionDetail>(`/pharmacy/prescriptions/${params.consultationId}`);
      setDetail(result);
      setRemarks(result.dispense.remarks ?? "");
    } catch (err) {
      handle(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.consultationId]);

  useEffect(() => {
    load();
  }, [load]);

  async function markAsDone() {
    setSubmitting(true);
    try {
      await apiFetch<DispenseResponse>(`/pharmacy/prescriptions/${params.consultationId}/dispense`, {
        method: "POST",
        body: JSON.stringify({ remarks: remarks.trim() || undefined }),
      });
      showToast("Marked as done", "success");
      setShowConfirm(false);
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError && err.errorCode === "PHR_ALREADY_DISPENSED") {
        showToast("Already marked as done by another pharmacist", "error");
        setShowConfirm(false);
        await load();
        return;
      }
      handle(err);
      setShowConfirm(false);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!detail) {
    return <div className="empty-state">Unable to load this prescription.</div>;
  }

  const isDispensed = detail.dispense.status === "DISPENSED";
  const isNothingToDispense = detail.dispense.status === "NOT_REQUIRED";

  return (
    <div>
      <div className="page-header">
        <h1>Prescription — {detail.patientName}</h1>
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/pharmacy/prescriptions")}>
          Back
        </button>
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <div className="detail-row">
          <span className="k">Patient</span>
          <span>
            {detail.patientName} ({detail.patientCode})
          </span>
        </div>
        <div className="detail-row">
          <span className="k">Age / Gender</span>
          <span>
            {detail.age} / {detail.gender}
          </span>
        </div>
        <div className="detail-row">
          <span className="k">Doctor</span>
          <span>{detail.doctorName}</span>
        </div>
        <div className="detail-row">
          <span className="k">Department</span>
          <span>{detail.departmentName}</span>
        </div>
        <div className="detail-row">
          <span className="k">Consultation date</span>
          <span>{formatDateTime(detail.completedAt)}</span>
        </div>
        <div className="detail-row">
          <span className="k">Diagnosis</span>
          <span>{detail.diagnosis ?? "-"}</span>
        </div>
        {detail.followUpDate && (
          <div className="detail-row">
            <span className="k">Follow-up</span>
            <span>{formatDate(detail.followUpDate)}</span>
          </div>
        )}
      </div>

      <div className="panel" style={{ marginBottom: "1.25rem" }}>
        <h2>Prescription</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Medicine</th>
                <th>Strength</th>
                <th>Dosage</th>
                <th>Timing</th>
                <th>Days</th>
                <th>Instructions</th>
              </tr>
            </thead>
            <tbody>
              {detail.prescription.map((item, idx) => (
                <tr key={idx}>
                  <td>{item.medicineName}</td>
                  <td>{item.strength ?? "-"}</td>
                  <td>{item.dosagePattern}</td>
                  <td>{item.timing}</td>
                  <td>{item.durationDays}</td>
                  <td>{item.instructions ?? "-"}</td>
                </tr>
              ))}
              {detail.prescription.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-state">
                    No medicines prescribed.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>Dispense</h2>
        {isDispensed ? (
          <p>
            Given on {formatDateTime(detail.dispense.at)} by {detail.dispense.byName}
            {detail.dispense.remarks ? ` — ${detail.dispense.remarks}` : ""}
          </p>
        ) : isNothingToDispense ? (
          <p className="note">Nothing to dispense for this consultation.</p>
        ) : (
          <>
            <div className="field">
              <label htmlFor="remarks">Remarks (optional)</label>
              <textarea
                id="remarks"
                rows={2}
                maxLength={500}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
            <div className="form-actions">
              <button type="button" className="btn" disabled={submitting} onClick={() => setShowConfirm(true)}>
                Mark as Done
              </button>
            </div>
          </>
        )}
      </div>

      {showConfirm && (
        <ConfirmDialog
          title="Mark as done?"
          message="This confirms the medicines have been given to the patient. This cannot be undone."
          confirmLabel="Mark as Done"
          busy={submitting}
          onConfirm={markAsDone}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  );
}
