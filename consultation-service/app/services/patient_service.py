from typing import Any, Optional

from app.core.errors import BusinessError
from app.repositories.consultation_repository import ConsultationRepository


def _dispense_message(dispense: dict[str, Any]) -> Optional[str]:
    status = dispense.get("status")
    if status == "DISPENSED":
        at = dispense.get("at")
        date_part = at.strftime("%Y-%m-%d") if hasattr(at, "strftime") else at
        msg = f"Medicines given on {date_part}"
        if dispense.get("remarks"):
            msg = f"{msg} ({dispense['remarks']})"
        return msg
    if status == "PENDING":
        return "Medicines not yet collected"
    return None


class PatientService:
    def __init__(self, repo: ConsultationRepository) -> None:
        self._repo = repo

    async def get_my_consultation(self, appointment_id: int, patient_id: int) -> dict[str, Any]:
        doc = await self._repo.find_by_appointment_id(appointment_id)
        if doc is None or doc.get("status") != "COMPLETED" or doc.get("patientId") != patient_id:
            raise BusinessError(code="DRC_NOT_FOUND", message="Consultation not found", status=404)

        dispense = doc.get("dispense", {})
        return {
            "consultationId": str(doc["_id"]),
            "appointmentDate": doc.get("appointmentDate"),
            "doctorName": doc.get("doctorName"),
            "departmentName": doc.get("departmentName"),
            "chiefComplaint": doc.get("chiefComplaint"),
            "diagnosis": doc.get("diagnosis"),
            "advice": doc.get("advice"),
            "followUpDate": doc.get("followUpDate"),
            "vitals": doc.get("vitals"),
            "prescription": doc.get("prescription", []),
            "dispenseMessage": _dispense_message(dispense),
        }
