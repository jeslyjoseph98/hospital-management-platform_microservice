import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listDepartments } from '../api/departments';
import { listDoctors } from '../api/doctors';
import { StatusBadge } from '../components/StatusBadge';
import { ApiRequestError } from '../types/api';
import { Department, DoctorListItem } from '../types/domain';
import { DAY_SHORT, formatFee } from '../utils/format';

const PAGE_SIZE = 10;

function formatDays(timings: DoctorListItem['timings']): string {
  if (!timings || timings.length === 0) return '—';
  return timings
    .map((t) => t.dayOfWeek)
    .sort((a, b) => a - b)
    .map((d) => DAY_SHORT[d])
    .join(', ');
}

export function DoctorsListPage() {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState<string>('');
  const [name, setName] = useState('');
  const [active, setActive] = useState<string>('');
  const [page, setPage] = useState(0);

  const [doctors, setDoctors] = useState<DoctorListItem[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    listDepartments()
      .then(setDepartments)
      .catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setLoadError(null);
    listDoctors({
      departmentId: departmentId ? Number(departmentId) : undefined,
      name: name || undefined,
      active: active === '' ? undefined : active === 'true',
      page,
      size: PAGE_SIZE,
    })
      .then((data) => {
        if (cancelled) return;
        setDoctors(data.content);
        setTotalPages(data.totalPages);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(err instanceof ApiRequestError ? err.message : 'Failed to load doctors.');
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [departmentId, name, active, page]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Doctors</h1>
        <Link to="/admin/doctors/new" className="btn btn-primary">
          Add doctor
        </Link>
      </div>

      <div className="filters-bar">
        <div className="form-field">
          <label htmlFor="filter-department">Department</label>
          <select
            id="filter-department"
            value={departmentId}
            onChange={(e) => {
              setPage(0);
              setDepartmentId(e.target.value);
            }}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.deptName}
              </option>
            ))}
          </select>
        </div>

        <div className="form-field">
          <label htmlFor="filter-name">Name</label>
          <input
            id="filter-name"
            type="text"
            placeholder="Search by name"
            value={name}
            onChange={(e) => {
              setPage(0);
              setName(e.target.value);
            }}
          />
        </div>

        <div className="form-field">
          <label htmlFor="filter-active">Status</label>
          <select
            id="filter-active"
            value={active}
            onChange={(e) => {
              setPage(0);
              setActive(e.target.value);
            }}
          >
            <option value="">All</option>
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      {loadError && <p className="error-banner">{loadError}</p>}

      {isLoading ? (
        <p>Loading…</p>
      ) : (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Specialization</th>
                <th>Fee</th>
                <th>Daily limit</th>
                <th>Days</th>
                <th>Login registered</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {doctors.map((doc) => (
                <tr key={doc.id}>
                  <td>{doc.fullName}</td>
                  <td>{doc.departmentName}</td>
                  <td>{doc.specialization}</td>
                  <td>{formatFee(doc.consultationFee)}</td>
                  <td>{doc.dailyLimit}</td>
                  <td>{formatDays(doc.timings)}</td>
                  <td>{doc.loginRegistered ? 'Yes' : 'No'}</td>
                  <td>
                    <StatusBadge active={doc.isActive} />
                  </td>
                  <td>
                    <Link to={`/admin/doctors/${doc.id}`} className="btn btn-link">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
              {doctors.length === 0 && (
                <tr>
                  <td colSpan={9}>No doctors found.</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pagination">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </button>
            <span>
              Page {page + 1} of {Math.max(totalPages, 1)}
            </span>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page + 1 >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  );
}
