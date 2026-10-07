import uuid
from datetime import datetime
from typing import Any, Optional

from motor.motor_asyncio import AsyncIOMotorClientSession


def build_outbox_event(topic: str, message_key: str, payload: dict[str, Any]) -> dict[str, Any]:
    """Build a MongoDB outbox_events document per SVC-00 §8.3 (Mongo version)."""
    return {
        "eventId": str(uuid.uuid4()),
        "topic": topic,
        "messageKey": message_key,
        "payload": payload,
        "status": "NEW",
        "createdAt": datetime.utcnow(),
        "sentAt": None,
    }


async def insert_outbox_event(
    db,
    topic: str,
    message_key: str,
    payload: dict[str, Any],
    session: Optional[AsyncIOMotorClientSession] = None,
) -> dict[str, Any]:
    doc = build_outbox_event(topic, message_key, payload)
    await db["outbox_events"].insert_one(doc, session=session)
    return doc
