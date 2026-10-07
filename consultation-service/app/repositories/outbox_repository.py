from motor.motor_asyncio import AsyncIOMotorDatabase


class OutboxRepository:
    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._collection = db["outbox_events"]

    @property
    def collection(self):
        return self._collection
