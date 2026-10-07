"""Unit tests for PatientService with the repository mocked."""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId

from app.core.errors import BusinessError
from app.services.patient_service import PatientService


@pytest.fixture
def repo():
    r = MagicMock()
    r.find_by_appointment_id = AsyncMock(return_value=None)
    return r


@pytest.fixture
def service(repo):
    return PatientService(repo)


class TestGetMyConsultation:
    async def test_not_found_raises(self, repo, service):
        repo.find_by_appointment_id = AsyncMock(return_value=None)
        with pytest.raises(BusinessError) as exc_info:
            await service.get_my_consultation(45, patient_id=123)
        assert exc_info.value.code == "DRC_NOT_FOUND"
        assert exc_info.value.status == 404

    async def test_not_completed_raises_not_found(self, repo, service):
        repo.find_by_appointment_id = AsyncMock(
            return_value={"status": "IN_PROGRESS", "patientId": 123}
        )
        with pytest.raises(BusinessError) as exc_info:
            await service.get_my_consultation(45, patient_id=123)
        assert exc_info.value.code == "DRC_NOT_FOUND"

    async def test_wrong_patient_raises_not_found(self, repo, service):
        repo.find_by_appointment_id = AsyncMock(
            return_value={"status": "COMPLETED", "patientId": 999}
        )
        with pytest.raises(BusinessError) as exc_info:
            await service.get_my_consultation(45, patient_id=123)
        assert exc_info.value.code == "DRC_NOT_FOUND"

    async def test_happy_path_excludes_doctor_notes(self, repo, service):
        oid = ObjectId()
        repo.find_by_appointment_id = AsyncMock(
            return_value={
                "_id": oid,
                "status": "COMPLETED",
                "patientId": 123,
                "doctorNotes": "Private notes",
                "diagnosis": "Viral fever",
                "prescription": [],
                "dispense": {"status": "PENDING"},
            }
        )
        result = await service.get_my_consultation(45, patient_id=123)
        assert "doctorNotes" not in result
        assert result["dispenseMessage"] == "Medicines not yet collected"

    async def test_dispensed_message_includes_date_and_remarks(self, repo, service):
        repo.find_by_appointment_id = AsyncMock(
            return_value={
                "_id": ObjectId(),
                "status": "COMPLETED",
                "patientId": 123,
                "prescription": [],
                "dispense": {
                    "status": "DISPENSED",
                    "at": datetime(2026, 9, 28),
                    "remarks": "All given",
                },
            }
        )
        result = await service.get_my_consultation(45, patient_id=123)
        assert "2026-09-28" in result["dispenseMessage"]
        assert "All given" in result["dispenseMessage"]

    async def test_not_required_dispense_message_is_none(self, repo, service):
        repo.find_by_appointment_id = AsyncMock(
            return_value={
                "_id": ObjectId(),
                "status": "COMPLETED",
                "patientId": 123,
                "prescription": [],
                "dispense": {"status": "NOT_REQUIRED"},
            }
        )
        result = await service.get_my_consultation(45, patient_id=123)
        assert result["dispenseMessage"] is None
