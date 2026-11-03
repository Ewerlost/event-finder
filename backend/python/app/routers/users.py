from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user, parse_id
from app.mappers import apply_profile, profile_to_dict
from app.models import Account, Profile
from app.schemas import DeleteUserRequest, ProfileBody
from app.security import verify_password

router = APIRouter(prefix="/api/v1.0/users", tags=["users"])


@router.get("")
def list_users(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    profiles = db.scalars(select(Profile).order_by(Profile.created_at)).all()
    return [profile_to_dict(profile) for profile in profiles]


@router.get("/{user_id}")
def get_user(
    user_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    profile = db.get(Profile, parse_id(user_id))
    if profile is None:
        raise HTTPException(status_code=404)
    return profile_to_dict(profile)


@router.post("", status_code=201)
def create_user(
    body: ProfileBody,
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
    return profile_to_dict(profile)


@router.put("/{user_id}")
def update_user(
    user_id: str,
    body: ProfileBody,
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

    apply_profile(profile, body)
    profile.email = email
    if current.account.email != email:
        current.account.email = email
    db.commit()
    db.refresh(profile)
    return profile_to_dict(profile)


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
