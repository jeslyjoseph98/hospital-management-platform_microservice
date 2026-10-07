import { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { FieldError } from '../types/api';

/**
 * Maps server-side fieldErrors (SVC-00 §7) onto react-hook-form fields so they
 * render under the matching inputs (AW-R6).
 */
export function applyFieldErrors<T extends FieldValues>(
  fieldErrors: FieldError[],
  setError: UseFormSetError<T>,
): void {
  fieldErrors.forEach((fe) => {
    setError(fe.field as Path<T>, { type: 'server', message: fe.message });
  });
}
