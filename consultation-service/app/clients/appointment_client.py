from typing import Any, Optional

from app.clients.base import BaseServiceClient
from app.core.config import settings


class AppointmentClient(BaseServiceClient):
    def __init__(self) -> None:
        super().__init__(settings.appointment_service_url)

    async def get_appointment(self, appointment_id: int) -> Optional[dict[str, Any]]:
        """GET /internal/appointments/{id}. Returns None on 404."""
        return await self.get(f"/internal/appointments/{appointment_id}")

    async def exists(self, doctor_id: int, patient_id: int) -> bool:
        """GET /internal/appointments/exists?doctorId=&patientId= -> { exists: bool }"""
        result = await self.get(
            "/internal/appointments/exists",
            params={"doctorId": doctor_id, "patientId": patient_id},
        )
        if result is None:
            return False
        return bool(result.get("exists", False))


appointment_client = AppointmentClient()
