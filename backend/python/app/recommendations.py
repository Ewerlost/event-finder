from datetime import date

import httpx
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.event_status import is_cancelled
from app.mappers import event_to_dict
from app.models import Event, Registration, UserInterest


def _parse_date(value: str) -> date | None:
    try:
        return date.fromisoformat(value[:10])
    except ValueError:
        return None


def _distance_km(origin: tuple[float, float], target: list[float]) -> float | None:
    if len(target) < 2:
        return None
    from math import atan2, cos, radians, sin, sqrt

    lat1, lon1 = radians(origin[0]), radians(origin[1])
    lat2, lon2 = radians(float(target[0])), radians(float(target[1]))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    haversine = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * atan2(sqrt(haversine), sqrt(1 - haversine))


def rule_rank(
    events: list[Event],
    interests: set[str],
    history: set[str],
    origin: tuple[float, float] | None,
) -> list[str]:
    today = date.today()
    scored: list[tuple[float, str]] = []
    for event in events:
        event_date = _parse_date(event.date)
        if event_date is not None and event_date < today:
            continue
        score = 0.0
        if event.category in interests:
            score += 5
        if event.category in history:
            score += 3
        if event_date is not None:
            score += max(0, 30 - (event_date - today).days) / 10
        if origin is not None:
            distance = _distance_km(origin, list(event.coordinates or []))
            if distance is not None and distance <= 15:
                score += 2
        scored.append((score, event.id))
    scored.sort(key=lambda item: item[0], reverse=True)
    return [event_id for _score, event_id in scored]


def model_rank(profile_id: str, interests: list[str], history: list[str], events: list[Event]) -> list[str] | None:
    settings = get_settings()
    if not settings.recommendation_model_url:
        return None
    payload = {
        "userId": profile_id,
        "interests": interests,
        "historyCategories": history,
        "candidates": [
            {
                "id": event.id,
                "title": event.title,
                "category": event.category,
                "date": event.date,
                "coordinates": list(event.coordinates or []),
            }
            for event in events
        ],
    }
    try:
        response = httpx.post(settings.recommendation_model_url, json=payload, timeout=2.0)
        response.raise_for_status()
        event_ids = response.json().get("eventIds")
    except (httpx.HTTPError, ValueError, TypeError):
        return None
    if not isinstance(event_ids, list):
        return None
    known = {event.id for event in events}
    return [str(event_id) for event_id in event_ids if str(event_id) in known]


def recommend_for_user(db: Session, profile_id: str, profile_coordinates: tuple[float, float] | None) -> dict:
    interests = list(
        db.scalars(select(UserInterest.category).where(UserInterest.profile_id == profile_id)).all()
    )
    registered_ids = set(
        db.scalars(select(Registration.event_id).where(Registration.user_id == profile_id)).all()
    )
    history = set(
        db.scalars(
            select(Event.category)
            .join(Registration, Registration.event_id == Event.id)
            .where(Registration.user_id == profile_id)
        ).all()
    )
    events = list(
        db.scalars(
            select(Event)
            .options(selectinload(Event.registrations))
            .where(Event.organizer_id != profile_id)
        ).all()
    )
    candidates = [
        event for event in events
        if event.id not in registered_ids and not is_cancelled(event)
    ]
    ranked_ids = model_rank(profile_id, interests, sorted(history), candidates)
    source = "model" if ranked_ids is not None else "rules"
    if ranked_ids is None:
        ranked_ids = rule_rank(candidates, set(interests), history, profile_coordinates)
    by_id = {event.id: event for event in candidates}
    chosen = [by_id[event_id] for event_id in ranked_ids if event_id in by_id][:6]
    return {
        "source": source,
        "interests": interests,
        "events": [event_to_dict(event, profile_id) for event in chosen],
    }
