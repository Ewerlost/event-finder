from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, Request, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.deps import CurrentUser, get_current_user, parse_id
from app.mappers import apply_profile, profile_to_dict
from app.models import Account, Profile
from app.schemas import DeleteUserRequest, ProfileBody
from app.security import verify_password

router = APIRouter(prefix="/api/v1.0/users", tags=["users"])

_ALLOWED_EXTENSIONS = {".jpg", ".jpeg", ".png", ".gif", ".bmp"}
_CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".bmp": "image/bmp",
}


def _avatar_dir() -> Path:
    folder = Path(get_settings().upload_dir) / "images" / "avatars"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _avatar_file(profile: Profile) -> Path | None:
    if not profile.avatar_url or not profile.avatar_url.startswith("/images/avatars/"):
        return None
    relative = profile.avatar_url.lstrip("/").replace("\\", "/")
    path = Path(get_settings().upload_dir) / relative
    if not path.is_file():
        return None
    return path


def present_profile(profile: Profile, request: Request) -> dict:
    data = profile_to_dict(profile)
    path = _avatar_file(profile)
    if path is not None:
        base = str(request.base_url).rstrip("/")
        data["avatarUrl"] = f"{base}/api/v1.0/users/{profile.id}/avatar?v={int(path.stat().st_mtime)}"
    return data


@router.get("")
def list_users(
    request: Request,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    profiles = db.scalars(select(Profile).order_by(Profile.created_at)).all()
    return [present_profile(profile, request) for profile in profiles]


@router.get("/{user_id}")
def get_user(
    user_id: str,
    request: Request,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    profile = db.get(Profile, parse_id(user_id))
    if profile is None:
        raise HTTPException(status_code=404)
    return present_profile(profile, request)


@router.post("", status_code=201)
def create_user(
    body: ProfileBody,
    request: Request,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    email = body.email.strip().lower()
    if db.scalar(select(Profile).where(Profile.email == email)) is not None:
        raise HTTPException(status_code=409)
    profile = Profile(email=email)
    apply_profile(profile, body)
    profile.email = email
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return present_profile(profile, request)


@router.put("/{user_id}")
def update_user(
    user_id: str,
    body: ProfileBody,
    request: Request,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    user_id = parse_id(user_id)
    if user_id != current.profile_id:
        raise HTTPException(status_code=403)
    profile = db.get(Profile, user_id)
    if profile is None:
        raise HTTPException(status_code=404)

    email = body.email.strip().lower()
    taken = db.scalar(select(Profile).where(Profile.email == email, Profile.id != profile.id))
    if taken is not None:
        raise HTTPException(status_code=409)

    saved_avatar = profile.avatar_url
    apply_profile(profile, body)
    profile.avatar_url = saved_avatar
    profile.email = email
    if current.account.email != email:
        current.account.email = email
    db.commit()
    db.refresh(profile)
    return present_profile(profile, request)


@router.post("/{user_id}/avatar")
async def upload_avatar(
    user_id: str,
    request: Request,
    file: UploadFile = File(...),
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    user_id = parse_id(user_id)
    if user_id != current.profile_id:
        raise HTTPException(status_code=403)
    profile = db.get(Profile, user_id)
    if profile is None:
        raise HTTPException(status_code=404)
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    extension = Path(file.filename).suffix.lower()
    if extension not in _ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: jpg, jpeg, png, gif, bmp.")

    payload = await file.read()
    if not payload:
        raise HTTPException(status_code=400, detail="No file uploaded.")

    folder = _avatar_dir()
    for old in folder.glob(f"{profile.id}.*"):
        old.unlink()
    filename = f"{profile.id}{extension}"
    (folder / filename).write_bytes(payload)
    profile.avatar_url = f"/images/avatars/{filename}"
    db.commit()
    db.refresh(profile)
    return present_profile(profile, request)


@router.get("/{user_id}/avatar")
def get_avatar(user_id: str, db: Session = Depends(get_db)) -> FileResponse:
    profile = db.get(Profile, parse_id(user_id))
    path = _avatar_file(profile) if profile is not None else None
    if path is None:
        raise HTTPException(status_code=404)
    media_type = _CONTENT_TYPES.get(path.suffix.lower(), "application/octet-stream")
    return FileResponse(path, media_type=media_type)


@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: str,
    body: DeleteUserRequest,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    user_id = parse_id(user_id)
    if user_id != current.profile_id:
        raise HTTPException(status_code=403)
    if not verify_password(body.password, current.account.password_hash):
        raise HTTPException(status_code=401)

    profile = db.get(Profile, user_id)
    account = db.get(Account, current.account.id)
    if profile is None or account is None:
        raise HTTPException(status_code=404)

    account.profile_id = None
    db.flush()
    db.delete(profile)
    db.delete(account)
    db.commit()
    return Response(status_code=204)
