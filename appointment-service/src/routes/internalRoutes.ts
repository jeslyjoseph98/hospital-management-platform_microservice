import { Router } from 'express';
import { BusinessError } from '../utils/BusinessError';
import * as appointmentQueryService from '../services/appointmentQueryService';

export const internalRouter = Router();

function parsePositiveIntParam(value: string, fieldName: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BusinessError('VALIDATION_FAILED', 400, `${fieldName} must be a positive integer.`, [
      { field: fieldName, message: `${fieldName} must be a positive integer.` }
    ]);
  }
  return n;
}

// NOTE: literal routes (exists, future-counts) must be registered before the /:id wildcard,
// otherwise Express would match them as :id = "exists" / "future-counts".

// GET /internal/appointments/exists?doctorId=&patientId= — consultation-service
internalRouter.get('/appointments/exists', async (req, res, next) => {
  try {
    const doctorIdRaw = req.query.doctorId;
    const patientIdRaw = req.query.patientId;
    if (typeof doctorIdRaw !== 'string' || typeof patientIdRaw !== 'string') {
      throw new BusinessError('VALIDATION_FAILED', 400, 'doctorId and patientId are required.', [
        { field: 'doctorId', message: 'doctorId is required' },
        { field: 'patientId', message: 'patientId is required' }
      ]);
    }
    const doctorId = parsePositiveIntParam(doctorIdRaw, 'doctorId');
    const patientId = parsePositiveIntParam(patientIdRaw, 'patientId');
    const exists = await appointmentQueryService.checkExists(doctorId, patientId);
    res.status(200).json({ exists });
  } catch (err) {
    next(err);
  }
});

// GET /internal/appointments/future-counts?doctorId= — doctor-service
internalRouter.get('/appointments/future-counts', async (req, res, next) => {
  try {
    const doctorIdRaw = req.query.doctorId;
    if (typeof doctorIdRaw !== 'string') {
      throw new BusinessError('VALIDATION_FAILED', 400, 'doctorId is required.', [
        { field: 'doctorId', message: 'doctorId is required' }
      ]);
    }
    const doctorId = parsePositiveIntParam(doctorIdRaw, 'doctorId');
    const result = await appointmentQueryService.getFutureCounts(doctorId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});

// GET /internal/appointments/{id} — consultation-service
internalRouter.get('/appointments/:id', async (req, res, next) => {
  try {
    const id = parsePositiveIntParam(req.params.id, 'id');
    const result = await appointmentQueryService.getInternalAppointment(id);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
});
