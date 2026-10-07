import os


class Settings:
    """Service configuration, read from environment variables.

    All values can be overridden by env vars already wired into docker-compose.yml:
    PORT, MONGO_URL, APPOINTMENT_SERVICE_URL, USER_SERVICE_URL, KAFKA_BOOTSTRAP.
    """

    def __init__(self) -> None:
        self.port: int = int(os.getenv("PORT", "8084"))
        self.mongo_url: str = os.getenv(
            "MONGO_URL", "mongodb://localhost:27017/hms_consultation?replicaSet=rs0"
        )
        self.appointment_service_url: str = os.getenv(
            "APPOINTMENT_SERVICE_URL", "http://appointment-service:8083"
        )
        self.user_service_url: str = os.getenv(
            "USER_SERVICE_URL", "http://user-service:8081"
        )
        self.kafka_bootstrap: str = os.getenv("KAFKA_BOOTSTRAP", "kafka:9092")
        self.hospital_timezone: str = "Asia/Kolkata"


settings = Settings()
