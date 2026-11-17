from datetime import date

import torch
from fastapi.testclient import TestClient

from features import IN_DIM, feature_vector
from model import Ranker


def test_feature_vector_marks_interest_and_closeness():
    today = date(2026, 11, 17)
    near = feature_vector(
        ["Музыка"],
        [],
        [53.9, 27.56],
        {
            "category": "Музыка",
            "date": "2026-11-20",
            "coordinates": [53.91, 27.57],
            "registrationCount": 4,
        },
        today,
    )
    far = feature_vector(
        ["Музыка"],
        [],
        [53.9, 27.56],
        {
            "category": "Спорт",
            "date": "2026-11-20",
            "coordinates": [55.4, 27.56],
            "registrationCount": 0,
        },
        today,
    )
    assert len(near) == IN_DIM
    assert near[0] == 1.0
    assert far[0] == 0.0
    assert near[3] > far[3]
    assert near[5] > far[5]


def test_ranker_forward_shape():
    model = Ranker(IN_DIM)
    scores = model(torch.zeros(3, IN_DIM))
    assert scores.shape == (3,)


def test_service_puts_a_nearby_interest_first():
    from serve import app

    client = TestClient(app)
    health = client.get("/health")
    assert health.status_code == 200
    if health.json()["status"] != "ok":
        raise AssertionError("artifacts/ranker.pt is missing; run python train.py")

    response = client.post(
        "/rank",
        json={
            "userId": "user-1",
            "interests": ["Музыка"],
            "historyCategories": [],
            "origin": [53.9, 27.56],
            "candidates": [
                {
                    "id": "far",
                    "category": "Музыка",
                    "date": "2026-11-20",
                    "coordinates": [55.4, 27.56],
                    "registrationCount": 12,
                },
                {
                    "id": "near",
                    "category": "Музыка",
                    "date": "2026-11-20",
                    "coordinates": [53.905, 27.565],
                    "registrationCount": 1,
                },
                {
                    "id": "other",
                    "category": "Спорт",
                    "date": "2026-11-18",
                    "coordinates": [53.905, 27.565],
                    "registrationCount": 20,
                },
            ],
        },
    )
    assert response.status_code == 200
    assert response.json()["eventIds"][0] == "near"
