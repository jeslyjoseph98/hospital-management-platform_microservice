from datetime import datetime
from typing import Any, Optional

from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorClientSession, AsyncIOMotorDatabase

# Projection used for pharmacist views: never doctorNotes or vitals (PHR-R3).
PHARMACY_EXCLUDE_PROJECTION = {"doctorNotes": 0, "vitals": 0}

# Projection used for patient views: never doctorNotes (PAT-R2).
PATIENT_EXCLUDE_PROJECTION = {"doctorNotes": 0}


class ConsultationRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._collection = db["consultations"]

    @property
    def collection(self):
        return self._collection

    @staticmethod
    def to_object_id(id_str: str) -> Optional[ObjectId]:
        if not ObjectId.is_valid(id_str):
            return None
        return ObjectId(id_str)

    async def find_by_appointment_id(self, appointment_id: int) -> Optional[dict[str, Any]]:
        return await self._collection.find_one({"appointmentId": appointment_id})

    async def find_by_id(self, consultation_id: str, projection: Optional[dict] = None) -> Optional[dict[str, Any]]:
        oid = self.to_object_id(consultation_id)
        if oid is None:
            return None
        return await self._collection.find_one({"_id": oid}, projection)

    async def insert_consultation(self, doc: dict[str, Any]) -> Any:
        result = await self._collection.insert_one(doc)
        return result.inserted_id

    async def update_in_progress(self, appointment_id: int, update_fields: dict[str, Any]) -> int:
        """DRC-R6: update only if currently IN_PROGRESS. Returns matched_count."""
        result = await self._collection.update_one(
            {"appointmentId": appointment_id, "status": "IN_PROGRESS"},
            {"$set": update_fields},
        )
        return result.matched_count

    async def complete_with_outbox(
        self,
        appointment_id: int,
        update_fields: dict[str, Any],
        outbox_doc: dict[str, Any],
        session: AsyncIOMotorClientSession,
    ) -> int:
        """DRC-R13: one transaction, update consultation (status: IN_PROGRESS ->
        COMPLETED) and insert outbox event. Returns matched_count (0 means abort).
        """
        result = await self._collection.update_one(
            {"appointmentId": appointment_id, "status": "IN_PROGRESS"},
            {"$set": update_fields},
            session=session,
        )
        if result.matched_count == 1:
            await self._db["outbox_events"].insert_one(outbox_doc, session=session)
        return result.matched_count

    async def find_history_for_patient(self, patient_id: int, limit: Optional[int] = None):
        cursor = self._collection.find(
            {"patientId": patient_id, "status": "COMPLETED"}
        ).sort("completedAt", -1)
        if limit is not None:
            cursor = cursor.limit(limit)
        return await cursor.to_list(length=limit or 1000)

    async def find_pending_dispense(self, start_utc: datetime, end_utc: datetime):
        cursor = self._collection.find(
            {
                "status": "COMPLETED",
                "dispense.status": "PENDING",
                "completedAt": {"$gte": start_utc, "$lt": end_utc},
            },
            PHARMACY_EXCLUDE_PROJECTION,
        ).sort("completedAt", 1)
        return await cursor.to_list(length=1000)

    async def search(self, query: str, since_utc: datetime):
        cursor = self._collection.find(
            {
                "$or": [{"patientCode": query}, {"appointmentCode": query}],
                "completedAt": {"$gte": since_utc},
                "dispense.status": {"$in": ["PENDING", "DISPENSED"]},
            },
            PHARMACY_EXCLUDE_PROJECTION,
        ).sort("completedAt", -1)
        return await cursor.to_list(length=200)

    async def dispense(
        self,
        consultation_id: ObjectId,
        by_user_id: int,
        by_name: str,
        remarks: Optional[str],
    ) -> int:
        """PHR-R5: atomic conditional update, only from PENDING."""
        result = await self._collection.update_one(
            {"_id": consultation_id, "dispense.status": "PENDING"},
            {
                "$set": {
                    "dispense.status": "DISPENSED",
                    "dispense.byUserId": by_user_id,
                    "dispense.byName": by_name,
                    "dispense.at": datetime.utcnow(),
                    "dispense.remarks": remarks,
                    "updatedAt": datetime.utcnow(),
                }
            },
        )
        return result.matched_count
