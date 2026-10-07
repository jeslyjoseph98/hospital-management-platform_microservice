from datetime import datetime, timedelta
from typing import Any, Optional

from app.core.errors import BusinessError
from app.core.time import hospital_day_bounds_utc, today_hospital_date
from app.repositories.consultation_repository import ConsultationRepository


def _pending_item_out(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "consultationId": str(doc["_id"]),
        "appointmentCode": doc.get("appointmentCode"),
        "tokenNumber": doc.get("tokenNumber"),
        "patientName": doc.get("patientName"),
        "patientCode": doc.get("patientCode"),
        "doctorName": doc.get("doctorName"),
        "departmentName": doc.get("departmentName"),
        "completedAt": doc.get("completedAt"),
        "itemCount": len(doc.get("prescription", [])),
        "dispenseStatus": doc.get("dispense", {}).get("status"),
    }


def _detail_out(doc: dict[str, Any]) -> dict[str, Any]:
    """PHR-R3: patient name/code/age/gender, doctor, department, consultation
    date, diagnosis, items, follow-up date, dispense status. No doctorNotes,
    no vitals (repository projection already excludes them).
    """
    return {
        "consultationId": str(doc["_id"]),
        "appointmentCode": doc.get("appointmentCode"),
        "appointmentDate": doc.get("appointmentDate"),
        "tokenNumber": doc.get("tokenNumber"),
        "patientName": doc.get("patientName"),
        "patientCode": doc.get("patientCode"),
        "patientGender": doc.get("patientGender"),
        "patientDob": doc.get("patientDob"),
        "doctorName": doc.get("doctorName"),
        "departmentName": doc.get("departmentName"),
        "diagnosis": doc.get("diagnosis"),
        "followUpDate": doc.get("followUpDate"),
        "prescription": doc.get("prescription", []),
        "completedAt": doc.get("completedAt"),
        "dispense": doc.get("dispense"),
    }


class PharmacyService:
    def __init__(self, repo: ConsultationRepository) -> None:
        self._repo = repo

    async def pending(self, date_str: Optional[str]) -> list[dict[str, Any]]:
        effective_date = date_str or today_hospital_date()
        start_utc, end_utc = hospital_day_bounds_utc(effective_date)
        docs = await self._repo.find_pending_dispense(start_utc, end_utc)
        return [_pending_item_out(d) for d in docs]

    async def search(self, q: str) -> list[dict[str, Any]]:
        since_utc = datetime.utcnow() - timedelta(days=30)
        docs = await self._repo.search(q, since_utc)
        return [_pending_item_out(d) for d in docs]

    async def detail(self, consultation_id: str) -> dict[str, Any]:
        from app.repositories.consultation_repository import PHARMACY_EXCLUDE_PROJECTION

        doc = await self._repo.find_by_id(consultation_id, PHARMACY_EXCLUDE_PROJECTION)
        if doc is None:
            raise BusinessError(code="PHR_NOT_FOUND", message="Prescription not found", status=404)
        return _detail_out(doc)

    async def dispense(
        self, consultation_id: str, by_user_id: int, by_name: str, remarks: Optional[str]
    ) -> dict[str, Any]:
        oid = self._repo.to_object_id(consultation_id)
        if oid is None:
            raise BusinessError(code="PHR_NOT_FOUND", message="Prescription not found", status=404)

        doc = await self._repo.find_by_id(consultation_id)
        if doc is None:
            raise BusinessError(code="PHR_NOT_FOUND", message="Prescription not found", status=404)

        if doc.get("dispense", {}).get("status") == "NOT_REQUIRED":
            raise BusinessError(
                code="PHR_NOTHING_TO_DISPENSE",
                message="There is nothing to dispense for this consultation",
                status=409,
            )

        matched = await self._repo.dispense(oid, by_user_id, by_name, remarks)
        if matched == 0:
            raise BusinessError(
                code="PHR_ALREADY_DISPENSED",
                message="This prescription has already been dispensed",
                status=409,
            )

        refreshed = await self._repo.find_by_id(consultation_id)
        dispense = refreshed.get("dispense", {})
        return {
            "dispenseStatus": dispense.get("status"),
            "dispensedAt": dispense.get("at"),
            "dispensedByName": dispense.get("byName"),
        }
