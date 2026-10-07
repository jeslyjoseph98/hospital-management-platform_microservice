import { NextFunction, Request, Response } from 'express';
import { BusinessError } from '../utils/BusinessError';

/** Rejects a request whose X-User-Role header does not match the given role (defense in depth;
 * the gateway is expected to already enforce this per route, SVC-00 MS-R7 / GW-R3). */
export function requireRole(role: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user.role !== role) {
      next(new BusinessError('AUTH_FORBIDDEN', 403, 'Forbidden for this role.'));
      return;
    }
    next();
  };
}
