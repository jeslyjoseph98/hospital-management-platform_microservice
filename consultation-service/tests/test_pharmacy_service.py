"""Unit tests for PharmacyService with the repository mocked."""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from bson import ObjectId

from app.core.errors import BusinessError
from app.services.pharmacy_service import PharmacyService


@pytest.fixture
def repo():
    r = MagicMock()
    r.find_pending_dispense = AsyncMock(return_value=[])
    r.search = AsyncMock(return_value=[])
    r.find_by_id = AsyncMock(return_value=None)
    r.dispense = AsyncMock(return_value=1)
    r.to_object_id = MagicMock(side_effect=lambda s: ObjectId(s) if ObjectId.is_valid(s) else None)
    return r


@pytest.fixture
def service(repo):
    return PharmacyService(repo)


class TestPending:
    async def test_pending_maps_fields(self, repo, service):
        oid = ObjectId()
        repo.find_pending_dispense = AsyncMock(
            return_value=[
                {
                    "_id": oid,
                    "appointmentCode": "APT00000045",
                    "tokenNumber": 17,
                    "patientName": "John Mathew",
                    "patientCode": "PAT000123",
                    "doctorName": "Dr. Rahul Menon",
                    "departmentName": "Cardiology",
                    "completedAt": datetime(2026, 9, 28, 11, 5),
                    "prescription": [{"medicineName": "Paracetamol"}, {"medicineName": "Cetirizine"}],
                    "dispense": {"status": "PENDING"},
                }
            ]
        )
        result = await service.pending(date_str=None)
        assert len(result) == 1
        item = result[0]
        assert item["consultationId"] == str(oid)
        assert item["itemCount"] == 2
        assert item["dispenseStatus"] == "PENDING"


class TestDetail:
    async def test_not_found_raises(self, repo, service):
        repo.find_by_id = AsyncMock(return_value=None)
        with pytest.raises(BusinessError) as exc_info:
            await service.detail(str(ObjectId()))
        assert exc_info.value.code == "PHR_NOT_FOUND"
        assert exc_info.value.status == 404

    async def test_found_returns_detail_without_vitals_or_notes(self, repo, service):
        oid = ObjectId()
        repo.find_by_id = AsyncMock(
            return_value={
                "_id": oid,
                "appointmentCode": "APT00000045",
                "patientName": "John Mathew",
                "diagnosis": "Viral fever",
                "prescription": [],
                "dispense": {"status": "PENDING"},
            }
        )
        result = await service.detail(str(oid))
        assert "vitals" not in result
        assert "doctorNotes" not in result
        assert result["diagnosis"] == "Viral fever"


class TestDispense:
    async def test_invalid_id_raises_not_found(self, repo, service):
        repo.to_object_id = MagicMock(return_value=None)
        with pytest.raises(BusinessError) as exc_info:
            await service.dispense("not-an-oid", by_user_id=1, by_name="Pharm", remarks=None)
        assert exc_info.value.code == "PHR_NOT_FOUND"

    async def test_document_not_found_raises(self, repo, service):
        valid_id = str(ObjectId())
        repo.find_by_id = AsyncMock(return_value=None)
        with pytest.raises(BusinessError) as exc_info:
            await service.dispense(valid_id, by_user_id=1, by_name="Pharm", remarks=None)
        assert exc_info.value.code == "PHR_NOT_FOUND"

    async def test_not_required_raises_nothing_to_dispense(self, repo, service):
        valid_id = str(ObjectId())
        repo.find_by_id = AsyncMock(return_value={"dispense": {"status": "NOT_REQUIRED"}})
        with pytest.raises(BusinessError) as exc_info:
            await service.dispense(valid_id, by_user_id=1, by_name="Pharm", remarks=None)
        assert exc_info.value.code == "PHR_NOTHING_TO_DISPENSE"

    async def test_already_dispensed_race_raises(self, repo, service):
        valid_id = str(ObjectId())
        repo.find_by_id = AsyncMock(return_value={"dispense": {"status": "PENDING"}})
        repo.dispense = AsyncMock(return_value=0)
        with pytest.raises(BusinessError) as exc_info:
            await service.dispense(valid_id, by_user_id=1, by_name="Pharm", remarks=None)
        assert exc_info.value.code == "PHR_ALREADY_DISPENSED"

    async def test_happy_path_dispenses(self, repo, service):
        valid_id = str(ObjectId())
        repo.find_by_id = AsyncMock(
            side_effect=[
                {"dispense": {"status": "PENDING"}},
                {
                    "dispense": {
                        "status": "DISPENSED",
                        "at": datetime(2026, 9, 28, 12, 0),
                        "byName": "Pharm One",
                    }
                },
            ]
        )
        repo.dispense = AsyncMock(return_value=1)
        result = await service.dispense(valid_id, by_user_id=1, by_name="Pharm One", remarks="All given")
        assert result["dispenseStatus"] == "DISPENSED"
        assert result["dispensedByName"] == "Pharm One"
