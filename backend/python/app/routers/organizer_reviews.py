from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user, parse_id
from app.mappers import display_name
from app.models import Event, OrganizerReview, Profile

router = APIRouter(prefix="/api/v1.0/organizer-reviews", tags=["organizer-reviews"])


def review_to_dict(review: OrganizerReview) -> dict:
    date = review.date
    if date.tzinfo is None:
        date_text = date.isoformat() + "Z"
    else:
        date_text = date.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "id": review.id,
        "organizerId": review.organizer_id,
        "userId": review.user_id,
        "userName": review.user_name or "",
        "userAvatar": review.user_avatar,
        "rating": review.rating,
        "comment": review.comment,
        "date": date_text,
    }


@router.get("/organizer/{organizer_id}")
def list_for_organizer(
    organizer_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    organizer_id = parse_id(organizer_id)
    reviews = db.scalars(
        select(OrganizerReview)
        .where(OrganizerReview.organizer_id == organizer_id)
        .order_by(OrganizerReview.date.desc())
    ).all()
    return [review_to_dict(review) for review in reviews]


@router.post("", status_code=201)
def create_organizer_review(
    body: dict,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    organizer_id = body.get("organizerId")
    if not organizer_id:
        raise HTTPException(status_code=400)
    organizer_id = parse_id(str(organizer_id))
    if organizer_id == current.profile_id:
        raise HTTPException(status_code=403)
    organizer = db.get(Profile, organizer_id)
    if organizer is None:
        raise HTTPException(status_code=404)
    has_events = db.scalar(select(Event.id).where(Event.organizer_id == organizer_id))
    if has_events is None:
        raise HTTPException(status_code=400)
    author = db.get(Profile, current.profile_id)
    if author is None:
        raise HTTPException(status_code=401)
    rating = int(body.get("rating") or 0)
    if rating < 1 or rating > 5:
        raise HTTPException(status_code=400)
    review = OrganizerReview(
        organizer_id=organizer_id,
        user_id=author.id,
        user_name=display_name(author),
        user_avatar=f"/api/v1.0/users/{author.id}/avatar" if author.avatar_url else None,
        rating=rating,
        comment=str(body.get("comment") or ""),
        date=datetime.now(timezone.utc),
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=409) from exc
    db.refresh(review)
    return review_to_dict(review)


@router.delete("/{review_id}", status_code=204)
def delete_organizer_review(
    review_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    review = db.get(OrganizerReview, parse_id(review_id))
    if review is None:
        raise HTTPException(status_code=404)
    if review.user_id != current.profile_id:
        raise HTTPException(status_code=403)
    db.delete(review)
    db.commit()
    return Response(status_code=204)
