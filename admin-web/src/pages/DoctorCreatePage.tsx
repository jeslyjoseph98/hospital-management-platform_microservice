import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { listDepartments } from '../api/departments';
import { createDoctor } from '../api/doctors';
import { DoctorProfileFields, DoctorProfileFormValues } from '../components/DoctorProfileFields';
import { ErrorBanner } from '../components/ErrorBanner';
import {
  emptyTimingsState,
  TimingsState,
  timingsStateToPayload,
  validateTimings,
  WeeklyTimingsEditor,
} from '../components/WeeklyTimingsEditor';
import { useToast } from '../context/ToastContext';
import { ApiRequestError } from '../types/api';
import { Department } from '../types/domain';
import { applyFieldErrors } from '../utils/applyFieldErrors';
import { doctorProfileSchema } from '../utils/doctorFormSchema';

export function DoctorCreatePage() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [timings, setTimings] = useState<TimingsState>(emptyTimingsState());
  const [timingErrors, setTimingErrors] = useState<Record<number, string>>({});
  const [submitError, setSubmitError] = useState<ApiRequestError | null>(null);

  useEffect(() => {
    listDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DoctorProfileFormValues>({ resolver: zodResolver(doctorProfileSchema) });

  const onSubmit = async (values: DoctorProfileFormValues) => {
    setSubmitError(null);
    const tErrors = validateTimings(timings);
    setTimingErrors(tErrors);
    if (Object.keys(tErrors).length > 0) {
      return;
    }

    try {
      const doctor = await createDoctor({
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
        timings: timingsStateToPayload(timings),
      });
      showToast('Doctor added successfully.', 'success');
      navigate(`/admin/doctors/${doctor.id}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        applyFieldErrors(err.fieldErrors, setError);
        setSubmitError(err);
      }
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Add doctor</h1>
      </div>

      <ErrorBanner error={submitError} />

      <form className="doctor-form" onSubmit={handleSubmit(onSubmit)} noValidate>
        <DoctorProfileFields
          register={register}
          errors={errors}
          departments={departments}
          registrationNumberReadOnly={false}
        />

        <h2>Weekly timings</h2>
        <WeeklyTimingsEditor value={timings} onChange={setTimings} errors={timingErrors} />

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
            {isSubmitting ? 'Saving…' : 'Save doctor'}
          </button>
        </div>
      </form>
    </div>
  );
}
