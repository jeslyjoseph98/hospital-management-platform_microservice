import logging

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


async def ensure_indexes(db: AsyncIOMotorDatabase) -> None:
    """Create all indexes required by SVC-05 §2.1/§2.2. Idempotent: safe to run
    on every startup.
    """
    consultations = db["consultations"]
    await consultations.create_index("appointmentId", unique=True, name="uniq_appointmentId")
    await consultations.create_index(
        [("patientId", 1), ("completedAt", -1)], name="patientId_completedAt"
    )
    await consultations.create_index(
        [("dispense.status", 1), ("completedAt", 1)], name="dispenseStatus_completedAt"
    )
    await consultations.create_index("patientCode", name="patientCode")
    await consultations.create_index("appointmentCode", name="appointmentCode")

    outbox = db["outbox_events"]
    await outbox.create_index("eventId", unique=True, name="uniq_eventId")
    await outbox.create_index([("status", 1), ("createdAt", 1)], name="status_createdAt")

    logger.info("MongoDB indexes ensured")
