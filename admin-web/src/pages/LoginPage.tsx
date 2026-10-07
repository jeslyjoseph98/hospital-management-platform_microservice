import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { FormField } from '../components/FormField';
import { useAuth } from '../context/AuthContext';
import { ApiRequestError } from '../types/api';
import { applyFieldErrors } from '../utils/applyFieldErrors';

const schema = z.object({
  phone: z.string().min(1, 'Phone is required'),
  password: z.string().min(1, 'Password is required'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setSubmitError(null);
    try {
      await login(values);
      navigate('/admin/doctors', { replace: true });
    } catch (err) {
      if (err instanceof ApiRequestError) {
        applyFieldErrors(err.fieldErrors, setError);
        setSubmitError(err.message);
      } else if (err instanceof Error) {
        setSubmitError(err.message);
      } else {
        setSubmitError('Login failed. Please try again.');
      }
    }
  };

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={handleSubmit(onSubmit)} noValidate>
        <h1>Admin Login</h1>
        <p className="auth-role-fixed">Login as: <strong>Admin</strong></p>

        {submitError && (
          <p className="error-banner" role="alert">
            {submitError}
          </p>
        )}

        <FormField label="Phone" htmlFor="phone" error={errors.phone?.message} required>
          <input id="phone" type="tel" autoComplete="username" {...register('phone')} />
        </FormField>

        <FormField label="Password" htmlFor="password" error={errors.password?.message} required>
          <input id="password" type="password" autoComplete="current-password" {...register('password')} />
        </FormField>

        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
          {isSubmitting ? 'Logging in…' : 'Login'}
        </button>

        <p className="auth-switch">
          Don&apos;t have an account? <Link to="/register">Register as Admin</Link>
        </p>
      </form>
    </div>
  );
}
