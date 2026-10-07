import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useParams } from 'react-router-dom';
import { listDepartments } from '../api/departments';
import { getDoctor, setDoctorStatus, updateDoctor, updateDoctorTimings } from '../api/doctors';
import { DoctorProfileFields, DoctorProfileFormValues } from '../components/DoctorProfileFields';
import { ErrorBanner } from '../components/ErrorBanner';
import { StatusBadge } from '../components/StatusBadge';
import {
  emptyTimingsState,
  TimingsState,
  timingsPayloadToState,
  timingsStateToPayload,
  validateTimings,
  WeeklyTimingsEditor,
} from '../components/WeeklyTimingsEditor';
import { useToast } from '../context/ToastContext';
import { ApiRequestError } from '../types/api';
import { Department, DoctorDetail } from '../types/domain';
import { applyFieldErrors } from '../utils/applyFieldErrors';
import { doctorProfileSchema } from '../utils/doctorFormSchema';

function toFormValues(doctor: DoctorDetail): DoctorProfileFormValues {
  return {
    departmentId: String(doctor.departmentId),
    fullName: doctor.fullName,
    qualification: doctor.qualification,
    specialization: doctor.specialization,
    registrationNumber: doctor.registrationNumber,
    experienceYears: String(doctor.experienceYears),
    phone: doctor.phone,
    email: doctor.email ?? '',
    about: doctor.about ?? '',
    consultationFee: String(doctor.consultationFee),
    dailyLimit: String(doctor.dailyLimit),
  };
}

export function DoctorEditPage() {
  const { id } = useParams<{ id: string }>();
  const doctorId = Number(id);
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [doctor, setDoctor] = useState<DoctorDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [timings, setTimings] = useState<TimingsState>(emptyTimingsState());
  const [timingErrors, setTimingErrors] = useState<Record<number, string>>({});
  const [timingsSubmitError, setTimingsSubmitError] = useState<ApiRequestError | null>(null);
  const [isSavingTimings, setIsSavingTimings] = useState(false);

  const [profileSubmitError, setProfileSubmitError] = useState<ApiRequestError | null>(null);
  const [isTogglingStatus, setIsTogglingStatus] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DoctorProfileFormValues>({ resolver: zodResolver(doctorProfileSchema) });

  const load = async () => {
    if (!doctorId || Number.isNaN(doctorId)) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const [doc] = await Promise.all([
        getDoctor(doctorId),
        listDepartments().then(setDepartments).catch(() => undefined),
      ]);
      setDoctor(doc);
      reset(toFormValues(doc));
      setTimings(timingsPayloadToState(doc.timings));
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load doctor.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorId]);

  const onSubmitProfile = async (values: DoctorProfileFormValues) => {
    setProfileSubmitError(null);
    try {
      const updated = await updateDoctor(doctorId, {
        departmentId: Number(values.departmentId),
        fullName: values.fullName,
        qualification: values.qualification,
        specialization: values.specialization,
        registrationNumber: values.registrationNumber,
        experienceYears: Number(values.experienceYears),
        phone: values.phone,
        email: values.email || undefined,
        about: values.about || undefined,
        consultationFee: Number(values.consultationFee),
        dailyLimit: Number(values.dailyLimit),
      });
      setDoctor(updated);
      reset(toFormValues(updated));
      showToast('Doctor profile updated.', 'success');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        applyFieldErrors(err.fieldErrors, setError);
        setProfileSubmitError(err);
      }
    }
  };

  const onSaveTimings = async () => {
    setTimingsSubmitError(null);
    const tErrors = validateTimings(timings);
    setTimingErrors(tErrors);
    if (Object.keys(tErrors).length > 0) return;

    setIsSavingTimings(true);
    try {
      const updated = await updateDoctorTimings(doctorId, timingsStateToPayload(timings));
      setDoctor(updated);
      setTimings(timingsPayloadToState(updated.timings));
      showToast('Weekly timings saved.', 'success');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setTimingsSubmitError(err);
      }
    } finally {
      setIsSavingTimings(false);
    }
  };

  const onToggleStatus = async () => {
    if (!doctor) return;
    setIsTogglingStatus(true);
    try {
      const updated = await setDoctorStatus(doctorId, !doctor.isActive);
      setDoctor(updated);
      showToast(`Doctor ${updated.isActive ? 'activated' : 'deactivated'}.`, 'success');
    } catch (err) {
      if (err instanceof ApiRequestError) {
        showToast(err.message, 'error');
        // 409 with data.affected (ADM_DOCTOR_HAS_BOOKINGS) — surface as banner too.
        setProfileSubmitError(err);
      }
    } finally {
      setIsTogglingStatus(false);
    }
  };

  if (isLoading) {
    return (
      <div className="page">
        <p>Loading…</p>
      </div>
    );
  }

  if (loadError || !doctor) {
    return (
      <div className="page">
        <p className="error-banner">{loadError ?? 'Doctor not found.'}</p>
        <button type="button" className="btn btn-secondary" onClick={() => navigate('/admin/doctors')}>
          Back to doctors
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>
          {doctor.fullName} <StatusBadge active={doctor.isActive} />
        </h1>
        <button type="button" className="btn btn-secondary" onClick={onToggleStatus} disabled={isTogglingStatus}>
          {isTogglingStatus ? 'Please wait…' : doctor.isActive ? 'Deactivate' : 'Activate'}
        </button>
      </div>

      {doctor.loginRegistered && (
        <p className="info-banner">This doctor has already registered a login; the registration number is locked.</p>
      )}

      <ErrorBanner error={profileSubmitError} />

      <form className="doctor-form" onSubmit={handleSubmit(onSubmitProfile)} noValidate>
        <DoctorProfileFields
          register={register}
          errors={errors}
          departments={departments}
          registrationNumberReadOnly={doctor.loginRegistered}
        />

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </form>

      <h2>Weekly timings</h2>
      <ErrorBanner error={timingsSubmitError} />
      <WeeklyTimingsEditor value={timings} onChange={setTimings} errors={timingErrors} />
      <div className="form-actions">
        <button type="button" className="btn btn-primary" onClick={onSaveTimings} disabled={isSavingTimings}>
          {isSavingTimings ? 'Saving…' : 'Save timings'}
        </button>
      </div>
    </div>
  );
}
