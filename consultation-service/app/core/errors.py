from typing import Any, Optional


class BusinessError(Exception):
    """Business rule violation.

    `code` is the SVC-00 §7 errorCode string, `status` is the HTTP status to
    respond with, `field_errors` optionally populates the response's
    fieldErrors array (used for VALIDATION_FAILED).
    """

    def __init__(
        self,
        code: str,
        message: str,
        status: int = 409,
        field_errors: Optional[list[dict[str, Any]]] = None,
    ) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.field_errors = field_errors or []


class ServiceUnavailableError(BusinessError):
    def __init__(self, message: str = "A dependent service is unavailable") -> None:
        super().__init__(code="SERVICE_UNAVAILABLE", message=message, status=503)


class ValidationFailedError(BusinessError):
    def __init__(
        self, message: str = "Validation failed", field_errors: Optional[list[dict[str, Any]]] = None
    ) -> None:
        super().__init__(
            code="VALIDATION_FAILED", message=message, status=400, field_errors=field_errors
        )


class NotFoundError(BusinessError):
    def __init__(self, code: str, message: str) -> None:
        super().__init__(code=code, message=message, status=404)
