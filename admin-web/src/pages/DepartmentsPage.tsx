import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { createDepartment, listDepartments, setDepartmentStatus, updateDepartment } from '../api/departments';
import { ErrorBanner } from '../components/ErrorBanner';
import { FormField } from '../components/FormField';
import { StatusBadge } from '../components/StatusBadge';
import { useToast } from '../context/ToastContext';
import { ApiRequestError } from '../types/api';
import { Department } from '../types/domain';
import { applyFieldErrors } from '../utils/applyFieldErrors';

const schema = z.object({
  deptName: z.string().min(1, 'Department name is required'),
  description: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function DepartmentsPage() {
  const { showToast } = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [editing, setEditing] = useState<Department | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formError, setFormError] = useState<ApiRequestError | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await listDepartments();
      setDepartments(data);
    } catch (err) {
      setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load departments.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openCreate = () => {
    setEditing(null);
    setFormError(null);
    reset({ deptName: '', description: '' });
    setIsFormOpen(true);
  };

  const openEdit = (dept: Department) => {
    setEditing(dept);
    setFormError(null);
    reset({ deptName: dept.deptName, description: dept.description ?? '' });
    setIsFormOpen(true);
  };

  const closeForm = () => {
    setIsFormOpen(false);
    setEditing(null);
    setFormError(null);
  };

  const onSubmit = async (values: FormValues) => {
    setFormError(null);
    try {
      if (editing) {
        await updateDepartment(editing.id, values);
        showToast('Department updated.', 'success');
      } else {
        await createDepartment(values);
        showToast('Department created.', 'success');
      }
      closeForm();
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        applyFieldErrors(err.fieldErrors, setError);
        setFormError(err);
      }
    }
  };

  const toggleStatus = async (dept: Department) => {
    try {
      await setDepartmentStatus(dept.id, !dept.isActive);
      showToast(`Department ${dept.isActive ? 'deactivated' : 'activated'}.`, 'success');
      await load();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        showToast(err.message, 'error');
      }
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Departments</h1>
        <button type="button" className="btn btn-primary" onClick={openCreate}>
          Add department
        </button>
      </div>

      {loadError && <p className="error-banner">{loadError}</p>}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Active doctors</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {departments.map((dept) => (
              <tr key={dept.id}>
                <td>{dept.deptName}</td>
                <td>{dept.description ?? '—'}</td>
                <td>{dept.activeDoctorCount ?? 0}</td>
                <td>
                  <StatusBadge active={dept.isActive} />
                </td>
                <td className="actions-cell">
                  <button type="button" className="btn btn-link" onClick={() => openEdit(dept)}>
                    Edit
                  </button>
                  <button type="button" className="btn btn-link" onClick={() => toggleStatus(dept)}>
                    {dept.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {departments.length === 0 && (
              <tr>
                <td colSpan={5}>No departments yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {isFormOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true">
          <form className="modal-card" onSubmit={handleSubmit(onSubmit)} noValidate>
            <h2>{editing ? 'Edit department' : 'Add department'}</h2>

            <ErrorBanner error={formError} />

            <FormField label="Name" htmlFor="deptName" error={errors.deptName?.message} required>
              <input id="deptName" type="text" {...register('deptName')} />
            </FormField>

            <FormField label="Description" htmlFor="description" error={errors.description?.message}>
              <textarea id="description" rows={3} {...register('description')} />
            </FormField>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={closeForm} disabled={isSubmitting}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Saving…' : 'Save'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
