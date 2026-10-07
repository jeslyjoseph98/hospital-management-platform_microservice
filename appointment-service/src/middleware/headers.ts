import { NextFunction, Request, Response } from 'express';

export interface UserContext {
  userId?: number;
  role?: string;
  name?: string;
  patientId?: number;
  doctorId?: number;
  requestId?: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: UserContext;
    }
  }
}

/**
 * Reads the X-User-* / X-Patient-Id / X-Doctor-Id / X-Request-Id headers set by the gateway
 * (SVC-00 §6). Business services trust these headers and never validate the JWT (MS-R7).
 */
export function headerContext(req: Request, _res: Response, next: NextFunction): void {
  const header = (name: string): string | undefined => {
    const v = req.header(name);
    return v === null || v === undefined || v === '' ? undefined : v;
  };

  const toNum = (v: string | undefined): number | undefined => {
    if (v === undefined) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };

  req.user = {
    userId: toNum(header('X-User-Id')),
    role: header('X-User-Role'),
    name: header('X-User-Name'),
    patientId: toNum(header('X-Patient-Id')),
    doctorId: toNum(header('X-Doctor-Id')),
    requestId: header('X-Request-Id')
  };

  next();
}
