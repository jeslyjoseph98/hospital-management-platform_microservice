import { FieldErrors, UseFormRegister } from 'react-hook-form';
import { FormField } from './FormField';
import { Department } from '../types/domain';

export interface DoctorProfileFormValues {
  departmentId: string;
  fullName: string;
  qualification: string;
  specialization: string;
  registrationNumber: string;
  experienceYears: string;
  phone: string;
  email?: string;
  about?: string;
  consultationFee: string;
  dailyLimit: string;
}

interface DoctorProfileFieldsProps {
  register: UseFormRegister<DoctorProfileFormValues>;
  errors: FieldErrors<DoctorProfileFormValues>;
  departments: Department[];
  registrationNumberReadOnly: boolean;
}

/** Profile + consultation-details fields shared by the create and edit doctor forms (SVC-07A §7). */
export function DoctorProfileFields({
  register,
  errors,
  departments,
  registrationNumberReadOnly,
}: DoctorProfileFieldsProps) {
  return (
    <>
      <h2>Profile</h2>

      <FormField label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
        <input id="fullName" type="text" {...register('fullName')} />
      </FormField>

      <FormField label="Department" htmlFor="departmentId" error={errors.departmentId?.message} required>
        <select id="departmentId" {...register('departmentId')}>
          <option value="">Select department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.deptName}
            </option>
          ))}
        </select>
      </FormField>

      <FormField label="Qualification" htmlFor="qualification" error={errors.qualification?.message} required>
        <input id="qualification" type="text" placeholder="MBBS, MD (Cardiology)" {...register('qualification')} />
      </FormField>

      <FormField label="Specialization" htmlFor="specialization" error={errors.specialization?.message} required>
        <input id="specialization" type="text" placeholder="Cardiologist" {...register('specialization')} />
      </FormField>

      <FormField
        label="Medical registration number"
        htmlFor="registrationNumber"
        error={errors.registrationNumber?.message}
        required
      >
        <input
          id="registrationNumber"
          type="text"
          readOnly={registrationNumberReadOnly}
          title={registrationNumberReadOnly ? 'Locked: doctor has already registered a login' : undefined}
          {...register('registrationNumber')}
        />
      </FormField>

      <FormField label="Experience (years)" htmlFor="experienceYears" error={errors.experienceYears?.message} required>
        <input id="experienceYears" type="number" min={0} max={70} {...register('experienceYears')} />
      </FormField>

      <FormField label="Phone" htmlFor="phone" error={errors.phone?.message} required>
        <input id="phone" type="tel" {...register('phone')} />
      </FormField>

      <FormField label="Email" htmlFor="email" error={errors.email?.message}>
        <input id="email" type="email" {...register('email')} />
      </FormField>

      <FormField label="About" htmlFor="about" error={errors.about?.message}>
        <textarea id="about" rows={3} {...register('about')} />
      </FormField>

      <h2>Consultation</h2>

      <FormField label="Consultation fee (₹)" htmlFor="consultationFee" error={errors.consultationFee?.message} required>
        <input id="consultationFee" type="number" min={0} step="0.01" {...register('consultationFee')} />
      </FormField>

      <FormField label="Daily appointment limit" htmlFor="dailyLimit" error={errors.dailyLimit?.message} required>
        <input id="dailyLimit" type="number" min={1} max={200} {...register('dailyLimit')} />
      </FormField>
    </>
  );
}
