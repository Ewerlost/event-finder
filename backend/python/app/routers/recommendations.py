from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user
from app.models import Profile, UserInterest
from app.recommendations import recommend_for_user

router = APIRouter(prefix="/api/v1.0/recommendations", tags=["recommendations"])

ALLOWED_INTERESTS = {
    "Музыка",
    "Спорт",
    "Искусство",
    "Бизнес",
    "Технологии",
    "Образование",
    "Развлечения",
    "Еда и напитки",
    "Природа",
    "Другое",
}


class InterestsBody(BaseModel):
    interests: list[str]


@router.get("")
def get_recommendations(
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    profile = db.get(Profile, current.profile_id)
    origin = None
    if profile is not None and not (profile.coordinate_x == 0 and profile.coordinate_y == 0):
        origin = (profile.coordinate_x, profile.coordinate_y)
    return recommend_for_user(db, current.profile_id, origin)


@router.put("/interests")
def save_interests(
    body: InterestsBody,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    cleaned = []
    for interest in body.interests:
        value = interest.strip()
        if value in ALLOWED_INTERESTS and value not in cleaned:
            cleaned.append(value)
    db.execute(delete(UserInterest).where(UserInterest.profile_id == current.profile_id))
    db.add_all(UserInterest(profile_id=current.profile_id, category=value) for value in cleaned)
    db.commit()
    saved = list(
        db.scalars(select(UserInterest.category).where(UserInterest.profile_id == current.profile_id)).all()
    )
    return {"interests": saved}
