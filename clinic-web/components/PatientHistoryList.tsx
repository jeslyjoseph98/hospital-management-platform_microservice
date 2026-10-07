import { formatDate } from "@/lib/format";
import type { HistoryVisit } from "@/lib/types";

export function PatientHistoryList({ history }: { history: HistoryVisit[] }) {
  if (history.length === 0) {
    return <p className="note">No past completed visits.</p>;
  }

  return (
    <div>
      {history.map((visit) => (
        <div key={visit.consultationId} className="visit-card">
          <div className="visit-header">
            <span>{formatDate(visit.date)}</span>
            <span>{visit.doctorName}</span>
          </div>
          <div>{visit.departmentName}</div>
          {visit.chiefComplaint && <div>Complaint: {visit.chiefComplaint}</div>}
          {visit.diagnosis && <div>Diagnosis: {visit.diagnosis}</div>}
          {visit.advice && <div>Advice: {visit.advice}</div>}
          {visit.followUpDate && <div>Follow-up: {formatDate(visit.followUpDate)}</div>}
          {visit.prescription.length > 0 && (
            <div>
              Medicines:{" "}
              {visit.prescription.map((p) => `${p.medicineName}${p.strength ? ` (${p.strength})` : ""}`).join(", ")}
            </div>
          )}
          <div>Dispense: {visit.dispenseStatus}</div>
        </div>
      ))}
    </div>
  );
}
