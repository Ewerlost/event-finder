from fastapi.testclient import TestClient


def test_register_login_and_password_reset(client: TestClient):
    token = _register(client, "alex@example.com")
    profile_id = _profile_id(client, token)

    me = client.get(f"/api/v1.0/users/{profile_id}", headers=_headers(token))
    assert me.status_code == 200
    assert me.json()["email"] == "alex@example.com"
    assert me.json()["userName"] == "alex"

    duplicate = client.post(
        "/api/v1.0/auth/register",
        json={"email": "Alex@example.com", "password": "Password1!"},
    )
    assert duplicate.status_code == 409

    bad_email = client.post(
        "/api/v1.0/auth/register",
        json={"email": "not-an-email", "password": "Password1!"},
    )
    assert bad_email.status_code == 400

    missing = client.post("/api/v1.0/auth/login", json={"email": "none@example.com", "password": "Password1!"})
    assert missing.status_code == 404

    wrong = client.post("/api/v1.0/auth/login", json={"email": "alex@example.com", "password": "wrong-pass"})
    assert wrong.status_code == 401

    logged = client.post("/api/v1.0/auth/login", json={"email": "alex@example.com", "password": "Password1!"})
    assert logged.status_code == 200
    assert logged.json()["token"]

    pending = client.post(
        "/api/v1.0/auth/register",
        json={"email": "pending@example.com", "password": "Password1!"},
    )
    assert pending.status_code == 200
    forbidden = client.post(
        "/api/v1.0/auth/login",
        json={"email": "pending@example.com", "password": "Password1!"},
    )
    assert forbidden.status_code == 403

    forgot_missing = client.post("/api/v1.0/auth/forgot-password", json={"email": "ghost@example.com"})
    assert forgot_missing.status_code == 404

    forgot = client.post("/api/v1.0/auth/forgot-password", json={"email": "alex@example.com"})
    assert forgot.status_code == 200
    reset = client.post(
        "/api/v1.0/auth/reset-password",
        json={"token": _last_token(), "newPassword": "NewPassword1!"},
    )
    assert reset.status_code == 200
    assert reset.json()["token"]

    old_password = client.post(
        "/api/v1.0/auth/login",
        json={"email": "alex@example.com", "password": "Password1!"},
    )
    assert old_password.status_code == 401
    new_password = client.post(
        "/api/v1.0/auth/login",
        json={"email": "alex@example.com", "password": "NewPassword1!"},
    )
    assert new_password.status_code == 200


def test_events_reviews_and_profile(client: TestClient):
    owner = _register(client, "owner@example.com")
    guest = _register(client, "guest@example.com")
    owner_id = _profile_id(client, owner)

    created = client.post("/api/v1.0/events", json=_event(), headers=_headers(owner))
    assert created.status_code == 201
    event = created.json()
    assert event["organizerId"] == owner_id
    assert event["organizerName"] == "owner"
    assert event["amIMember"] is False
    assert event["availableSpots"] == 2
    event_id = event["id"]

    listed = client.get("/api/v1.0/events", headers=_headers(guest))
    assert listed.status_code == 200
    assert listed.json()[0]["id"] == event_id
    assert listed.json()[0]["amIMember"] is False

    anonymous = client.get("/api/v1.0/events")
    assert anonymous.status_code == 401

    registered = client.post(f"/api/v1.0/events/{event_id}/register", headers=_headers(guest))
    assert registered.status_code == 200
    assert registered.json()["amIMember"] is True
    assert registered.json()["availableSpots"] == 1

    again = client.post(f"/api/v1.0/events/{event_id}/register", headers=_headers(guest))
    assert again.status_code == 409

    mine = client.get("/api/v1.0/events/user/registered", headers=_headers(guest))
    assert [item["id"] for item in mine.json()] == [event_id]

    by_organizer = client.get(f"/api/v1.0/events/organizer/{owner_id}", headers=_headers(guest))
    assert by_organizer.status_code == 200
    assert len(by_organizer.json()) == 1

    forbidden_update = client.put(
        f"/api/v1.0/events/{event_id}",
        json=_event(title="Чужое"),
        headers=_headers(guest),
    )
    assert forbidden_update.status_code == 403

    updated = client.put(
        f"/api/v1.0/events/{event_id}",
        json=_event(title="Джаз вечером", availableSpots=1, totalSpots=2),
        headers=_headers(owner),
    )
    assert updated.status_code == 200
    assert updated.json()["title"] == "Джаз вечером"
    assert updated.json()["organizerId"] == owner_id

    full = client.post(f"/api/v1.0/events/{event_id}/register", headers=_headers(owner))
    assert full.status_code == 200
    assert full.json()["availableSpots"] == 0
    third = _register(client, "third@example.com")
    no_spots = client.post(f"/api/v1.0/events/{event_id}/register", headers=_headers(third))
    assert no_spots.status_code == 400

    cancelled = client.delete(f"/api/v1.0/events/{event_id}/register", headers=_headers(guest))
    assert cancelled.status_code == 200
    assert cancelled.json()["amIMember"] is False
    assert cancelled.json()["availableSpots"] == 1

    upload = client.post(
        f"/api/v1.0/events/{event_id}/image",
        headers=_headers(owner),
        files={"file": ("cover.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )
    assert upload.status_code == 200
    assert upload.json()["image"].startswith("/images/events/")
    assert upload.json()["image"] in upload.json()["images"]

    guest_upload = client.post(
        f"/api/v1.0/events/{event_id}/image",
        headers=_headers(guest),
        files={"file": ("cover.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )
    assert guest_upload.status_code == 403

    image = client.get(f"/api/v1.0/events/{event_id}/image")
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/png")

    bad_type = client.post(
        f"/api/v1.0/events/{event_id}/image",
        headers=_headers(owner),
        files={"file": ("notes.txt", b"hello", "text/plain")},
    )
    assert bad_type.status_code == 400

    review = client.post(
        "/api/v1.0/reviews",
        headers=_headers(guest),
        json={
            "userId": "spoofed",
            "eventId": event_id,
            "userName": "Гость",
            "rating": 5,
            "comment": "Отлично",
            "date": "2026-11-03T12:00:00.000Z",
        },
    )
    assert review.status_code == 201
    review_body = review.json()
    assert review_body["userId"] == _profile_id(client, guest)
    assert review_body["userName"] == "Гость"
    assert review_body["rating"] == 5

    organizer_reviews = client.get(f"/api/v1.0/reviews/organizer/{owner_id}", headers=_headers(owner))
    assert len(organizer_reviews.json()) == 1

    user_reviews = client.get(
        f"/api/v1.0/reviews/user/{review_body['userId']}",
        headers=_headers(owner),
    )
    assert len(user_reviews.json()) == 1

    stranger_edit = client.put(
        f"/api/v1.0/reviews/{review_body['id']}",
        headers=_headers(owner),
        json={
            "eventId": event_id,
            "userId": owner_id,
            "userName": "owner",
            "rating": 1,
            "comment": "нет",
            "date": "2026-11-03T12:00:00.000Z",
        },
    )
    assert stranger_edit.status_code == 403

    edited = client.put(
        f"/api/v1.0/reviews/{review_body['id']}",
        headers=_headers(guest),
        json={
            "eventId": event_id,
            "userId": review_body["userId"],
            "userName": "Гость",
            "rating": 4,
            "comment": "Хорошо",
            "date": "2026-11-03T12:30:00.000Z",
        },
    )
    assert edited.status_code == 200
    assert edited.json()["comment"] == "Хорошо"

    profile = client.put(
        f"/api/v1.0/users/{owner_id}",
        headers=_headers(owner),
        json={
            "id": owner_id,
            "userName": "Алексей",
            "alias": "alex",
            "email": "owner@example.com",
            "phone": "+375291112233",
            "biography": "Организую музыку",
            "coordinates": [53.9, 27.56],
            "address": "Минск",
            "avatarUrl": None,
        },
    )
    assert profile.status_code == 200
    assert profile.json()["userName"] == "Алексей"
    assert profile.json()["coordinates"] == [53.9, 27.56]

    other_profile = client.put(
        f"/api/v1.0/users/{owner_id}",
        headers=_headers(guest),
        json={
            "email": "owner@example.com",
            "userName": "взлом",
        },
    )
    assert other_profile.status_code == 403

    removed_review = client.delete(f"/api/v1.0/reviews/{review_body['id']}", headers=_headers(guest))
    assert removed_review.status_code == 204

    removed_event = client.delete(f"/api/v1.0/events/{event_id}", headers=_headers(owner))
    assert removed_event.status_code == 204
    missing_event = client.get(f"/api/v1.0/events/{event_id}", headers=_headers(owner))
    assert missing_event.status_code == 404

    bad_password = client.request(
        "DELETE",
        f"/api/v1.0/users/{_profile_id(client, guest)}",
        headers=_headers(guest),
        json={"password": "nope"},
    )
    assert bad_password.status_code == 401

    deleted = client.request(
        "DELETE",
        f"/api/v1.0/users/{_profile_id(client, guest)}",
        headers=_headers(guest),
        json={"password": "Password1!"},
    )
    assert deleted.status_code == 204
    gone = client.get(f"/api/v1.0/users/{_profile_id(client, guest)}", headers=_headers(owner))
    assert gone.status_code == 404


def test_upload_profile_avatar(client: TestClient):
    token = _register(client, "avatar@example.com")
    user_id = _profile_id(client, token)

    uploaded = client.post(
        f"/api/v1.0/users/{user_id}/avatar",
        headers=_headers(token),
        files={"file": ("face.png", b"\x89PNG\r\n\x1a\nfake", "image/png")},
    )
    assert uploaded.status_code == 200
    assert uploaded.json()["avatarUrl"].endswith(f"/api/v1.0/users/{user_id}/avatar") or "/avatar?v=" in uploaded.json()["avatarUrl"]

    image = client.get(f"/api/v1.0/users/{user_id}/avatar")
    assert image.status_code == 200
    assert image.headers["content-type"].startswith("image/png")

    kept = client.put(
        f"/api/v1.0/users/{user_id}",
        headers=_headers(token),
        json={
            "email": "avatar@example.com",
            "userName": "avatar",
            "avatarUrl": None,
        },
    )
    assert kept.status_code == 200
    assert "/avatar" in kept.json()["avatarUrl"]


def test_event_chat_keeps_history_after_leave(client: TestClient):
    owner = _register(client, "chat-owner@example.com")
    guest = _register(client, "chat-guest@example.com")
    created = client.post("/api/v1.0/events", json=_event(), headers=_headers(owner))
    event_id = created.json()["id"]

    assert client.get(f"/api/v1.0/events/{event_id}/chat", headers=_headers(guest)).status_code == 403

    with client.websocket_connect(f"/api/v1.0/events/{event_id}/chat/ws?token={owner}") as owner_socket:
        assert owner_socket.receive_json()["type"] == "history"
        owner_socket.send_json({"text": "Добро пожаловать"})
        welcome = owner_socket.receive_json()
        assert welcome["message"]["authorIsOrganizer"] is True

    assert client.post(f"/api/v1.0/events/{event_id}/register", headers=_headers(guest)).status_code == 200
    with client.websocket_connect(f"/api/v1.0/events/{event_id}/chat/ws?token={guest}") as guest_socket:
        history = guest_socket.receive_json()
        assert any(item["text"] == "Добро пожаловать" for item in history["messages"])
        guest_socket.send_json({"text": "Я буду"})
        assert guest_socket.receive_json()["message"]["text"] == "Я буду"

    assert client.delete(f"/api/v1.0/events/{event_id}/register", headers=_headers(guest)).status_code == 200
    with client.websocket_connect(f"/api/v1.0/events/{event_id}/chat/ws?token={owner}") as owner_socket:
        owner_socket.receive_json()
        owner_socket.send_json({"text": "После выхода"})
        assert owner_socket.receive_json()["message"]["text"] == "После выхода"

    with client.websocket_connect(f"/api/v1.0/events/{event_id}/chat/ws?token={guest}") as guest_socket:
        history = guest_socket.receive_json()
        texts = [item["text"] for item in history["messages"]]
        assert history["access"] == "history"
        assert "Я буду" in texts
        assert "После выхода" not in texts
        guest_socket.send_json({"text": "ещё раз"})
        assert guest_socket.receive_json()["type"] == "error"

    chats = client.get("/api/v1.0/chats", headers=_headers(guest))
    assert chats.status_code == 200
    assert chats.json()[0]["access"] == "history"


def _register(client: TestClient, email: str) -> str:
    from tests.conftest import _register_and_verify

    return _register_and_verify(client, email)


def _last_token() -> str:
    from tests.conftest import _token_from_outbox

    return _token_from_outbox()


def _headers(token: str) -> dict:
    from tests.conftest import _auth

    return _auth(token)


def _profile_id(client: TestClient, token: str) -> str:
    import jwt

    return jwt.decode(token, options={"verify_signature": False}, algorithms=["HS256"])["profileId"]


def _event(**overrides) -> dict:
    from tests.conftest import _event_payload

    return _event_payload(**overrides)
