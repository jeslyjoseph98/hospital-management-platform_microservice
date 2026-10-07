"""Unit tests for app.services.validation — pure business-rule checks, no DB/HTTP."""
import pytest
from pydantic import ValidationError as PydanticValidationError

from app.core.errors import BusinessError
from app.core.time import today_hospital_date
from app.schemas.consultation import ConsultationSaveRequest, PrescriptionItemIn
from app.services import validation


def make_body(**overrides) -> ConsultationSaveRequest:
    defaults = dict(
        chiefComplaint="Fever",
        symptoms="Fever, headache",
        temperatureC=None,
        pulseBpm=None,
        bpSystolic=None,
        bpDiastolic=None,
        weightKg=None,
        diagnosis="Viral fever",
        doctorNotes=None,
        advice=None,
        followUpDate=None,
        prescription=[],
    )
    defaults.update(overrides)
    return ConsultationSaveRequest(**defaults)


class TestVitalsValidation:
    def test_no_vitals_entered_passes(self):
        body = make_body()
        validation.validate_vitals(body)  # should not raise

    def test_all_vitals_in_range_passes(self):
        body = make_body(temperatureC=37.0, pulseBpm=80, bpSystolic=120, bpDiastolic=80, weightKg=70.0)
        validation.validate_vitals(body)

    @pytest.mark.parametrize(
        "field,value",
        [
            ("temperatureC", 29.9),
            ("temperatureC", 45.1),
            ("pulseBpm", 19),
            ("pulseBpm", 251),
            ("bpSystolic", 49),
            ("bpSystolic", 261),
            ("bpDiastolic", 29),
            ("bpDiastolic", 161),
            ("weightKg", 0.4),
            ("weightKg", 350.1),
        ],
    )
    def test_out_of_range_vital_raises(self, field, value):
        body = make_body(**{field: value})
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_vitals(body)
        assert exc_info.value.code == "DRC_VITALS_INVALID"
        assert exc_info.value.status == 409

    @pytest.mark.parametrize(
        "field,value",
        [
            ("temperatureC", 30),
            ("temperatureC", 45),
            ("pulseBpm", 20),
            ("pulseBpm", 250),
            ("bpSystolic", 50),
            ("bpSystolic", 260),
            ("bpDiastolic", 30),
            ("bpDiastolic", 160),
            ("weightKg", 0.5),
            ("weightKg", 350),
        ],
    )
    def test_boundary_values_pass(self, field, value):
        body = make_body(**{field: value})
        validation.validate_vitals(body)  # should not raise

    def test_one_vital_entered_others_none_only_validates_entered(self):
        body = make_body(temperatureC=37.0)
        validation.validate_vitals(body)  # should not raise; others are None


class TestFollowUpDateValidation:
    def test_no_followup_date_passes(self):
        body = make_body(followUpDate=None)
        validation.validate_followup_date(body)

    def test_future_date_passes(self):
        body = make_body(followUpDate="2099-01-01")
        validation.validate_followup_date(body)

    def test_today_is_invalid(self):
        body = make_body(followUpDate=today_hospital_date())
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_followup_date(body)
        assert exc_info.value.code == "DRC_FOLLOWUP_INVALID"

    def test_past_date_is_invalid(self):
        body = make_body(followUpDate="2000-01-01")
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_followup_date(body)
        assert exc_info.value.code == "DRC_FOLLOWUP_INVALID"


def make_item(**overrides) -> PrescriptionItemIn:
    defaults = dict(
        medicineName="Paracetamol",
        strength="500mg",
        dosagePattern="1-0-1",
        timing="AFTER_FOOD",
        durationDays=5,
        instructions=None,
    )
    defaults.update(overrides)
    return PrescriptionItemIn(**defaults)


class TestPrescriptionValidation:
    def test_empty_prescription_passes(self):
        body = make_body(prescription=[])
        validation.validate_prescription(body)

    def test_valid_items_pass(self):
        body = make_body(prescription=[make_item(), make_item(medicineName="Cetirizine")])
        validation.validate_prescription(body)

    def test_more_than_20_items_raises(self):
        items = [make_item() for _ in range(21)]
        body = make_body(prescription=items)
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_prescription(body)
        assert exc_info.value.code == "DRC_TOO_MANY_ITEMS"

    def test_exactly_20_items_passes(self):
        items = [make_item() for _ in range(20)]
        body = make_body(prescription=items)
        validation.validate_prescription(body)

    @pytest.mark.parametrize("duration", [0, -1, 366, 1000])
    def test_invalid_duration_rejected_by_schema(self, duration):
        # durationDays 1-365 (DRC-R9) is enforced by the Pydantic Field bounds
        # at the API boundary, so an out-of-range value never reaches the
        # service-layer validator - it fails model construction instead.
        with pytest.raises(PydanticValidationError):
            make_item(durationDays=duration)

    def test_invalid_duration_raises_if_it_ever_reaches_service_layer(self):
        # Defense-in-depth: even if an item bypassed Pydantic field bounds
        # (e.g. constructed internally), the service-layer check still
        # rejects bad durations.
        item = make_item()
        item.durationDays = 1000
        body = make_body(prescription=[item])
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_prescription(body)
        assert exc_info.value.code == "DRC_DOSAGE_INVALID"

    @pytest.mark.parametrize("duration", [1, 365])
    def test_boundary_duration_passes(self, duration):
        body = make_body(prescription=[make_item(durationDays=duration)])
        validation.validate_prescription(body)

    @pytest.mark.parametrize(
        "pattern",
        ["1-0", "1-0-1-1", "a-0-1", "1_0_1", "10-0-1", "1-0-1 ", "", "1--1"],
    )
    def test_invalid_dosage_pattern_raises(self, pattern):
        body = make_body(prescription=[make_item(dosagePattern=pattern)])
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_prescription(body)
        assert exc_info.value.code == "DRC_DOSAGE_INVALID"

    def test_zero_dosage_requires_as_needed_timing(self):
        body = make_body(prescription=[make_item(dosagePattern="0-0-0", timing="AFTER_FOOD")])
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_prescription(body)
        assert exc_info.value.code == "DRC_DOSAGE_INVALID"

    def test_zero_dosage_with_as_needed_timing_passes(self):
        body = make_body(prescription=[make_item(dosagePattern="0-0-0", timing="AS_NEEDED")])
        validation.validate_prescription(body)

    def test_missing_medicine_name_raises(self):
        body = make_body(prescription=[make_item(medicineName="   ")])
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_prescription(body)
        assert exc_info.value.code == "DRC_DOSAGE_INVALID"


class TestDiagnosisValidation:
    def test_diagnosis_present_passes(self):
        body = make_body(diagnosis="Viral fever")
        validation.validate_diagnosis_required(body)

    def test_diagnosis_missing_raises(self):
        body = make_body(diagnosis=None)
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_diagnosis_required(body)
        assert exc_info.value.code == "DRC_DIAGNOSIS_REQUIRED"

    def test_diagnosis_blank_raises(self):
        body = make_body(diagnosis="   ")
        with pytest.raises(BusinessError) as exc_info:
            validation.validate_diagnosis_required(body)
        assert exc_info.value.code == "DRC_DIAGNOSIS_REQUIRED"
