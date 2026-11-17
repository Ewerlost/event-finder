"""HTTP-обёртка ранжировщика.

Контракт тот же, которого ждёт API: POST и ответ {"eventIds": [...]}.
"""

from datetime import date
from pathlib import Path

import torch
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from features import IN_DIM, feature_vector
from model import Ranker

ARTIFACT = Path(__file__).with_name("artifacts") / "ranker.pt"


class Candidate(BaseModel):
    id: str
    title: str = ""
    category: str = ""
    date: str = ""
    coordinates: list[float] = Field(default_factory=list)
    registrationCount: int = 0


class RankRequest(BaseModel):
    userId: str = ""
    interests: list[str] = Field(default_factory=list)
    historyCategories: list[str] = Field(default_factory=list)
    origin: list[float] | None = None
    candidates: list[Candidate]


class RankResponse(BaseModel):
    eventIds: list[str]


def load_ranker() -> Ranker | None:
    if not ARTIFACT.exists():
        return None
    ranker = Ranker(IN_DIM)
    ranker.load_state_dict(torch.load(ARTIFACT, map_location="cpu", weights_only=True))
    ranker.eval()
    return ranker


ranker = load_ranker()
app = FastAPI(title="EventFinder ranker")


@app.get("/health")
def health() -> dict:
    return {"status": "ok" if ranker is not None else "unloaded"}


@app.post("/rank", response_model=RankResponse)
def rank(body: RankRequest) -> RankResponse:
    if ranker is None:
        raise HTTPException(status_code=503, detail="model is not loaded")
    if not body.candidates:
        return RankResponse(eventIds=[])
    today = date.today()
    vectors = [
        feature_vector(
            body.interests,
            body.historyCategories,
            body.origin,
            candidate.model_dump(),
            today,
        )
        for candidate in body.candidates
    ]
    with torch.no_grad():
        scores = ranker(torch.tensor(vectors, dtype=torch.float32)).tolist()
    order = sorted(range(len(scores)), key=lambda index: scores[index], reverse=True)
    return RankResponse(eventIds=[body.candidates[index].id for index in order])
