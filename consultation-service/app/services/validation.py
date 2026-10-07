from app.core.errors import BusinessError
from app.core.time import is_date_after_today
from app.schemas.consultation import DOSAGE_PATTERN_RE, ConsultationSaveRequest

VITALS_RANGES = {
    "temperatureC": (30, 45),
    "pulseBpm": (20, 250),
    "bpSystolic": (50, 260),
    "bpDiastolic": (30, 160),
    "weightKg": (0.5, 350),
}


def validate_vitals(body: ConsultationSaveRequest) -> None:
    """DRC-R7: if any vital entered, validate ranges for all entered vitals."""
    if not body.has_any_vital():
        return

    values = {
        "temperatureC": body.temperatureC,
        "pulseBpm": body.pulseBpm,
        "bpSystolic": body.bpSystolic,
        "bpDiastolic": body.bpDiastolic,
        "weightKg": body.weightKg,
    }
    for field, value in values.items():
        if value is None:
            continue
        low, high = VITALS_RANGES[field]
        if not (low <= value <= high):
            raise BusinessError(
                code="DRC_VITALS_INVALID",
                message=f"{field} must be between {low} and {high}",
                status=409,
            )


def validate_followup_date(body: ConsultationSaveRequest) -> None:
    """DRC-R8: followUpDate, if entered, must be after today."""
    if body.followUpDate is None:
        return
    if not is_date_after_today(body.followUpDate):
        raise BusinessError(
            code="DRC_FOLLOWUP_INVALID",
            message="Follow-up date must be after today",
            status=409,
        )


def validate_prescription(body: ConsultationSaveRequest) -> None:
    """DRC-R9: 0-20 items; each item validated (dosage pattern, timing, duration)."""
    if len(body.prescription) > 20:
        raise BusinessError(
            code="DRC_TOO_MANY_ITEMS",
            message="A prescription can have at most 20 items",
            status=409,
        )

    for item in body.prescription:
        if not item.medicineName or not item.medicineName.strip():
            raise BusinessError(
                code="DRC_DOSAGE_INVALID",
                message="medicineName is required",
                status=409,
            )
        if not (1 <= item.durationDays <= 365):
            raise BusinessError(
                code="DRC_DOSAGE_INVALID",
                message="durationDays must be between 1 and 365",
                status=409,
            )
        if not DOSAGE_PATTERN_RE.match(item.dosagePattern):
            raise BusinessError(
                code="DRC_DOSAGE_INVALID",
                message="dosagePattern must match d-d-d",
                status=409,
            )
        if item.dosagePattern == "0-0-0" and item.timing != "AS_NEEDED":
            raise BusinessError(
                code="DRC_DOSAGE_INVALID",
                message="dosagePattern 0-0-0 is only allowed when timing is AS_NEEDED",
                status=409,
            )


def validate_diagnosis_required(body: ConsultationSaveRequest) -> None:
    """DRC-R12: diagnosis required to complete."""
    if not body.diagnosis or not body.diagnosis.strip():
        raise BusinessError(
            code="DRC_DIAGNOSIS_REQUIRED",
            message="Diagnosis is required to complete the consultation",
            status=409,
        )


def validate_save_body(body: ConsultationSaveRequest) -> None:
    """Runs DRC-R7..R9 (the pure validation subset of the save rules)."""
    validate_vitals(body)
    validate_followup_date(body)
    validate_prescription(body)
