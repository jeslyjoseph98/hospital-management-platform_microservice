import { Router } from 'express';
import { BusinessError } from '../utils/BusinessError';
import { requireRole } from '../middleware/roleGuard';
import { successEnvelope } from '../middleware/errorHandler';
import { computeAvailability } from '../services/availabilityService';
import { bookAppointmentSchema } from '../schemas/appointmentSchemas';
import { bookAppointment } from '../services/bookingService';
import * as appointmentQueryService from '../services/appointmentQueryService';

export const publicRouter = Router();

function parsePositiveIntParam(value: string, fieldName: string): number {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new BusinessError('VALIDATION_FAILED', 400, `${fieldName} must be a positive integer.`, [
      { field: fieldName, message: `${fieldName} must be a positive integer.` }
    ]);
  }
  return n;
}

// GET /api/v1/doctors/{id}/availability (PATIENT) — SVC-04 §4
publicRouter.get('/doctors/:id/availability', requireRole('PATIENT'), async (req, res, next) => {
  try {
    const doctorId = parsePositiveIntParam(req.params.id, 'id');
    const result = await computeAvailability(doctorId, req.user.requestId);
    res.status(200).json(successEnvelope(result));
  } catch (err) {
    next(err);
  }
});

// POST /api/v1/appointments (PATIENT) — SVC-04 §5
publicRouter.post('/appointments', requireRole('PATIENT'), async (req, res, next) => {
  try {
    if (!req.user.patientId) {
      throw new BusinessError('VALIDATION_FAILED', 400, 'Missing patient context.');
    }
    const body = bookAppointmentSchema.parse(req.body);
    const result = await bookAppointment(
      {
        patientId: req.user.patientId,
        doctorId: body.doctorId,
        appointmentDate: body.appointmentDate,
        reason: body.reason ?? null
      },
      req.user.requestId
    );
    res.status(201).json(successEnvelope(result, 'Booking successful'));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/appointments/my?upcoming=true (PATIENT)
publicRouter.get('/appointments/my', requireRole('PATIENT'), async (req, res, next) => {
  try {
    if (!req.user.patientId) {
      throw new BusinessError('VALIDATION_FAILED', 400, 'Missing patient context.');
    }
    const upcoming = req.query.upcoming !== 'false';
    const result = await appointmentQueryService.listMyAppointments(req.user.patientId, upcoming);
    res.status(200).json(successEnvelope(result));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/appointments/{id} (PATIENT) — own booking slip, APT-R11
publicRouter.get('/appointments/:id', requireRole('PATIENT'), async (req, res, next) => {
  try {
    if (!req.user.patientId) {
      throw new BusinessError('VALIDATION_FAILED', 400, 'Missing patient context.');
    }
    const id = parsePositiveIntParam(req.params.id, 'id');
    const result = await appointmentQueryService.getMyAppointmentById(id, req.user.patientId);
    res.status(200).json(successEnvelope(result));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/doctor/appointments/today (DOCTOR) — SVC-04 §6
publicRouter.get('/doctor/appointments/today', requireRole('DOCTOR'), async (req, res, next) => {
  try {
    if (!req.user.doctorId) {
      throw new BusinessError('VALIDATION_FAILED', 400, 'Missing doctor context.');
    }
    const result = await appointmentQueryService.getDoctorTodayList(req.user.doctorId);
    res.status(200).json(successEnvelope(result));
  } catch (err) {
    next(err);
  }
});

// GET /api/v1/admin/appointments?doctorId=&date= (ADMIN) — SVC-04 §7
publicRouter.get('/admin/appointments', requireRole('ADMIN'), async (req, res, next) => {
  try {
    const doctorIdRaw = req.query.doctorId;
    const dateRaw = req.query.date;
    if (typeof doctorIdRaw !== 'string' || typeof dateRaw !== 'string') {
      throw new BusinessError('VALIDATION_FAILED', 400, 'doctorId and date are required.', [
        { field: 'doctorId', message: 'doctorId is required' },
        { field: 'date', message: 'date is required' }
      ]);
    }
    const doctorId = parsePositiveIntParam(doctorIdRaw, 'doctorId');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
      throw new BusinessError('VALIDATION_FAILED', 400, 'date must be in YYYY-MM-DD format.', [
        { field: 'date', message: 'date must be in YYYY-MM-DD format' }
      ]);
    }
    const result = await appointmentQueryService.getAdminBookings(doctorId, dateRaw);
    res.status(200).json(successEnvelope(result));
  } catch (err) {
    next(err);
  }
});
