"""Hour arithmetic on timezone-aware UTC datetimes."""

from datetime import UTC, datetime, timedelta

HOUR = timedelta(hours=1)


def require_utc(value: datetime) -> datetime:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError("Naive datetimes are not allowed; use timezone-aware UTC.")
    return value.astimezone(UTC)


def floor_to_hour(value: datetime) -> datetime:
    return require_utc(value).replace(minute=0, second=0, microsecond=0)


def is_on_the_hour(value: datetime) -> bool:
    return value.minute == 0 and value.second == 0 and value.microsecond == 0


def ceil_to_hour(value: datetime) -> datetime:
    """The value itself if exactly on the hour, otherwise the next full hour."""
    value = require_utc(value)
    floored = floor_to_hour(value)
    return floored if is_on_the_hour(value) else floored + HOUR


def nearest_hour(value: datetime) -> datetime:
    """Nearest full hour; exactly half past rounds up."""
    value = require_utc(value)
    floored = floor_to_hour(value)
    return floored + HOUR if value - floored >= timedelta(minutes=30) else floored


def to_epoch(value: datetime) -> int:
    return int(require_utc(value).timestamp())


def from_epoch(epoch_s: int) -> datetime:
    return datetime.fromtimestamp(epoch_s, UTC)
