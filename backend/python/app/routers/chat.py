from datetime import datetime, timezone

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chat_access import as_utc, chat_access, visible_messages
from app.chat_hub import hub
from app.config import get_settings
from app.database import SessionLocal, get_db
from app.deps import CurrentUser, get_current_user, parse_id
from app.mappers import display_name
from app.models import Account, ChatMessage, Event, Profile
from app.security import decode_access_token

router = APIRouter(prefix="/api/v1.0", tags=["chat"])


def message_to_dict(message: ChatMessage) -> dict:
    created = as_utc(message.created_at)
    return {
        "id": message.id,
        "eventId": message.event_id,
        "authorId": message.author_id,
        "authorName": message.author_name,
        "authorIsOrganizer": message.author_is_organizer,
        "kind": message.kind or "text",
        "text": message.body,
        "hasImage": bool(message.image_path),
        "createdAt": created.isoformat().replace("+00:00", "Z"),
    }


def _account_from_token(db: Session, token: str) -> tuple[Account, str] | None:
    try:
        payload = decode_access_token(token)
    except InvalidTokenError:
        return None
    profile_id = payload.get("profileId")
    account_id = payload.get("sub")
    if not profile_id or not account_id:
        return None
    account = db.scalar(select(Account).where(Account.id == str(account_id)))
    if account is None or account.profile_id != str(profile_id):
        return None
    return account, str(profile_id)


def _save_message(
    db: Session,
    event: Event,
    profile: Profile,
    text: str,
    kind: str = "text",
    image_path: str | None = None,
) -> ChatMessage:
    message = ChatMessage(
        event_id=event.id,
        author_id=profile.id,
        author_name=display_name(profile),
        author_is_organizer=event.organizer_id == profile.id,
        body=text,
        kind=kind,
        image_path=image_path,
        created_at=datetime.now(timezone.utc),
    )
    db.add(message)
    db.commit()
    db.refresh(message)
    return message


@router.get("/chats")
def list_my_chats(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    from app.models import ChatMember

    event_ids = set(
        db.scalars(select(Event.id).where(Event.organizer_id == current.profile_id)).all()
    )
    event_ids.update(
        db.scalars(select(ChatMember.event_id).where(ChatMember.user_id == current.profile_id)).all()
    )
    if not event_ids:
        return []
    events = db.scalars(select(Event).where(Event.id.in_(event_ids)).order_by(Event.date, Event.time)).all()
    result = []
    for event in events:
        access, _left_at = chat_access(db, event, current.profile_id)
        if access == "none":
            continue
        result.append(
            {
                "eventId": event.id,
                "title": event.title,
                "date": event.date,
                "access": access,
            }
        )
    return result


@router.get("/events/{event_id}/chat")
def chat_state(
    event_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = db.get(Event, parse_id(event_id))
    if event is None:
        raise HTTPException(status_code=404)
    access, _left_at = chat_access(db, event, current.profile_id)
    if access == "none":
        raise HTTPException(status_code=403)
    _access, messages = visible_messages(db, event, current.profile_id)
    return {
        "eventId": event.id,
        "title": event.title,
        "access": access,
        "isOrganizer": event.organizer_id == current.profile_id,
        "messages": [message_to_dict(message) for message in messages],
    }


_CHAT_IMAGE_TYPES = {".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".gif": "image/gif", ".bmp": "image/bmp"}


@router.post("/events/{event_id}/chat/images")
async def upload_chat_image(
    event_id: str,
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = db.get(Event, parse_id(event_id))
    if event is None:
        raise HTTPException(status_code=404)
    profile = db.get(Profile, current.profile_id)
    if profile is None:
        raise HTTPException(status_code=401)
    access, _left_at = chat_access(db, event, profile.id)
    if access != "full":
        raise HTTPException(status_code=403)
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")
    extension = Path(file.filename).suffix.lower()
    if extension not in _CHAT_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Invalid file type.")
    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="No file uploaded.")
    folder = Path(get_settings().upload_dir) / "images" / "chat"
    folder.mkdir(parents=True, exist_ok=True)
    filename = f"{uuid4()}{extension}"
    (folder / filename).write_bytes(payload)
    message = _save_message(db, event, profile, "", kind="image", image_path=f"/images/chat/{filename}")
    await hub.broadcast(
        event.id,
        {"type": "message", "message": message_to_dict(message)},
        as_utc(message.created_at),
    )
    return message_to_dict(message)


@router.get("/events/{event_id}/chat/messages/{message_id}/image")
def get_chat_image(
    event_id: str,
    message_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> FileResponse:
    event = db.get(Event, parse_id(event_id))
    message = db.get(ChatMessage, parse_id(message_id))
    if event is None or message is None or message.event_id != event.id or not message.image_path:
        raise HTTPException(status_code=404)
    _access, visible = visible_messages(db, event, current.profile_id)
    if _access == "none" or all(item.id != message.id for item in visible):
        raise HTTPException(status_code=404)
    path = Path(get_settings().upload_dir) / message.image_path.lstrip("/")
    if not path.is_file():
        raise HTTPException(status_code=404)
    return FileResponse(path, media_type=_CHAT_IMAGE_TYPES.get(path.suffix.lower(), "application/octet-stream"))


@router.websocket("/events/{event_id}/chat/ws")
async def chat_socket(websocket: WebSocket, event_id: str, token: str = Query(...)) -> None:
    db = SessionLocal()
    accepted = False
    try:
        try:
            event_id = parse_id(event_id)
        except HTTPException:
            await websocket.close(code=4404)
            return
        identity = _account_from_token(db, token)
        event = db.get(Event, event_id)
        if identity is None or event is None:
            await websocket.close(code=4401 if identity is None else 4404)
            return
        _account, profile_id = identity
        access, left_at = chat_access(db, event, profile_id)
        if access == "none":
            await websocket.close(code=4403)
            return
        await hub.connect(event_id, websocket, {"user_id": profile_id, "left_at": left_at})
        accepted = True
        _access, messages = visible_messages(db, event, profile_id)
        await websocket.send_json(
            {
                "type": "history",
                "access": access,
                "messages": [message_to_dict(message) for message in messages],
            }
        )
        while True:
            incoming = await websocket.receive_json()
            kind = str(incoming.get("kind") or "text")
            if kind not in ("text", "announcement"):
                await websocket.send_json({"type": "error", "message": "Неизвестный тип сообщения"})
                continue
            if kind == "announcement" and event.organizer_id != profile_id:
                await websocket.send_json({"type": "error", "message": "Объявление может отправить только организатор"})
                continue
            text = str(incoming.get("text") or "").strip()
            if not text:
                await websocket.send_json({"type": "error", "message": "Пустое сообщение"})
                continue
            if len(text) > 2000:
                await websocket.send_json({"type": "error", "message": "Слишком длинное сообщение"})
                continue
            db.expire_all()
            event = db.get(Event, event_id)
            profile = db.get(Profile, profile_id)
            if event is None or profile is None:
                await websocket.close(code=4404)
                return
            access, left_at = chat_access(db, event, profile_id)
            hub.set_left_at(websocket, left_at)
            if access != "full":
                await websocket.send_json({"type": "error", "message": "Сейчас можно только читать историю"})
                continue
            message = _save_message(db, event, profile, text, kind=kind)
            await hub.broadcast(
                event_id,
                {"type": "message", "message": message_to_dict(message)},
                as_utc(message.created_at),
            )
    except WebSocketDisconnect:
        pass
    finally:
        if accepted:
            hub.disconnect(event_id, websocket)
        db.close()
