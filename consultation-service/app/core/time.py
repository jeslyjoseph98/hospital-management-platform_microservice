from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from app.core.config import settings

HOSPITAL_TZ = ZoneInfo(settings.hospital_timezone)


def today_hospital_date() -> str:
    """Return today's date as YYYY-MM-DD in the hospital timezone."""
    return datetime.now(HOSPITAL_TZ).strftime("%Y-%m-%d")


def now_utc() -> datetime:
    return datetime.utcnow()


def hospital_day_bounds_utc(date_str: str) -> tuple[datetime, datetime]:
    """Given a YYYY-MM-DD date (hospital timezone), return (start, end) as
    naive UTC datetimes usable directly in Mongo queries against Date fields.
    """
    local_midnight = datetime.strptime(date_str, "%Y-%m-%d").replace(tzinfo=HOSPITAL_TZ)
    start_utc = local_midnight.astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    end_utc = (local_midnight + timedelta(days=1)).astimezone(ZoneInfo("UTC")).replace(tzinfo=None)
    return start_utc, end_utc


def is_date_after_today(date_str: str) -> bool:
    return date_str > today_hospital_date()
