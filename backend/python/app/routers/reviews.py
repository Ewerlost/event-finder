from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import CurrentUser, get_current_user, parse_id
from app.mappers import display_name, review_to_dict
from app.models import Event, Profile, Review
from app.schemas import ReviewBody

router = APIRouter(prefix="/api/v1.0/reviews", tags=["reviews"])


def _parse_date(value: str | None) -> datetime:
    if not value:
        return datetime.now(timezone.utc)
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=timezone.utc)
    return parsed


def _author_name(profile: Profile, requested: str | None) -> str:
    if requested:
        return requested
    return display_name(profile)


@router.get("")
def list_reviews(
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    reviews = db.scalars(select(Review).order_by(Review.date.desc())).all()
    return [review_to_dict(review) for review in reviews]


@router.get("/user/{user_id}")
def list_by_user(
    user_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    user_id = parse_id(user_id)
    reviews = db.scalars(
        select(Review).where(Review.user_id == user_id).order_by(Review.date.desc())
    ).all()
    return [review_to_dict(review) for review in reviews]


@router.get("/organizer/{organizer_id}")
def list_by_organizer(
    organizer_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    organizer_id = parse_id(organizer_id)
    event_ids = db.scalars(select(Event.id).where(Event.organizer_id == organizer_id)).all()
    if not event_ids:
        return []
    reviews = db.scalars(
        select(Review).where(Review.event_id.in_(event_ids)).order_by(Review.date.desc())
    ).all()
    return [review_to_dict(review) for review in reviews]


@router.get("/event/{event_id}")
def list_by_event(
    event_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    event_id = parse_id(event_id)
    reviews = db.scalars(
        select(Review).where(Review.event_id == event_id).order_by(Review.date.desc())
    ).all()
    return [review_to_dict(review) for review in reviews]


@router.get("/{review_id}")
def get_review(
    review_id: str,
    _: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    review = db.get(Review, parse_id(review_id))
    if review is None:
        raise HTTPException(status_code=404)
    return review_to_dict(review)


@router.post("", status_code=201)
def create_review(
    body: ReviewBody,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    event = db.get(Event, parse_id(body.event_id))
    if event is None:
        raise HTTPException(status_code=404)
    profile = db.get(Profile, current.profile_id)
    if profile is None:
        raise HTTPException(status_code=401)

    review = Review(
        event_id=event.id,
        user_id=profile.id,
        user_name=_author_name(profile, body.user_name),
        user_avatar=body.user_avatar if body.user_avatar is not None else profile.avatar_url,
        rating=body.rating,
        comment=body.comment,
        date=_parse_date(body.date),
    )
    db.add(review)
    db.commit()
    db.refresh(review)
    return review_to_dict(review)


@router.put("/{review_id}")
def update_review(
    review_id: str,
    body: ReviewBody,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    review = db.get(Review, parse_id(review_id))
    if review is None:
        raise HTTPException(status_code=404)
    if review.user_id != current.profile_id:
        raise HTTPException(status_code=403)
    event = db.get(Event, parse_id(body.event_id))
    if event is None:
        raise HTTPException(status_code=404)

    profile = db.get(Profile, current.profile_id)
    review.event_id = event.id
    review.user_id = current.profile_id
    review.user_name = _author_name(profile, body.user_name) if profile else (body.user_name or "")
    review.user_avatar = body.user_avatar
    review.rating = body.rating
    review.comment = body.comment
    if body.date:
        review.date = _parse_date(body.date)
    db.commit()
    db.refresh(review)
    return review_to_dict(review)


@router.delete("/{review_id}", status_code=204)
def delete_review(
    review_id: str,
    current: CurrentUser = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> Response:
    review = db.get(Review, parse_id(review_id))
    if review is None:
        raise HTTPException(status_code=404)
    if review.user_id != current.profile_id:
        raise HTTPException(status_code=403)
    db.delete(review)
    db.commit()
    return Response(status_code=204)
