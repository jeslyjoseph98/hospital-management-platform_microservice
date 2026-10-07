import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { BusinessError } from '../utils/BusinessError';

/**
 * Standard JSON envelope for all responses (SVC-00 §7).
 */
export function successEnvelope(data: unknown, message = 'OK') {
  return { success: true, data, message };
}

function errorEnvelope(
  errorCode: string,
  message: string,
  fieldErrors: { field: string; message: string }[] = []
) {
  return { success: false, errorCode, message, fieldErrors, data: null };
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json(errorEnvelope('NOT_FOUND', 'Route not found.'));
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof BusinessError) {
    res.status(err.status).json(errorEnvelope(err.code, err.message, err.fieldErrors));
    return;
  }

  if (err instanceof ZodError) {
    const fieldErrors = err.issues.map((issue) => ({
      field: issue.path.join('.') || '(root)',
      message: issue.message
    }));
    res.status(400).json(errorEnvelope('VALIDATION_FAILED', 'Validation failed.', fieldErrors));
    return;
  }

  // eslint-disable-next-line no-console
  console.error('Unhandled error:', err);
  res.status(500).json(errorEnvelope('INTERNAL_ERROR', 'An unexpected error occurred.'));
}
