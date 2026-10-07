"""Unit tests for DoctorService.save/complete with repositories and clients
mocked. These exercise DRC-R5/R6 (ownership/date/status gating) and the
validation wiring, without touching MongoDB or HTTP.
"""
from datetime import datetime
from unittest.mock import AsyncMock, MagicMock

import pytest
from pymongo.errors import DuplicateKeyError

from app.core.errors import BusinessError
from app.core.time import today_hospital_date
from app.schemas.consultation import ConsultationSaveRequest
from app.services.doctor_service import DoctorService


def make_save_request(**overrides) -> ConsultationSaveRequest:
    defaults = dict(
        chiefComplaint="Fever",
        symptoms="Fever, headache",
        temperatureC=37.0,
        pulseBpm=80,
        bpSystolic=120,
        bpDiastolic=80,
        weightKg=70.0,
        diagnosis="Viral fever",
        doctorNotes=None,
        advice="Rest",
        followUpDate=None,
        prescription=[],
    )
    defaults.update(overrides)
    return ConsultationSaveRequest(**defaults)


def make_appointment(**overrides):
    defaults = dict(
        appointmentId=45,
        appointmentCode="APT00000045",
        appointmentDate=today_hospital_date(),
        tokenNumber=17,
        patientId=123,
        patientName="John Mathew",
        patientCode="PAT000123",
        patientGender="MALE",
        patientDob="1988-04-12",
        doctorId=3,
        doctorName="Dr. Rahul Menon",
        departmentName="Cardiology",
        status="BOOKED",
    )
    defaults.update(overrides)
    return defaults


@pytest.fixture
def repo():
    r = MagicMock()
    r.find_by_appointment_id = AsyncMock(return_value=None)
    r.insert_consultation = AsyncMock(return_value="fake_id")
    r.update_in_progress = AsyncMock(return_value=1)
    r.find_history_for_patient = AsyncMock(return_value=[])
    return r


@pytest.fixture
def appointment_client():
    c = MagicMock()
    c.get_appointment = AsyncMock(return_value=None)
    c.exists = AsyncMock(return_value=True)
    return c


@pytest.fixture
def user_client():
    c = MagicMock()
    c.get_patient = AsyncMock(return_value={"patientId": 123, "name": "John Mathew"})
    return c


@pytest.fixture
def mongo_client():
    return MagicMock()


@pytest.fixture
def service(repo, appointment_client, user_client, mongo_client):
    return DoctorService(repo, appointment_client, user_client, mongo_client)


class TestSaveNoExistingDocument:
    async def test_appointment_not_found_raises_404(self, service, appointment_client, repo):
        appointment_client.get_appointment.return_value = None
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_APPOINTMENT_NOT_FOUND"
        assert exc_info.value.status == 404

    async def test_wrong_doctor_raises_forbidden(self, service, appointment_client):
        appointment_client.get_appointment.return_value = make_appointment(doctorId=999)
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_NOT_YOUR_APPOINTMENT"
        assert exc_info.value.status == 403

    async def test_not_today_raises(self, service, appointment_client):
        appointment_client.get_appointment.return_value = make_appointment(appointmentDate="2000-01-01")
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_NOT_TODAY"

    async def test_not_booked_status_raises_already_completed(self, service, appointment_client):
        appointment_client.get_appointment.return_value = make_appointment(status="COMPLETED")
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_ALREADY_COMPLETED"

    async def test_happy_path_inserts_document(self, service, appointment_client, repo):
        appointment_client.get_appointment.return_value = make_appointment()
        repo.find_by_appointment_id = AsyncMock(
            side_effect=[None, {"_id": "x", "status": "IN_PROGRESS", "prescription": []}]
        )
        result = await service.save(45, doctor_id=3, body=make_save_request())
        repo.insert_consultation.assert_awaited_once()
        repo.update_in_progress.assert_awaited_once()
        assert result["consultationId"] == "x"

    async def test_duplicate_key_on_insert_falls_back_to_update_path(
        self, service, appointment_client, repo
    ):
        appointment_client.get_appointment.return_value = make_appointment()
        repo.insert_consultation = AsyncMock(side_effect=DuplicateKeyError("dup"))
        existing_doc = {
            "_id": "x",
            "doctorId": 3,
            "appointmentDate": today_hospital_date(),
            "status": "IN_PROGRESS",
            "prescription": [],
        }
        repo.find_by_appointment_id = AsyncMock(side_effect=[None, existing_doc, existing_doc])
        result = await service.save(45, doctor_id=3, body=make_save_request())
        repo.update_in_progress.assert_awaited_once()
        assert result["consultationId"] == "x"


class TestSaveExistingDocument:
    async def test_wrong_doctor_raises_forbidden(self, service, repo):
        repo.find_by_appointment_id = AsyncMock(
            return_value={
                "_id": "x",
                "doctorId": 999,
                "appointmentDate": today_hospital_date(),
                "status": "IN_PROGRESS",
            }
        )
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_NOT_YOUR_APPOINTMENT"

    async def test_not_today_raises(self, service, repo):
        repo.find_by_appointment_id = AsyncMock(
            return_value={
                "_id": "x",
                "doctorId": 3,
                "appointmentDate": "2000-01-01",
                "status": "IN_PROGRESS",
            }
        )
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_NOT_TODAY"

    async def test_already_completed_status_raises(self, service, repo):
        repo.find_by_appointment_id = AsyncMock(
            return_value={
                "_id": "x",
                "doctorId": 3,
                "appointmentDate": today_hospital_date(),
                "status": "COMPLETED",
            }
        )
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_ALREADY_COMPLETED"

    async def test_race_matched_zero_raises_already_completed(self, service, repo):
        existing_doc = {
            "_id": "x",
            "doctorId": 3,
            "appointmentDate": today_hospital_date(),
            "status": "IN_PROGRESS",
        }
        repo.find_by_appointment_id = AsyncMock(return_value=existing_doc)
        repo.update_in_progress = AsyncMock(return_value=0)
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_ALREADY_COMPLETED"

    async def test_invalid_vitals_rejected_before_touching_repo(self, service, repo):
        with pytest.raises(BusinessError) as exc_info:
            await service.save(45, doctor_id=3, body=make_save_request(temperatureC=100))
        assert exc_info.value.code == "DRC_VITALS_INVALID"
        repo.find_by_appointment_id.assert_not_called()


class TestComplete:
    async def test_missing_diagnosis_raises(self, service, repo):
        existing_doc = {
            "_id": "x",
            "doctorId": 3,
            "appointmentDate": today_hospital_date(),
            "status": "IN_PROGRESS",
            "prescription": [],
        }
        repo.find_by_appointment_id = AsyncMock(return_value=existing_doc)
        with pytest.raises(BusinessError) as exc_info:
            await service.complete(45, doctor_id=3, body=make_save_request(diagnosis=None))
        assert exc_info.value.code == "DRC_DIAGNOSIS_REQUIRED"

    async def test_happy_path_commits_transaction_and_sets_dispense_pending(
        self, service, repo, mongo_client
    ):
        existing_doc = {
            "_id": "x",
            "doctorId": 3,
            "appointmentDate": today_hospital_date(),
            "status": "IN_PROGRESS",
            "prescription": [],
        }
        completed_doc = {
            **existing_doc,
            "status": "COMPLETED",
            "prescription": [
                {
                    "medicineName": "Paracetamol",
                    "strength": "500mg",
                    "dosagePattern": "1-0-1",
                    "timing": "AFTER_FOOD",
                    "durationDays": 5,
                    "instructions": None,
                }
            ],
            "dispense": {"status": "PENDING"},
        }
        repo.find_by_appointment_id = AsyncMock(
            side_effect=[existing_doc, completed_doc, completed_doc]
        )
        repo.complete_with_outbox = AsyncMock(return_value=1)

        session_cm = AsyncMock()
        session = MagicMock()
        session.start_transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        session.start_transaction.return_value.__aexit__ = AsyncMock(return_value=False)
        session_cm.__aenter__ = AsyncMock(return_value=session)
        session_cm.__aexit__ = AsyncMock(return_value=False)
        mongo_client.start_session = AsyncMock(return_value=session_cm)

        body = make_save_request(
            prescription=[
                {
                    "medicineName": "Paracetamol",
                    "strength": "500mg",
                    "dosagePattern": "1-0-1",
                    "timing": "AFTER_FOOD",
                    "durationDays": 5,
                }
            ]
        )
        result = await service.complete(45, doctor_id=3, body=body)
        repo.complete_with_outbox.assert_awaited_once()
        assert result["status"] == "COMPLETED"

    async def test_transaction_matched_zero_raises_already_completed(
        self, service, repo, mongo_client
    ):
        existing_doc = {
            "_id": "x",
            "doctorId": 3,
            "appointmentDate": today_hospital_date(),
            "status": "IN_PROGRESS",
            "prescription": [],
        }
        repo.find_by_appointment_id = AsyncMock(return_value=existing_doc)
        repo.complete_with_outbox = AsyncMock(return_value=0)

        session = MagicMock()
        session.start_transaction.return_value.__aenter__ = AsyncMock(return_value=None)
        session.start_transaction.return_value.__aexit__ = AsyncMock(return_value=False)
        session_cm = AsyncMock()
        session_cm.__aenter__ = AsyncMock(return_value=session)
        session_cm.__aexit__ = AsyncMock(return_value=False)
        mongo_client.start_session = AsyncMock(return_value=session_cm)

        with pytest.raises(BusinessError) as exc_info:
            await service.complete(45, doctor_id=3, body=make_save_request())
        assert exc_info.value.code == "DRC_ALREADY_COMPLETED"


class TestPatientForDoctor:
    async def test_not_found_when_no_appointment_relationship(self, service, appointment_client):
        appointment_client.exists = AsyncMock(return_value=False)
        with pytest.raises(BusinessError) as exc_info:
            await service.get_patient_for_doctor(patient_id=123, doctor_id=3)
        assert exc_info.value.code == "DRC_PATIENT_NOT_FOUND"
        assert exc_info.value.status == 404

    async def test_happy_path_returns_patient_and_history(
        self, service, appointment_client, user_client, repo
    ):
        appointment_client.exists = AsyncMock(return_value=True)
        repo.find_history_for_patient = AsyncMock(return_value=[])
        result = await service.get_patient_for_doctor(patient_id=123, doctor_id=3)
        assert result["patient"]["patientId"] == 123
        assert result["history"] == []
