from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase

from app.core.config import settings


class Mongo:
    client: AsyncIOMotorClient | None = None
    db: AsyncIOMotorDatabase | None = None


mongo = Mongo()


def get_client() -> AsyncIOMotorClient:
    if mongo.client is None:
        mongo.client = AsyncIOMotorClient(settings.mongo_url)
    return mongo.client


def get_db() -> AsyncIOMotorDatabase:
    if mongo.db is None:
        client = get_client()
        # Database name is taken from the MONGO_URL path; default to hms_consultation.
        mongo.db = client.get_default_database(default="hms_consultation")
    return mongo.db


async def close_client() -> None:
    if mongo.client is not None:
        mongo.client.close()
        mongo.client = None
        mongo.db = None
