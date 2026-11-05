from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chat_access import grant_chat_access
from app.models import Event, Notification, Registration, WaitlistEntry, utcnow


def present_events(db: Session, events: Event | list[Event], user_id: str):
    many = isinstance(events, list)
    items = events if many else [events]
    event_ids = [event.id for event in items]
    rows = []
    if event_ids:
        rows = list(
            db.scalars(
                select(WaitlistEntry)
                .where(WaitlistEntry.event_id.in_(event_ids))
                .order_by(WaitlistEntry.created_at)
            ).all()
        )
    grouped: dict[str, list[WaitlistEntry]] = {}
    for row in rows:
        grouped.setdefault(row.event_id, []).append(row)

    from app.mappers import event_to_dict

    presented = []
    for event in items:
        data = event_to_dict(event, user_id)
        queue = grouped.get(event.id, [])
        mine = next((row for row in queue if row.user_id == user_id), None)
        data["amIWaitlisted"] = mine is not None
        if mine is None:
            data["waitlistPosition"] = None
        else:
            ahead = sum(1 for row in queue if row.created_at > mine.created_at)
            data["waitlistPosition"] = ahead + 1
        presented.append(data)
    return presented if many else presented[0]


def promote_waitlist(db: Session, event: Event) -> bool:
    if event.available_spots is None or event.available_spots <= 0:
        return False
    entry = db.scalar(
        select(WaitlistEntry)
        .where(WaitlistEntry.event_id == event.id)
        .order_by(WaitlistEntry.created_at.desc())
        .limit(1)
    )
    if entry is None:
        return False
    db.add(Registration(user_id=entry.user_id, event_id=event.id, registration_date=utcnow()))
    grant_chat_access(db, event.id, entry.user_id)
    event.available_spots -= 1
    db.add(
        Notification(
            user_id=entry.user_id,
            event_id=event.id,
            text=f"Освободилось место на «{event.title}». Вы записаны на мероприятие.",
            is_read=False,
        )
    )
    db.delete(entry)
    return True
