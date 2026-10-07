from typing import Any, Optional

from app.clients.base import BaseServiceClient
from app.core.config import settings


class UserClient(BaseServiceClient):
    def __init__(self) -> None:
        super().__init__(settings.user_service_url)

    async def get_patient(self, patient_id: int) -> Optional[dict[str, Any]]:
        """GET /internal/patients/{patientId} -> { patientId, patientCode, name,
        phone, dateOfBirth, gender, address }. Returns None on 404.
        """
        return await self.get(f"/internal/patients/{patient_id}")


user_client = UserClient()
