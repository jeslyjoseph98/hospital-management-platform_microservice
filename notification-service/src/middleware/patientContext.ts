import { NextFunction, Request, Response } from 'express';
import { BusinessError } from '../utils/BusinessError';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      patientId: number;
    }
  }
}

/**
 * Reads patientId from the X-Patient-Id header set by the gateway (SVC-00 §6).
 * The gateway is responsible for authentication/role checks (PATIENT role, MS-R7);
 * this service trusts the header and only validates that it is present and numeric.
 */
export function patientContext(req: Request, _res: Response, next: NextFunction): void {
  const header = req.header('X-Patient-Id');
  const patientId = header ? parseInt(header, 10) : NaN;
  if (!header || Number.isNaN(patientId)) {
    throw new BusinessError('AUTH_FORBIDDEN', 403, 'Missing or invalid X-Patient-Id header');
  }
  req.patientId = patientId;
  next();
}
