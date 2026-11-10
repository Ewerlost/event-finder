from datetime import timezone

from app.models import Event, Profile, Review
from app.schemas import EventBody, ProfileBody


def profile_to_dict(profile: Profile) -> dict:
    coordinates = None
    if not (profile.coordinate_x == 0 and profile.coordinate_y == 0):
        coordinates = [profile.coordinate_x, profile.coordinate_y]
    return {
        "id": profile.id,
        "userName": profile.user_name or "",
        "alias": profile.alias or "",
        "email": profile.email,
        "phone": profile.phone or "",
        "biography": profile.biography or "",
        "coordinates": coordinates,
        "address": profile.address,
        "avatarUrl": profile.avatar_url,
    }


def apply_profile(profile: Profile, body: ProfileBody) -> None:
    profile.user_name = body.user_name or ""
    profile.alias = body.alias or ""
    profile.phone = body.phone or ""
    profile.biography = body.biography or ""
    profile.address = body.address
    profile.avatar_url = body.avatar_url
    if body.coordinates is None:
        profile.coordinate_x = 0
        profile.coordinate_y = 0
    else:
        profile.coordinate_x = body.coordinates[0]
        profile.coordinate_y = body.coordinates[1]


def event_to_dict(event: Event, current_profile_id: str | None) -> dict:
    member_ids = {registration.user_id for registration in event.registrations}
    return {
        "id": event.id,
        "title": event.title,
        "description": event.description,
        "date": event.date,
        "time": event.time,
        "location": event.location,
        "address": event.address,
        "coordinates": list(event.coordinates or []),
        "category": event.category,
        "image": event.image,
        "images": event.images,
        "organizerId": event.organizer_id,
        "organizerName": event.organizer_name,
        "organizerAvatar": event.organizer_avatar,
        "availableSpots": event.available_spots,
        "totalSpots": event.total_spots,
        "status": getattr(event, "status", None) or "active",
        "amIMember": current_profile_id is not None and current_profile_id in member_ids,
    }


def apply_event_fields(event: Event, body: EventBody) -> None:
    event.title = body.title
    event.description = body.description
    event.date = body.date
    event.time = body.time
    event.location = body.location
    event.address = body.address
    event.coordinates = body.coordinates
    event.category = body.category
    event.image = body.image
    event.images = body.images
    event.available_spots = body.available_spots
    event.total_spots = body.total_spots


def review_to_dict(review: Review) -> dict:
    date = review.date
    if date.tzinfo is None:
        date_text = date.isoformat() + "Z"
    else:
        date_text = date.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    return {
        "id": review.id,
        "userId": review.user_id,
        "eventId": review.event_id,
        "userName": review.user_name or "",
        "userAvatar": review.user_avatar,
        "rating": review.rating,
        "comment": review.comment,
        "date": date_text,
    }


def display_name(profile: Profile) -> str:
    return profile.user_name or profile.alias or profile.email.split("@")[0]
