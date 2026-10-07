import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from pydantic import ValidationError

from app.clients.appointment_client import appointment_client
from app.clients.user_client import user_client
from app.core.envelope import error_response
from app.core.errors import BusinessError
from app.db.indexes import ensure_indexes
from app.db.mongo import close_client, get_client, get_db
from app.events.publisher import OutboxPublisher
from app.repositories.consultation_repository import ConsultationRepository
from app.routers import doctor_router, patient_router, pharmacy_router
from app.services.doctor_service import DoctorService
from app.services.patient_service import PatientService
from app.services.pharmacy_service import PharmacyService

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    db = get_db()
    await ensure_indexes(db)

    repo = ConsultationRepository(db)
    app.state.db = db
    app.state.doctor_service = DoctorService(repo, appointment_client, user_client, get_client())
    app.state.pharmacy_service = PharmacyService(repo)
    app.state.patient_service = PatientService(repo)

    publisher = OutboxPublisher(db)
    await publisher.start()
    app.state.outbox_publisher = publisher

    logger.info("consultation-service started")
    yield

    await publisher.stop()
    await close_client()
    logger.info("consultation-service stopped")


app = FastAPI(title="consultation-service", lifespan=lifespan)

app.include_router(doctor_router.router)
app.include_router(pharmacy_router.router)
app.include_router(patient_router.router)


@app.exception_handler(BusinessError)
async def business_error_handler(request: Request, exc: BusinessError):
    return error_response(exc.code, exc.message, exc.status, exc.field_errors)


@app.exception_handler(RequestValidationError)
async def validation_error_handler(request: Request, exc: RequestValidationError):
    field_errors = []
    for err in exc.errors():
        loc = err.get("loc", [])
        field = ".".join(str(part) for part in loc if part not in ("body",))
        field_errors.append({"field": field, "message": err.get("msg")})
    return error_response("VALIDATION_FAILED", "Validation failed", 400, field_errors)


@app.exception_handler(ValidationError)
async def pydantic_validation_error_handler(request: Request, exc: ValidationError):
    field_errors = [
        {"field": ".".join(str(p) for p in err.get("loc", [])), "message": err.get("msg")}
        for err in exc.errors()
    ]
    return error_response("VALIDATION_FAILED", "Validation failed", 400, field_errors)


@app.get("/health")
async def health():
    return {"status": "UP"}
