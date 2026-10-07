from typing import Any, Optional

from bson import ObjectId
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse

# Service layer methods return raw Mongo documents/values in places (datetime,
# ObjectId). jsonable_encoder normally stringifies most custom types via str(),
# but we give it an explicit ObjectId encoder for clarity and register datetime
# handling through FastAPI's default ISO-8601 conversion.
_CUSTOM_ENCODERS = {ObjectId: str}


def _encode(content: Any) -> Any:
    return jsonable_encoder(content, custom_encoder=_CUSTOM_ENCODERS)


def success_response(data: Any = None, message: str = "OK", status_code: int = 200) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=_encode({"success": True, "data": data, "message": message}),
    )


def error_response(
    error_code: str,
    message: str,
    status_code: int = 409,
    field_errors: Optional[list[dict[str, Any]]] = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content=_encode(
            {
                "success": False,
                "errorCode": error_code,
                "message": message,
                "fieldErrors": field_errors or [],
                "data": None,
            }
        ),
    )
