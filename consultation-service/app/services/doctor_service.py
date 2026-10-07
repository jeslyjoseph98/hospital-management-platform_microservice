from datetime import datetime
from typing import Any, Optional

from pymongo.errors import DuplicateKeyError

from app.clients.appointment_client import AppointmentClient
from app.clients.user_client import UserClient
from app.core.errors import BusinessError
from app.core.time import now_utc, today_hospital_date
from app.events.outbox import build_outbox_event
from app.repositories.consultation_repository import ConsultationRepository
from app.schemas.consultation import ConsultationSaveRequest
from app.services import validation


def _prescription_to_docs(body: ConsultationSaveRequest) -> list[dict[str, Any]]:
    return [item.model_dump() for item in body.prescription]


def _vitals_doc(body: ConsultationSaveRequest) -> dict[str, Any]:
    return {
        "temperatureC": body.temperatureC,
        "pulseBpm": body.pulseBpm,
        "bpSystolic": body.bpSystolic,
        "bpDiastolic": body.bpDiastolic,
        "weightKg": body.weightKg,
    }


def _editable_fields(body: ConsultationSaveRequest) -> dict[str, Any]:
    return {
        "chiefComplaint": body.chiefComplaint,
        "symptoms": body.symptoms,
        "vitals": _vitals_doc(body),
        "diagnosis": body.diagnosis,
        "doctorNotes": body.doctorNotes,
        "advice": body.advice,
        "followUpDate": body.followUpDate,
        "prescription": _prescription_to_docs(body),
    }


class DoctorService:
    def __init__(
        self,
        repo: ConsultationRepository,
        appointment_client: AppointmentClient,
        user_client: UserClient,
        mongo_client,
    ) -> None:
        self._repo = repo
        self._appointment_client = appointment_client
        self._user_client = user_client
        self._mongo_client = mongo_client

    async def _fetch_appointment_or_404(self, appointment_id: int) -> dict[str, Any]:
        appointment = await self._appointment_client.get_appointment(appointment_id)
        if appointment is None:
            raise BusinessError(
                code="DRC_APPOINTMENT_NOT_FOUND",
                message="Appointment not found",
                status=404,
            )
        return appointment

    @staticmethod
    def _check_doctor_owns(appointment: dict[str, Any], doctor_id: int) -> None:
        apt_doctor_id = appointment.get("doctorId", appointment.get("doctor_id"))
        if apt_doctor_id != doctor_id:
            raise BusinessError(
                code="DRC_NOT_YOUR_APPOINTMENT",
                message="This appointment does not belong to you",
                status=403,
            )

    @staticmethod
    def _snapshot_from_appointment(appointment: dict[str, Any]) -> dict[str, Any]:
        return {
            "appointmentCode": appointment.get("appointmentCode", appointment.get("appointment_code")),
            "appointmentDate": appointment.get("appointmentDate", appointment.get("appointment_date")),
            "tokenNumber": appointment.get("tokenNumber", appointment.get("token_number")),
            "patientName": appointment.get("patientName", appointment.get("patient_name")),
            "patientCode": appointment.get("patientCode", appointment.get("patient_code")),
            "patientGender": appointment.get("patientGender", appointment.get("patient_gender")),
            "patientDob": appointment.get("patientDob", appointment.get("patient_dob")),
            "doctorName": appointment.get("doctorName", appointment.get("doctor_name")),
            "departmentName": appointment.get("departmentName", appointment.get("department_name")),
        }

    # ---------------------------------------------------------------
    # §4.1 Open
    # ---------------------------------------------------------------
    async def open_appointment(self, appointment_id: int, doctor_id: int) -> dict[str, Any]:
        consultation = await self._repo.find_by_appointment_id(appointment_id)

        if consultation is not None:
            # DRC-R1
            if consultation["doctorId"] != doctor_id:
                raise BusinessError(
                    code="DRC_NOT_YOUR_APPOINTMENT",
                    message="This appointment does not belong to you",
                    status=403,
                )
            patient_id = consultation["patientId"]
            appointment_view = {
                "appointmentId": appointment_id,
                "appointmentCode": consultation.get("appointmentCode"),
                "appointmentDate": consultation.get("appointmentDate"),
                "tokenNumber": consultation.get("tokenNumber"),
                "status": consultation.get("status"),
            }
        else:
            # DRC-R2
            appointment = await self._fetch_appointment_or_404(appointment_id)
            self._check_doctor_owns(appointment, doctor_id)
            patient_id = appointment.get("patientId", appointment.get("patient_id"))
            appointment_view = {
                "appointmentId": appointment_id,
                "appointmentCode": appointment.get("appointmentCode", appointment.get("appointment_code")),
                "appointmentDate": appointment.get("appointmentDate", appointment.get("appointment_date")),
                "tokenNumber": appointment.get("tokenNumber", appointment.get("token_number")),
                "status": appointment.get("status"),
            }

        # DRC-R3
        patient = await self._user_client.get_patient(patient_id)

        # DRC-R4: last 5 completed visits
        history = await self._repo.find_history_for_patient(patient_id, limit=5)

        return {
            "appointment": appointment_view,
            "patient": patient,
            "history": [self._history_item(h) for h in history],
            "consultation": self._consultation_out(consultation) if consultation else None,
        }

    @staticmethod
    def _history_item(doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "consultationId": str(doc["_id"]),
            "appointmentDate": doc.get("appointmentDate"),
            "doctorName": doc.get("doctorName"),
            "departmentName": doc.get("departmentName"),
            "chiefComplaint": doc.get("chiefComplaint"),
            "diagnosis": doc.get("diagnosis"),
            "advice": doc.get("advice"),
            "doctorNotes": doc.get("doctorNotes"),
            "followUpDate": doc.get("followUpDate"),
            "prescription": doc.get("prescription", []),
            "dispenseStatus": doc.get("dispense", {}).get("status"),
            "completedAt": doc.get("completedAt"),
        }

    @staticmethod
    def _consultation_out(doc: dict[str, Any]) -> dict[str, Any]:
        return {
            "consultationId": str(doc["_id"]),
            "chiefComplaint": doc.get("chiefComplaint"),
            "symptoms": doc.get("symptoms"),
            "vitals": doc.get("vitals"),
            "diagnosis": doc.get("diagnosis"),
            "doctorNotes": doc.get("doctorNotes"),
            "advice": doc.get("advice"),
            "followUpDate": doc.get("followUpDate"),
            "prescription": doc.get("prescription", []),
            "status": doc.get("status"),
            "dispense": doc.get("dispense"),
        }

    # ---------------------------------------------------------------
    # §4.2 Save
    # ---------------------------------------------------------------
    async def _ensure_document_for_save(
        self, appointment_id: int, doctor_id: int
    ) -> dict[str, Any]:
        """Returns the existing (or freshly inserted) consultation document,
        enforcing DRC-R5/DRC-R6 ownership/date/status checks. Does NOT apply
        the body fields yet - caller does that with an update_one.
        """
        consultation = await self._repo.find_by_appointment_id(appointment_id)

        if consultation is None:
            appointment = await self._fetch_appointment_or_404(appointment_id)
            self._check_doctor_owns(appointment, doctor_id)

            apt_date = appointment.get("appointmentDate", appointment.get("appointment_date"))
            if apt_date != today_hospital_date():
                raise BusinessError(
                    code="DRC_NOT_TODAY",
                    message="This appointment is not for today",
                    status=409,
                )
            apt_status = appointment.get("status")
            if apt_status != "BOOKED":
                raise BusinessError(
                    code="DRC_ALREADY_COMPLETED",
                    message="This appointment is no longer open for consultation",
                    status=409,
                )

            patient_id = appointment.get("patientId", appointment.get("patient_id"))
            snapshot = self._snapshot_from_appointment(appointment)
            now = now_utc()
            new_doc = {
                "appointmentId": appointment_id,
                "patientId": patient_id,
                "doctorId": doctor_id,
                **snapshot,
                "chiefComplaint": None,
                "symptoms": None,
                "vitals": {
                    "temperatureC": None,
                    "pulseBpm": None,
                    "bpSystolic": None,
                    "bpDiastolic": None,
                    "weightKg": None,
                },
                "diagnosis": None,
                "doctorNotes": None,
                "advice": None,
                "followUpDate": None,
                "prescription": [],
                "status": "IN_PROGRESS",
                "completedAt": None,
                "dispense": {
                    "status": "NOT_REQUIRED",
                    "byUserId": None,
                    "byName": None,
                    "at": None,
                    "remarks": None,
                },
                "createdAt": now,
                "updatedAt": now,
            }
            try:
                await self._repo.insert_consultation(new_doc)
                return new_doc
            except DuplicateKeyError:
                # Another save created it a moment ago - continue as DRC-R6.
                consultation = await self._repo.find_by_appointment_id(appointment_id)
                if consultation is None:
                    # Should not happen, but guard anyway.
                    raise BusinessError(
                        code="DRC_ALREADY_COMPLETED",
                        message="This appointment is no longer open for consultation",
                        status=409,
                    )

        # DRC-R6: document now exists (either pre-existing, or raced into existence).
        if consultation["doctorId"] != doctor_id:
            raise BusinessError(
                code="DRC_NOT_YOUR_APPOINTMENT",
                message="This appointment does not belong to you",
                status=403,
            )
        if consultation.get("appointmentDate") != today_hospital_date():
            raise BusinessError(
                code="DRC_NOT_TODAY",
                message="This appointment is not for today",
                status=409,
            )
        if consultation.get("status") != "IN_PROGRESS":
            raise BusinessError(
                code="DRC_ALREADY_COMPLETED",
                message="This consultation is already completed",
                status=409,
            )
        return consultation

    async def save(
        self, appointment_id: int, doctor_id: int, body: ConsultationSaveRequest
    ) -> dict[str, Any]:
        validation.validate_save_body(body)

        consultation = await self._ensure_document_for_save(appointment_id, doctor_id)

        update_fields = _editable_fields(body)
        update_fields["updatedAt"] = now_utc()

        matched = await self._repo.update_in_progress(appointment_id, update_fields)
        if matched == 0:
            raise BusinessError(
                code="DRC_ALREADY_COMPLETED",
                message="This consultation is already completed",
                status=409,
            )

        refreshed = await self._repo.find_by_appointment_id(appointment_id)
        return self._consultation_out(refreshed)

    # ---------------------------------------------------------------
    # §4.3 Complete
    # ---------------------------------------------------------------
    async def complete(
        self, appointment_id: int, doctor_id: int, body: ConsultationSaveRequest
    ) -> dict[str, Any]:
        # DRC-R11: run save rules first (ownership/date/status + field validation),
        # and persist the latest edits before completing.
        validation.validate_save_body(body)
        await self._ensure_document_for_save(appointment_id, doctor_id)

        update_fields = _editable_fields(body)
        update_fields["updatedAt"] = now_utc()
        matched = await self._repo.update_in_progress(appointment_id, update_fields)
        if matched == 0:
            raise BusinessError(
                code="DRC_ALREADY_COMPLETED",
                message="This consultation is already completed",
                status=409,
            )

        # DRC-R12
        validation.validate_diagnosis_required(body)

        consultation = await self._repo.find_by_appointment_id(appointment_id)
        prescription_items = consultation.get("prescription", [])
        dispense_status = "PENDING" if len(prescription_items) > 0 else "NOT_REQUIRED"
        completed_at = now_utc()

        complete_fields = {
            "status": "COMPLETED",
            "completedAt": completed_at,
            "dispense.status": dispense_status,
            "updatedAt": completed_at,
        }

        consultation_id_str = str(consultation["_id"])
        outbox_doc = build_outbox_event(
            topic="consultation.completed",
            message_key=str(appointment_id),
            payload={"consultationId": consultation_id_str, "appointmentId": appointment_id},
        )

        async with await self._mongo_client.start_session() as session:
            async def _txn(session):
                matched_in_txn = await self._repo.complete_with_outbox(
                    appointment_id, complete_fields, outbox_doc, session
                )
                if matched_in_txn == 0:
                    raise BusinessError(
                        code="DRC_ALREADY_COMPLETED",
                        message="This consultation is already completed",
                        status=409,
                    )

            async with session.start_transaction():
                await _txn(session)

        refreshed = await self._repo.find_by_appointment_id(appointment_id)
        return self._consultation_out(refreshed)

    # ---------------------------------------------------------------
    # §4.4 Patient details and history
    # ---------------------------------------------------------------
    async def get_patient_for_doctor(self, patient_id: int, doctor_id: int) -> dict[str, Any]:
        exists = await self._appointment_client.exists(doctor_id=doctor_id, patient_id=patient_id)
        if not exists:
            raise BusinessError(
                code="DRC_PATIENT_NOT_FOUND",
                message="This patient has not booked with you",
                status=404,
            )

        patient = await self._user_client.get_patient(patient_id)
        history = await self._repo.find_history_for_patient(patient_id)

        return {
            "patient": patient,
            "history": [self._history_item(h) for h in history],
        }
