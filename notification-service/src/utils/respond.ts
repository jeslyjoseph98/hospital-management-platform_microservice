import { Response } from 'express';

export interface FieldError {
  field: string;
  message: string;
}

export function ok(res: Response, data: unknown, message = ''): Response {
  return res.status(200).json({ success: true, data, message });
}

export function fail(
  res: Response,
  status: number,
  errorCode: string,
  message: string,
  fieldErrors: FieldError[] = []
): Response {
  return res.status(status).json({ success: false, errorCode, message, fieldErrors, data: null });
}
