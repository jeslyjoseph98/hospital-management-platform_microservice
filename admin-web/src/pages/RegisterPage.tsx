import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '../components/FormField';
import { registerAdmin } from '../api/auth';
import { ApiRequestError } from '../types/api';
import { applyFieldErrors } from '../utils/applyFieldErrors';

const schema = z
  .object({
    fullName: z.string().min(1, 'Full name is required'),
    phone: z
      .string()
      .min(1, 'Phone is required')
      .regex(/^[6-9]\d{9}$/, 'Phone must be 10 digits starting with 6-9'),
    email: z.union([z.string().email('Enter a valid email'), z.literal('')]).optional(),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    adminCode: z.string().min(1, 'Admin registration code is required'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await registerAdmin({
        fullName: values.fullName,
        phone: values.phone,
        email: values.email || undefined,
        password: values.password,
        adminCode: values.adminCode,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        applyFieldErrors(err.fieldErrors, setError);
        setSubmitError(err.message);
      } else {
        setSubmitError('Registration failed. Please try again.');
      }
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Admin Registration</h1>
        <p className="auth-role-fixed">Register as: <strong>Admin</strong></p>

        {submitError && (
          <p className="error-banner" role="alert">
            {submitError}
          </p>
        )}
        {success && <p className="success-banner">Registration successful. Redirecting to login…</p>}

        <FormField label="Full name" htmlFor="fullName" error={errors.fullName?.message} required>
          <input id="fullName" type="text" {...register('fullName')} />
        </FormField>

        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message} required>
          <input id="phone" type="tel" {...register('phone')} />
        </FormField>

        <FormField label="Email (optional)" htmlFor="email" error={errors.email?.message}>
          <input id="email" type="email" {...register('email')} />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
          <input id="password" type="password" {...register('password')} />
        </FormField>

        <FormField
          label="Confirm password"
          htmlFor="confirmPassword"
          error={errors.confirmPassword?.message}
          required
        >
          <input id="confirmPassword" type="password" {...register('confirmPassword')} />
        </FormField>

        <FormField label="Admin registration code" htmlFor="adminCode" error={errors.adminCode?.message} required>
          <input id="adminCode" type="text" {...register('adminCode')} />
        </FormField>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Registering…' : 'Register'}
        </button>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </form>
    </div>
  );
}
