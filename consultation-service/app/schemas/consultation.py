import re
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

DOSAGE_PATTERN_RE = re.compile(r"^[0-9]-[0-9]-[0-9]$")

TimingLiteral = Literal["BEFORE_FOOD", "AFTER_FOOD", "BEDTIME", "AS_NEEDED"]
ConsultationStatus = Literal["IN_PROGRESS", "COMPLETED"]
DispenseStatus = Literal["NOT_REQUIRED", "PENDING", "DISPENSED"]


class PrescriptionItemIn(BaseModel):
    medicineName: str = Field(..., min_length=1, max_length=200)
    strength: Optional[str] = Field(default=None, max_length=50)
    dosagePattern: str
    timing: TimingLiteral
    durationDays: int = Field(..., ge=1, le=365)
    instructions: Optional[str] = Field(default=None, max_length=500)


class PrescriptionItemOut(BaseModel):
    medicineName: str
    strength: Optional[str] = None
    dosagePattern: str
    timing: str
    durationDays: int
    instructions: Optional[str] = None


class VitalsIn(BaseModel):
    temperatureC: Optional[float] = None
    pulseBpm: Optional[int] = None
    bpSystolic: Optional[int] = None
    bpDiastolic: Optional[int] = None
    weightKg: Optional[float] = None


class VitalsOut(BaseModel):
    temperatureC: Optional[float] = None
    pulseBpm: Optional[int] = None
    bpSystolic: Optional[int] = None
    bpDiastolic: Optional[int] = None
    weightKg: Optional[float] = None


class DispenseOut(BaseModel):
    status: DispenseStatus
    byUserId: Optional[int] = None
    byName: Optional[str] = None
    at: Optional[datetime] = None
    remarks: Optional[str] = None


class ConsultationSaveRequest(BaseModel):
    """Body for PUT save and POST complete (SVC-05 §7.1)."""

    chiefComplaint: Optional[str] = Field(default=None, max_length=500)
    symptoms: Optional[str] = Field(default=None, max_length=1000)
    temperatureC: Optional[float] = None
    pulseBpm: Optional[int] = None
    bpSystolic: Optional[int] = None
    bpDiastolic: Optional[int] = None
    weightKg: Optional[float] = None
    diagnosis: Optional[str] = Field(default=None, max_length=500)
    doctorNotes: Optional[str] = Field(default=None, max_length=2000)
    advice: Optional[str] = Field(default=None, max_length=1000)
    followUpDate: Optional[str] = None
    prescription: list[PrescriptionItemIn] = Field(default_factory=list)

    @field_validator("followUpDate")
    @classmethod
    def validate_followup_format(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        if not re.match(r"^\d{4}-\d{2}-\d{2}$", v):
            raise ValueError("followUpDate must be YYYY-MM-DD")
        return v

    def has_any_vital(self) -> bool:
        return any(
            value is not None
            for value in (
                self.temperatureC,
                self.pulseBpm,
                self.bpSystolic,
                self.bpDiastolic,
                self.weightKg,
            )
        )


class DispenseRequest(BaseModel):
    remarks: Optional[str] = Field(default=None, max_length=500)
