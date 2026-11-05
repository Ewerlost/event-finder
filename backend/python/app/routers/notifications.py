from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import Notification

router = APIRouter(prefix="/api/v1.0/notifications", tags=["notifications"])


def notification_to_dict(item: Notification) -> dict:
    created = item.created_at
    if created.tzinfo is None:
        text = created.isoformat() + "Z"
    else:
        text = created.isoformat().replace("+00:00", "Z")
    return {
        "id": item.id,
        "eventId": item.event_id,
        "text": item.text,
        "isRead": item.is_read,
        "createdAt": text,
    }


@router.get("")
def list_notifications(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    items = db.scalars(
        select(Notification)
        .where(Notification.user_id == current.profile_id)
        .order_by(Notification.created_at.desc())
    ).all()
    return [notification_to_dict(item) for item in items]


@router.post("/read")
def mark_notifications_read(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    items = db.scalars(select(Notification).where(Notification.user_id == current.profile_id)).all()
    for item in items:
        item.is_read = True
    db.commit()
    return {"updated": len(items)}
