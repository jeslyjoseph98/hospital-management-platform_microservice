from typing import Optional

from fastapi import APIRouter, Depends, Query, Request

from app.core.envelope import success_response
from app.core.headers import UserContext, get_user_context, require_pharmacist
from app.schemas.consultation import DispenseRequest

router = APIRouter(prefix="/api/v1/pharmacy")


def _pharmacy_service(request: Request):
    return request.app.state.pharmacy_service


@router.get("/prescriptions/pending")
async def pending(
    date: Optional[str] = Query(default=None),
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    await require_pharmacist(ctx)
    result = await _pharmacy_service(request).pending(date)
    return success_response(data=result, message="OK")


@router.get("/prescriptions/search")
async def search(
    q: str = Query(...),
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    await require_pharmacist(ctx)
    result = await _pharmacy_service(request).search(q)
    return success_response(data=result, message="OK")


@router.get("/prescriptions/{consultation_id}")
async def detail(
    consultation_id: str,
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    await require_pharmacist(ctx)
    result = await _pharmacy_service(request).detail(consultation_id)
    return success_response(data=result, message="OK")


@router.post("/prescriptions/{consultation_id}/dispense")
async def dispense(
    consultation_id: str,
    body: DispenseRequest,
    ctx: UserContext = Depends(get_user_context),
    request: Request = None,
):
    await require_pharmacist(ctx)
    result = await _pharmacy_service(request).dispense(
        consultation_id, ctx.user_id, ctx.name, body.remarks
    )
    return success_response(data=result, message="Marked as done")
