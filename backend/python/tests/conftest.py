import os

os.environ["DATABASE_URL"] = "sqlite://"
os.environ["JWT_KEY"] = "test_secret_key_that_is_long_enough_for_hs256"
os.environ["JWT_ISSUER"] = "EventFinder.Api"
os.environ["JWT_AUDIENCE"] = "EventFinder.Client"
os.environ["MAILERSEND_API_TOKEN"] = ""
os.environ["FRONTEND_URL"] = "http://localhost:5173/#"
os.environ["UPLOAD_DIR"] = "tests/tmp-wwwroot"

import pytest
from fastapi.testclient import TestClient

from app import emailer
from app.database import Base, engine
from app.main import app


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    emailer.outbox.clear()
    with TestClient(app) as test_client:
        yield test_client


def _token_from_outbox() -> str:
    link = emailer.outbox[-1]["link"]
    return link.split("token=", 1)[1]


def _register_and_verify(client: TestClient, email: str, password: str = "Password1!") -> str:
    response = client.post(
        "/api/v1.0/auth/register",
        json={"email": email, "password": password, "isAtLeast16": True},
    )
    assert response.status_code == 200
    verified = client.get("/api/v1.0/auth/verify", params={"token": _token_from_outbox()})
    assert verified.status_code == 200
    body = verified.json()
    assert body["token"]
    return body["token"]


def _auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def _event_payload(**overrides) -> dict:
    payload = {
        "title": "Джаз в парке",
        "description": "Вечер на открытом воздухе",
        "date": "2026-12-01",
        "time": "19:00",
        "location": "Парк",
        "address": "Минск",
        "coordinates": [53.9, 27.56],
        "category": "music",
        "organizerId": "ignored",
        "organizerName": "ignored",
        "availableSpots": 2,
        "totalSpots": 2,
        "amIMember": False,
    }
    payload.update(overrides)
    return payload
