import logging
from typing import Any, Optional

import httpx

from app.core.errors import ServiceUnavailableError

logger = logging.getLogger(__name__)

# SVC-00 MS-R4 / SVC-05 §2A: connect timeout 2s, total/read timeout 5s.
DEFAULT_TIMEOUT = httpx.Timeout(5.0, connect=2.0)


class BaseServiceClient:
    def __init__(self, base_url: str) -> None:
        self._base_url = base_url.rstrip("/")

    async def get(self, path: str, params: Optional[dict[str, Any]] = None) -> Optional[dict]:
        """GET a JSON resource. Returns None for 404, raises ServiceUnavailableError
        on connection errors, timeouts, or 5xx responses (SVC-00 MS-R4).
        """
        url = f"{self._base_url}{path}"
        try:
            async with httpx.AsyncClient(timeout=DEFAULT_TIMEOUT) as client:
                response = await client.get(url, params=params)
        except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as exc:
            logger.warning("Service call failed: %s %s (%s)", url, params, exc)
            raise ServiceUnavailableError(f"Could not reach {url}") from exc

        if response.status_code == 404:
            return None
        if response.status_code >= 500:
            logger.warning("Service call returned %s: %s", response.status_code, url)
            raise ServiceUnavailableError(f"{url} returned {response.status_code}")
        response.raise_for_status()
        return response.json()
