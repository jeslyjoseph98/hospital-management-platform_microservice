import asyncio
import json
import logging
from datetime import datetime, timezone

from aiokafka import AIOKafkaProducer
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import settings

logger = logging.getLogger(__name__)

BATCH_SIZE = 50
POLL_INTERVAL_SECONDS = 2


def _json_default(value):
    if isinstance(value, datetime):
        return value.isoformat()
    raise TypeError(f"Object of type {type(value)} is not JSON serializable")


class OutboxPublisher:
    """asyncio background task: every 2s, publish up to 50 oldest NEW
    outbox_events, per SVC-00 OB-R1..OB-R3.
    """

    def __init__(self, db: AsyncIOMotorDatabase) -> None:
        self._db = db
        self._producer: AIOKafkaProducer | None = None
        self._task: asyncio.Task | None = None
        self._stopping = False

    async def start(self) -> None:
        self._producer = AIOKafkaProducer(bootstrap_servers=settings.kafka_bootstrap)
        await self._producer.start()
        self._stopping = False
        self._task = asyncio.create_task(self._run_loop())
        logger.info("Outbox publisher started")

    async def stop(self) -> None:
        self._stopping = True
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._producer is not None:
            await self._producer.stop()
        logger.info("Outbox publisher stopped")

    async def _run_loop(self) -> None:
        while not self._stopping:
            try:
                await self.publish_once()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Outbox publisher run failed")
            await asyncio.sleep(POLL_INTERVAL_SECONDS)

    async def publish_once(self) -> int:
        """Publish oldest NEW records (max BATCH_SIZE). Returns count sent.
        OB-R2: on failure, stop this run; retry next run (don't advance past
        a failed record).
        """
        collection = self._db["outbox_events"]
        cursor = collection.find({"status": "NEW"}).sort("createdAt", 1).limit(BATCH_SIZE)
        records = await cursor.to_list(length=BATCH_SIZE)

        sent_count = 0
        for record in records:
            try:
                value = json.dumps(
                    {
                        "eventId": record["eventId"],
                        "eventType": record["topic"],
                        "occurredAt": record["createdAt"].replace(tzinfo=timezone.utc).isoformat()
                        if isinstance(record["createdAt"], datetime)
                        else record["createdAt"],
                        "payload": record["payload"],
                    },
                    default=_json_default,
                ).encode("utf-8")
                key = str(record["messageKey"]).encode("utf-8")
                await self._producer.send_and_wait(record["topic"], value=value, key=key)
            except Exception:
                logger.exception("Failed to publish outbox event %s; stopping this run", record.get("eventId"))
                break

            await collection.update_one(
                {"_id": record["_id"]},
                {"$set": {"status": "SENT", "sentAt": datetime.utcnow()}},
            )
            sent_count += 1

        return sent_count
