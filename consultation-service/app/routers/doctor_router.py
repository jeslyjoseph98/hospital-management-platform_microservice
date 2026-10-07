from fastapi import APIRouter, Depends, HTTPException, Request

from app.core.envelope import success_response
from app.core.headers import UserContext, get_user_context, require_doctor
from app.schemas.consultation import ConsultationSaveRequest

router = APIRouter(prefix="/api/v1/doctor")


def _doctor_service(request: Request):
    return request.app.state.doctor_service


@router.get("/consultations/{appointment_id}")
async def open_consultation(
    appointment_id: int,
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    doctor_id = await require_doctor(ctx)
    result = await _doctor_service(request).open_appointment(appointment_id, doctor_id)
    return success_response(data=result, message="OK")


@router.put("/consultations/{appointment_id}")
async def save_consultation(
    appointment_id: int,
    body: ConsultationSaveRequest,
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    doctor_id = await require_doctor(ctx)
    result = await _doctor_service(request).save(appointment_id, doctor_id, body)
    return success_response(data=result, message="Consultation saved")


@router.post("/consultations/{appointment_id}/complete")
async def complete_consultation(
    appointment_id: int,
    body: ConsultationSaveRequest,
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    doctor_id = await require_doctor(ctx)
    result = await _doctor_service(request).complete(appointment_id, doctor_id, body)
    return success_response(data=result, message="Consultation completed")


@router.get("/patients/{patient_id}")
async def get_patient(
    patient_id: int,
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    doctor_id = await require_doctor(ctx)
    result = await _doctor_service(request).get_patient_for_doctor(patient_id, doctor_id)
    return success_response(data=result, message="OK")
