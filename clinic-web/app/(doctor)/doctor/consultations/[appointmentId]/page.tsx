"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FieldErrorText } from "@/components/FieldErrorText";
import { PatientHistoryList } from "@/components/PatientHistoryList";
import { PrescriptionTable } from "@/components/PrescriptionTable";
import { useApiError } from "@/hooks/useApiError";
import { apiFetch, ApiRequestError } from "@/lib/apiClient";
import {
  consultationFormSchema,
  validateFollowUpDate,
  type ConsultationFormValues,
} from "@/lib/consultationSchema";
import { toFieldErrorMap } from "@/lib/fieldErrors";
import { formatDate } from "@/lib/format";
import { useToast } from "@/context/ToastContext";
import type { DoctorConsultationWorkspace } from "@/lib/types";

const EMPTY_VALUES: ConsultationFormValues = {
  chiefComplaint: "",
  symptoms: "",
  temperatureC: undefined,
  pulseBpm: undefined,
  bpSystolic: undefined,
  bpDiastolic: undefined,
  weightKg: undefined,
  diagnosis: "",
  doctorNotes: "",
  advice: "",
  followUpDate: "",
  prescription: [],
};

function toFormValues(workspace: DoctorConsultationWorkspace): ConsultationFormValues {
  const c = workspace.consultation;
  if (!c) return EMPTY_VALUES;
  return {
    chiefComplaint: c.chiefComplaint ?? "",
    symptoms: c.symptoms ?? "",
    temperatureC: c.temperatureC ?? undefined,
    pulseBpm: c.pulseBpm ?? undefined,
    bpSystolic: c.bpSystolic ?? undefined,
    bpDiastolic: c.bpDiastolic ?? undefined,
    weightKg: c.weightKg ?? undefined,
    diagnosis: c.diagnosis ?? "",
    doctorNotes: c.doctorNotes ?? "",
    advice: c.advice ?? "",
    followUpDate: c.followUpDate ?? "",
    prescription: (c.prescription ?? []).map((item) => ({
      medicineName: item.medicineName,
      strength: item.strength ?? undefined,
      dosagePattern: item.dosagePattern,
      timing: item.timing,
      durationDays: item.durationDays,
      instructions: item.instructions ?? undefined,
    })),
  };
}

function toApiBody(values: ConsultationFormValues) {
  return {
    chiefComplaint: values.chiefComplaint || undefined,
    symptoms: values.symptoms || undefined,
    temperatureC: values.temperatureC,
    pulseBpm: values.pulseBpm,
    bpSystolic: values.bpSystolic,
    bpDiastolic: values.bpDiastolic,
    weightKg: values.weightKg,
    diagnosis: values.diagnosis || undefined,
    doctorNotes: values.doctorNotes || undefined,
    advice: values.advice || undefined,
    followUpDate: values.followUpDate || undefined,
    prescription: values.prescription.map((item) => ({
      medicineName: item.medicineName,
      strength: item.strength || undefined,
      dosagePattern: item.dosagePattern,
      timing: item.timing,
      durationDays: Number(item.durationDays),
      instructions: item.instructions || undefined,
    })),
  };
}

export default function ConsultationWorkspacePage() {
  const params = useParams<{ appointmentId: string }>();
  const appointmentId = params.appointmentId;
  const router = useRouter();
  const { handle } = useApiError();
  const { showToast } = useToast();

  const [workspace, setWorkspace] = useState<DoctorConsultationWorkspace | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string>>({});

  const {
    register,
    control,
    handleSubmit,
    reset,
    getValues,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<ConsultationFormValues>({
    resolver: zodResolver(consultationFormSchema),
    defaultValues: EMPTY_VALUES,
  });

  const isCompleted = workspace?.consultation?.status === "COMPLETED";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiFetch<DoctorConsultationWorkspace>(`/doctor/consultations/${appointmentId}`);
      setWorkspace(data);
      reset(toFormValues(data));
    } catch (err) {
      handle(err);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  useEffect(() => {
    load();
  }, [load]);

  const runSubmit = useCallback(
    async (complete: boolean) => {
      const values = getValues();
      clearErrors();
      setServerFieldErrors({});

      const followUpError = validateFollowUpDate(values.followUpDate);
      if (followUpError) {
        setError("followUpDate", { message: followUpError });
        return;
      }
      if (complete && !values.diagnosis?.trim()) {
        setError("diagnosis", { message: "Diagnosis is required to complete the consultation" });
        return;
      }

      const body = toApiBody(values);
      const path = complete
        ? `/doctor/consultations/${appointmentId}/complete`
        : `/doctor/consultations/${appointmentId}`;
      const method = complete ? "POST" : "PUT";

      if (complete) setCompleting(true);
      else setSaving(true);

      try {
        await apiFetch(path, { method, body: JSON.stringify(body) });
        showToast(complete ? "Consultation completed" : "Consultation saved", "success");
        if (complete) {
          router.push("/doctor/today?justCompleted=1");
        } else {
          await load();
        }
      } catch (err) {
        if (err instanceof ApiRequestError && err.fieldErrors.length > 0) {
          setServerFieldErrors(toFieldErrorMap(err.fieldErrors));
        }
        handle(err);
      } finally {
        setSaving(false);
        setCompleting(false);
        setShowCompleteConfirm(false);
      }
    },
    [appointmentId, clearErrors, getValues, handle, load, router, setError, showToast]
  );

  const patientAge = workspace?.patient.age;

  const historySorted = useMemo(() => workspace?.history ?? [], [workspace]);

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  if (!workspace) {
    return <div className="empty-state">Unable to load this consultation.</div>;
  }

  const inFlight = saving || completing;

  return (
    <div>
      <div className="page-header">
        <h1>
          Consultation — Token {workspace.appointment.tokenNumber} ({workspace.appointment.appointmentCode})
        </h1>
        <button type="button" className="btn btn-secondary" onClick={() => router.push("/doctor/today")}>
          Back to Today
        </button>
      </div>

      {isCompleted && (
        <div className="readonly-banner">This consultation is completed and is now read-only.</div>
      )}

      <div className="workspace-grid">
        <div className="panel">
          <h2>Patient details</h2>
          <div className="detail-row">
            <span className="k">Name</span>
            <span>{workspace.patient.name}</span>
          </div>
          <div className="detail-row">
            <span className="k">Code</span>
            <span>{workspace.patient.patientCode}</span>
          </div>
          <div className="detail-row">
            <span className="k">Age</span>
            <span>{patientAge}</span>
          </div>
          <div className="detail-row">
            <span className="k">Gender</span>
            <span>{workspace.patient.gender}</span>
          </div>
          <div className="detail-row">
            <span className="k">Phone</span>
            <span>{workspace.patient.phone ?? "-"}</span>
          </div>
          <div className="detail-row">
            <span className="k">Address</span>
            <span>{workspace.patient.address ?? "-"}</span>
          </div>

          <h3>Last 5 visits</h3>
          <PatientHistoryList history={historySorted} />

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ marginTop: "0.75rem" }}
            onClick={() => router.push(`/doctor/patients/${workspace.patient.patientId}`)}
          >
            View full history
          </button>
        </div>

        <form className="panel" onSubmit={(e) => e.preventDefault()}>
          <h2>Consultation</h2>

          <div className="form-row">
            <div className="field">
              <label htmlFor="chiefComplaint">Chief complaint</label>
              <input id="chiefComplaint" type="text" disabled={isCompleted} {...register("chiefComplaint")} />
              <FieldErrorText message={errors.chiefComplaint?.message} />
            </div>
            <div className="field">
              <label htmlFor="symptoms">Symptoms</label>
              <input id="symptoms" type="text" disabled={isCompleted} {...register("symptoms")} />
              <FieldErrorText message={errors.symptoms?.message} />
            </div>
          </div>

          <h3>Vitals</h3>
          <div className="form-row">
            <div className="field">
              <label htmlFor="temperatureC">Temperature (C)</label>
              <input
                id="temperatureC"
                type="number"
                step="0.1"
                disabled={isCompleted}
                {...register("temperatureC")}
              />
              <FieldErrorText
                message={errors.temperatureC?.message ?? serverFieldErrors.temperatureC}
              />
            </div>
            <div className="field">
              <label htmlFor="pulseBpm">Pulse (bpm)</label>
              <input id="pulseBpm" type="number" disabled={isCompleted} {...register("pulseBpm")} />
              <FieldErrorText message={errors.pulseBpm?.message ?? serverFieldErrors.pulseBpm} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <label htmlFor="bpSystolic">BP systolic</label>
              <input id="bpSystolic" type="number" disabled={isCompleted} {...register("bpSystolic")} />
              <FieldErrorText message={errors.bpSystolic?.message ?? serverFieldErrors.bpSystolic} />
            </div>
            <div className="field">
              <label htmlFor="bpDiastolic">BP diastolic</label>
              <input id="bpDiastolic" type="number" disabled={isCompleted} {...register("bpDiastolic")} />
              <FieldErrorText message={errors.bpDiastolic?.message ?? serverFieldErrors.bpDiastolic} />
            </div>
            <div className="field">
              <label htmlFor="weightKg">Weight (kg)</label>
              <input id="weightKg" type="number" step="0.1" disabled={isCompleted} {...register("weightKg")} />
              <FieldErrorText message={errors.weightKg?.message ?? serverFieldErrors.weightKg} />
            </div>
          </div>

          <h3>Diagnosis &amp; advice</h3>
          <div className="field">
            <label htmlFor="diagnosis">Diagnosis {!isCompleted && "(required to complete)"}</label>
            <input id="diagnosis" type="text" disabled={isCompleted} {...register("diagnosis")} />
            <FieldErrorText message={errors.diagnosis?.message ?? serverFieldErrors.diagnosis} />
          </div>
          <div className="field">
            <label htmlFor="doctorNotes">Private notes (not shown to patient or pharmacist)</label>
            <textarea id="doctorNotes" rows={2} disabled={isCompleted} {...register("doctorNotes")} />
          </div>
          <div className="field">
            <label htmlFor="advice">Advice</label>
            <textarea id="advice" rows={2} disabled={isCompleted} {...register("advice")} />
          </div>
          <div className="field">
            <label htmlFor="followUpDate">Follow-up date</label>
            <input id="followUpDate" type="date" disabled={isCompleted} {...register("followUpDate")} />
            <FieldErrorText message={errors.followUpDate?.message ?? serverFieldErrors.followUpDate} />
            {workspace.consultation?.followUpDate && (
              <span className="note">Current: {formatDate(workspace.consultation.followUpDate)}</span>
            )}
          </div>

          <h3>Prescription</h3>
          <PrescriptionTable control={control} register={register} errors={errors} readOnly={isCompleted} />

          {!isCompleted && (
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={inFlight}
                onClick={() => runSubmit(false)}
              >
                {saving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                className="btn"
                disabled={inFlight}
                onClick={() => setShowCompleteConfirm(true)}
              >
                {completing ? "Completing..." : "Complete Consultation"}
              </button>
            </div>
          )}
        </form>
      </div>

      {showCompleteConfirm && (
        <ConfirmDialog
          title="Complete consultation?"
          message="This will mark the consultation as completed. You will not be able to edit it afterwards. Continue?"
          confirmLabel="Complete"
          busy={completing}
          onConfirm={() => runSubmit(true)}
          onCancel={() => setShowCompleteConfirm(false)}
        />
      )}
    </div>
  );
}
