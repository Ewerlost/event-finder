from datetime import datetime, timezone

from app.models import Event


def event_starts_at(event: Event) -> datetime | None:
    raw_date = (event.date or "")[:10]
    try:
        year, month, day = [int(part) for part in raw_date.split("-")]
    except ValueError:
        return None
    hour, minute = 23, 59
    if event.time and ":" in event.time:
        parts = event.time.split(":")
        try:
            hour = int(parts[0])
            minute = int(parts[1])
        except ValueError:
            hour, minute = 23, 59
    return datetime(year, month, day, hour, minute, tzinfo=timezone.utc)


def is_past(event: Event) -> bool:
    starts_at = event_starts_at(event)
    if starts_at is None:
        return False
    return starts_at < datetime.now(timezone.utc)


def is_cancelled(event: Event) -> bool:
    return (getattr(event, "status", None) or "active") == "cancelled"
