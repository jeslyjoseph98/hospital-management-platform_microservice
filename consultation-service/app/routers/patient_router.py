from fastapi import APIRouter, Depends, Request

from app.core.envelope import success_response
from app.core.headers import UserContext, get_user_context, require_patient

router = APIRouter(prefix="/api/v1/consultations")


def _patient_service(request: Request):
    return request.app.state.patient_service


@router.get("/my/{appointment_id}")
async def get_my_consultation(
    appointment_id: int,
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    patient_id = await require_patient(ctx)
    result = await _patient_service(request).get_my_consultation(appointment_id, patient_id)
    return success_response(data=result, message="OK")
