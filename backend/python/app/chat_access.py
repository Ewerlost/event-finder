from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ChatMember, ChatMessage, Event, Registration, utcnow


def as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def grant_chat_access(db: Session, event_id: str, user_id: str) -> None:
    member = db.scalar(
        select(ChatMember).where(ChatMember.event_id == event_id, ChatMember.user_id == user_id)
    )
    if member is None:
        db.add(ChatMember(event_id=event_id, user_id=user_id, joined_at=utcnow(), left_at=None))
        return
    member.left_at = None


def revoke_chat_access(db: Session, event_id: str, user_id: str) -> None:
    member = db.scalar(
        select(ChatMember).where(ChatMember.event_id == event_id, ChatMember.user_id == user_id)
    )
    if member is None:
        db.add(ChatMember(event_id=event_id, user_id=user_id, joined_at=utcnow(), left_at=utcnow()))
        return
    member.left_at = utcnow()


def chat_access(db: Session, event: Event, user_id: str) -> tuple[str, datetime | None]:
    if event.organizer_id == user_id:
        return "full", None
    member = db.scalar(
        select(ChatMember).where(ChatMember.event_id == event.id, ChatMember.user_id == user_id)
    )
    if member is not None and member.left_at is not None:
        return "history", as_utc(member.left_at)
    registration = db.scalar(
        select(Registration).where(Registration.event_id == event.id, Registration.user_id == user_id)
    )
    if registration is not None:
        return "full", None
    return "none", None


def visible_messages(db: Session, event: Event, user_id: str) -> tuple[str, list[ChatMessage]]:
    access, left_at = chat_access(db, event, user_id)
    if access == "none":
        return access, []
    messages = list(
        db.scalars(
            select(ChatMessage).where(ChatMessage.event_id == event.id).order_by(ChatMessage.created_at)
        ).all()
    )
    if left_at is not None:
        messages = [message for message in messages if as_utc(message.created_at) <= left_at]
    return access, messages
