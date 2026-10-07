from dataclasses import dataclass
from typing import Optional

from fastapi import Header, HTTPException


@dataclass
class UserContext:
    user_id: Optional[int]
    role: Optional[str]
    name: Optional[str]
    patient_id: Optional[int]
    doctor_id: Optional[int]
    request_id: Optional[str]


def _to_int(value: Optional[str]) -> Optional[int]:
    if value is None:
        return None
    try:
        return int(value)
    except ValueError:
        return None


async def get_user_context(
    x_user_id: Optional[str] = Header(default=None, alias="X-User-Id"),
    x_user_role: Optional[str] = Header(default=None, alias="X-User-Role"),
    x_user_name: Optional[str] = Header(default=None, alias="X-User-Name"),
    x_patient_id: Optional[str] = Header(default=None, alias="X-Patient-Id"),
    x_doctor_id: Optional[str] = Header(default=None, alias="X-Doctor-Id"),
    x_request_id: Optional[str] = Header(default=None, alias="X-Request-Id"),
) -> UserContext:
    return UserContext(
        user_id=_to_int(x_user_id),
        role=x_user_role,
        name=x_user_name,
        patient_id=_to_int(x_patient_id),
        doctor_id=_to_int(x_doctor_id),
        request_id=x_request_id,
    )


async def require_doctor(ctx: UserContext) -> int:
    if ctx.role != "DOCTOR" or ctx.doctor_id is None:
        raise HTTPException(status_code=403, detail="AUTH_FORBIDDEN")
    return ctx.doctor_id


async def require_patient(ctx: UserContext) -> int:
    if ctx.role != "PATIENT" or ctx.patient_id is None:
        raise HTTPException(status_code=403, detail="AUTH_FORBIDDEN")
    return ctx.patient_id


async def require_pharmacist(ctx: UserContext) -> None:
    if ctx.role != "PHARMACIST":
        raise HTTPException(status_code=403, detail="AUTH_FORBIDDEN")
