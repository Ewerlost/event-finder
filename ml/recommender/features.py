"""Признаки пары «человек — мероприятие» для обучения и выдачи.

Список категорий совпадает с ALLOWED_INTERESTS в API.
Вектор из 36 чисел:
0  совпадение с анкетой интересов
1  совпадение с категориями прошлых записей
2  свежесть даты: 1 сегодня, 0 через 30 дней и позже
3  близость exp(-км / 8); 0.5, если точка человека неизвестна
4  известна ли точка человека
5  популярность log1p(число записей) / log1p(40)
6:16   one-hot категории мероприятия
16:26  multi-hot интересов
26:36  multi-hot истории записей
"""

from datetime import date
from math import atan2, cos, exp, log1p, radians, sin, sqrt

CATEGORIES = [
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
]

IN_DIM = 6 + len(CATEGORIES) * 3
CATEGORY_INDEX = {name: index for index, name in enumerate(CATEGORIES)}
POPULARITY_SCALE = 40.0
PROXIMITY_KM = 8.0


def haversine_km(origin: tuple[float, float], target: tuple[float, float]) -> float:
    lat1, lon1 = radians(origin[0]), radians(origin[1])
    lat2, lon2 = radians(target[0]), radians(target[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    haversine = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlon / 2) ** 2
    return 6371 * 2 * atan2(sqrt(haversine), sqrt(1 - haversine))


def _as_pair(value) -> tuple[float, float] | None:
    if not isinstance(value, (list, tuple)) or len(value) < 2:
        return None
    try:
        latitude = float(value[0])
        longitude = float(value[1])
    except (TypeError, ValueError):
        return None
    if not (-90 <= latitude <= 90 and -180 <= longitude <= 180):
        return None
    return latitude, longitude


def days_until(value: str | None, today: date) -> int | None:
    if not value:
        return None
    try:
        parsed = date.fromisoformat(str(value)[:10])
    except ValueError:
        return None
    return (parsed - today).days


def _multi_hot(names: set[str]) -> list[float]:
    hot = [0.0] * len(CATEGORIES)
    for name in names:
        index = CATEGORY_INDEX.get(name)
        if index is not None:
            hot[index] = 1.0
    return hot


def feature_vector(
    interests: list[str],
    history: list[str],
    origin: list[float] | tuple[float, float] | None,
    candidate: dict,
    today: date | None = None,
) -> list[float]:
    today = today or date.today()
    category = str(candidate.get("category") or "")
    interest_set = {item for item in interests if item}
    history_set = {item for item in history if item}

    remaining = days_until(candidate.get("date"), today)
    if remaining is None:
        freshness = 0.5
    else:
        freshness = max(0.0, min(1.0, (30 - remaining) / 30))

    user_point = _as_pair(origin)
    event_point = _as_pair(candidate.get("coordinates"))
    if user_point is not None and event_point is not None:
        proximity = exp(-haversine_km(user_point, event_point) / PROXIMITY_KM)
        known = 1.0
    else:
        proximity = 0.5
        known = 0.0

    try:
        registrations = float(candidate.get("registrationCount") or 0)
    except (TypeError, ValueError):
        registrations = 0.0
    popularity = min(1.0, log1p(max(0.0, registrations)) / log1p(POPULARITY_SCALE))

    category_hot = [0.0] * len(CATEGORIES)
    index = CATEGORY_INDEX.get(category)
    if index is not None:
        category_hot[index] = 1.0

    return [
        1.0 if category in interest_set else 0.0,
        1.0 if category in history_set else 0.0,
        freshness,
        proximity,
        known,
        popularity,
        *category_hot,
        *_multi_hot(interest_set),
        *_multi_hot(history_set),
    ]
