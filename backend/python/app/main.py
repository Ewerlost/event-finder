import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.config import get_settings
from app.database import Base, engine
from app.models import Account, ChatMember, ChatMessage, EmailToken, Event, Notification, OrganizerReview, Profile, Registration, Review, UserInterest, WaitlistEntry  # noqa: F401
from app.routers import auth, chat, events, notifications, organizer_reviews, recommendations, reviews, users

logger = logging.getLogger(__name__)


def _ensure_chat_columns() -> None:
    inspector = inspect(engine)
    if not inspector.has_table("chat_messages"):
        return
    names = {column["name"] for column in inspector.get_columns("chat_messages")}
    statements = []
    if "kind" not in names:
        statements.append("ALTER TABLE chat_messages ADD COLUMN kind VARCHAR(20) DEFAULT 'text'")
    if "image_path" not in names:
        statements.append("ALTER TABLE chat_messages ADD COLUMN image_path VARCHAR(500)")
    if not statements:
        return
    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    _ensure_chat_columns()
    uploads = Path(get_settings().upload_dir) / "images" / "events"
    uploads.mkdir(parents=True, exist_ok=True)
    (Path(get_settings().upload_dir) / "images" / "chat").mkdir(parents=True, exist_ok=True)
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
    app.include_router(recommendations.router)
    app.include_router(notifications.router)

    @app.get("/health")
    def health() -> dict:
        return {"status": "ok"}

    return app


app = create_app()
