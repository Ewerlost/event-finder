"""Синтетические люди и встречи вокруг Минска.

Метка «записался бы» зависит от произведения интереса и близости, а не от
отдельных слагаемых. Поэтому гладкая модель может обойти правила, которые
дают категории фиксированный бонус независимо от расстояния.
"""

from dataclasses import dataclass
import math
import random

from features import CATEGORIES, haversine_km

MINSK = (53.9006, 27.5590)


@dataclass
class SyntheticEvent:
    category: str
    day_offset: int
    coordinates: tuple[float, float]
    registration_count: int
    label: int


@dataclass
class SyntheticUser:
    interests: list[str]
    history: list[str]
    origin: tuple[float, float]
    travel_km: float
    events: list[SyntheticEvent]


def _offset_point(rng: random.Random, origin: tuple[float, float], sigma_km: float) -> tuple[float, float]:
    latitude, longitude = origin
    radius = sigma_km * math.sqrt(-2 * math.log(max(rng.random(), 1e-9)))
    angle = 2 * math.pi * rng.random()
    north_km = radius * math.cos(angle)
    east_km = radius * math.sin(angle)
    return (
        latitude + north_km / 111.0,
        longitude + east_km / (111.0 * math.cos(math.radians(latitude))),
    )


def generate_users(count: int, events_per_user: int, seed: int) -> list[SyntheticUser]:
    rng = random.Random(seed)
    users: list[SyntheticUser] = []
    for _ in range(count):
        interests = rng.sample(CATEGORIES, rng.randint(1, 4))
        history: list[str] = []
        if interests and rng.random() < 0.7:
            history = rng.sample(interests, rng.randint(1, len(interests)))
        liked = set(interests) | set(history)
        travel_km = rng.uniform(6.0, 16.0)
        origin = _offset_point(rng, MINSK, 6.0)
        events: list[SyntheticEvent] = []
        for _event in range(events_per_user):
            category = rng.choice(CATEGORIES)
            near_home = rng.random() < 0.3
            point = _offset_point(rng, origin if near_home else MINSK, 3.0 if near_home else 16.0)
            day_offset = rng.randint(0, 40)
            registration_count = min(int(rng.expovariate(1 / 5)), 40)
            distance = haversine_km(origin, point)
            match = 1.0 if category in liked else 0.0
            history_match = 1.0 if category in history else 0.0
            proximity = math.exp(-distance / travel_km)
            freshness = math.exp(-day_offset / 12.0)
            popularity = math.tanh(registration_count / 12.0)
            score = (
                1.45 * match * proximity
                + 0.35 * match * freshness
                + 0.2 * history_match * proximity
                + 0.15 * popularity * match
                + rng.gauss(0, 0.05)
            )
            events.append(
                SyntheticEvent(
                    category=category,
                    day_offset=day_offset,
                    coordinates=point,
                    registration_count=registration_count,
                    label=1 if score >= 0.8 else 0,
                )
            )
        users.append(
            SyntheticUser(
                interests=interests,
                history=history,
                origin=origin,
                travel_km=travel_km,
                events=events,
            )
        )
    return users
