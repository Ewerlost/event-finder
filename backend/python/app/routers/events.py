from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, get_current_user, parse_id
from app.mappers import apply_event_fields, display_name, event_to_dict
from app.models import Event, Profile, Registration, utcnow
from app.schemas import EventBody

router = APIRouter(prefix="/api/v1.0/events", tags=["events"])

_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp"}
_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
}


def _load_event(db: Session, event_id: str) -> Event | None:
    return db.scalar(
        select(Event).options(selectinload(Event.registrations)).where(Event.id == event_id)
    )


def _profile(db: Session, profile_id: str) -> Profile:
    profile = db.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=401)
    return profile


@router.get("")
def list_events(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    events = db.scalars(
        select(Event).options(selectinload(Event.registrations)).order_by(Event.date, Event.time)
    ).all()
    return [event_to_dict(event, current.profile_id) for event in events]


@router.get("/organizer/{organizer_id}")
def list_by_organizer(
    organizer_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    organizer_id = parse_id(organizer_id)
    events = db.scalars(
        select(Event)
        .options(selectinload(Event.registrations))
        .where(Event.organizer_id == organizer_id)
        .order_by(Event.date, Event.time)
    ).all()
    return [event_to_dict(event, current.profile_id) for event in events]


@router.get("/user/registered")
def list_registered(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    events = db.scalars(
        select(Event)
        .join(Registration)
        .options(selectinload(Event.registrations))
        .where(Registration.user_id == current.profile_id)
        .order_by(Event.date, Event.time)
    ).unique().all()
    return [event_to_dict(event, current.profile_id) for event in events]


@router.get("/{event_id}")
def get_event(
    event_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = _load_event(db, parse_id(event_id))
    if event is None:
        raise HTTPException(status_code=404)
    return event_to_dict(event, current.profile_id)


@router.post("", status_code=201)
def create_event(
    body: EventBody,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    profile = _profile(db, current.profile_id)
    event = Event(organizer_id=profile.id)
    apply_event_fields(event, body)
    event.organizer_id = profile.id
    event.organizer_name = display_name(profile)
    event.organizer_avatar = profile.avatar_url
    if event.available_spots is None:
        event.available_spots = event.total_spots
    db.add(event)
    db.commit()
    db.refresh(event)
    created = _load_event(db, event.id)
    return event_to_dict(created, current.profile_id)


@router.put("/{event_id}")
def update_event(
    event_id: str,
    body: EventBody,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = _load_event(db, parse_id(event_id))
    if event is None:
        raise HTTPException(status_code=404)
    if event.organizer_id != current.profile_id:
        raise HTTPException(status_code=403)

    organizer_name = event.organizer_name
    organizer_avatar = event.organizer_avatar
    apply_event_fields(event, body)
    event.organizer_id = current.profile_id
    event.organizer_name = organizer_name
    event.organizer_avatar = organizer_avatar
    db.commit()
    updated = _load_event(db, event.id)
    return event_to_dict(updated, current.profile_id)


@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    event = db.get(Event, parse_id(event_id))
    if event is None:
        raise HTTPException(status_code=404)
    if event.organizer_id != current.profile_id:
        raise HTTPException(status_code=403)
    db.delete(event)
    db.commit()
    return Response(status_code=204)


@router.post("/{event_id}/register")
def register_for_event(
    event_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = _load_event(db, parse_id(event_id))
    if event is None:
        raise HTTPException(status_code=404)
    if any(item.user_id == current.profile_id for item in event.registrations):
        raise HTTPException(status_code=409)
    if event.available_spots is not None and event.available_spots <= 0:
        raise HTTPException(status_code=400)

    registration = Registration(user_id=current.profile_id, event_id=event.id, registration_date=utcnow())
    event.registrations.append(registration)
    if event.available_spots is not None:
        event.available_spots -= 1
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409) from exc

    updated = _load_event(db, event.id)
    return event_to_dict(updated, current.profile_id)


@router.delete("/{event_id}/register")
def cancel_registration(
    event_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = _load_event(db, parse_id(event_id))
    if event is None:
        raise HTTPException(status_code=404)
    registration = next((item for item in event.registrations if item.user_id == current.profile_id), None)
    if registration is None:
        raise HTTPException(status_code=404)
    db.delete(registration)
    if event.available_spots is not None:
        event.available_spots += 1
    db.commit()
    updated = _load_event(db, event.id)
    return event_to_dict(updated, current.profile_id)


@router.post("/{event_id}/image")
async def upload_image(
    event_id: str,
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = _load_event(db, parse_id(event_id))
    if event is None:
        raise HTTPException(status_code=404)
    if event.organizer_id != current.profile_id:
        raise HTTPException(status_code=403)
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    extension = Path(file.filename).suffix.lower()
    if extension not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: jpg, jpeg, png, gif, bmp.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    uploads = Path(get_settings().upload_dir) / "images" / "events"
    uploads.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4()}{extension}"
    (uploads / filename).write_bytes(payload)

    image_url = f"/images/events/{filename}"
    images = list(event.images or [])
    images.append(image_url)
    event.image = image_url
    event.images = images
    db.commit()
    updated = _load_event(db, event.id)
    return event_to_dict(updated, current.profile_id)


@router.get("/{event_id}/image")
def get_image(event_id: str, db: Session = Depends(get_db)) -> FileResponse:
    event = db.get(Event, parse_id(event_id))
    if event is None or not event.image:
        raise HTTPException(status_code=404)

    relative = event.image.lstrip("/").replace("\\", "/")
    if relative.startswith("..") or not relative.startswith("images/events/"):
        raise HTTPException(status_code=404)
    full_path = Path(get_settings().upload_dir) / relative
    if not full_path.is_file():
        raise HTTPException(status_code=404)
    media_type = _CONTENT_TYPES.get(full_path.suffix.lower(), "application/octet-stream")
    return FileResponse(full_path, media_type=media_type)
