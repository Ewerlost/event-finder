import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import Base, engine
from app.models import Account, ChatMember, ChatMessage, EmailToken, Event, OrganizerReview, Profile, Registration, Review  # noqa: F401
from app.routers import auth, chat, events, organizer_reviews, reviews, users

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    uploads = Path(get_settings().upload_dir) / "images" / "events"
    uploads.mkdir(parents=True, exist_ok=True)
    logger.info("Database schema is ready")
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(title="Event Finder API", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(auth.router)
    app.include_router(events.router)
    app.include_router(users.router)
    app.include_router(reviews.router)
    app.include_router(chat.router)
    app.include_router(organizer_reviews.router)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
