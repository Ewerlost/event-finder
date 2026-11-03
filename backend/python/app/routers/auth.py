import re
from datetime import timedelta

from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.emailer import reset_html, send_html_email, verification_html
from app.models import Account, EmailToken, Profile, is_expired, utcnow
from app.schemas import ForgotPasswordRequest, LoginRequest, RegisterRequest, ResetPasswordRequest
from app.security import (
    create_access_token,
    hash_password,
    hash_token,
    new_raw_token,
    verify_password,
)

router = APIRouter(prefix="/api/v1.0/auth", tags=["auth"])

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _normalize_email(email: str) -> str:
    return email.strip().lower()


def _frontend_link(path: str, raw_token: str) -> str:
    base = get_settings().frontend_url.rstrip("/")
    return f"{base}/{path}?token={raw_token}"


def _issue_token(account: Account) -> str | None:
    if not account.profile_id:
        return None
    return create_access_token(account.id, account.profile_id)


def _find_token(db: Session, raw_token: str, token_type: str) -> EmailToken | None:
    if not raw_token:
        return None
    return db.scalar(
        select(EmailToken).where(
            EmailToken.token_hash == hash_token(raw_token),
            EmailToken.token_type == token_type,
        )
    )


@router.post("/register")
def register(body: RegisterRequest, db: Session = Depends(get_db)) -> Response:
    email = _normalize_email(body.email)
    if not _EMAIL_RE.match(email) or len(body.password) < 6:
        return Response(status_code=400)

    existing = db.scalar(select(Account).where(Account.email == email))
    if existing is not None:
        return Response(status_code=409)

    account = Account(email=email, password_hash=hash_password(body.password))
    raw_token = new_raw_token()
    token = EmailToken(
        account=account,
        token_hash=hash_token(raw_token),
        token_type="verify",
        expires_at=utcnow() + timedelta(hours=24),
    )
    db.add(account)
    db.add(token)
    db.commit()

    link = _frontend_link("email-confirmation", raw_token)
    try:
        send_html_email(email, "Подтверждение email", verification_html(link), link)
    except Exception:
        db.delete(account)
        db.commit()
        return Response(status_code=400)

    return Response(status_code=200)


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)) -> Response:
    email = _normalize_email(body.email)
    account = db.scalar(select(Account).where(Account.email == email))
    if account is None:
        return Response(status_code=404)
    if not account.is_email_verified:
        return Response(status_code=403)
    if not verify_password(body.password, account.password_hash):
        return Response(status_code=401)
    token = _issue_token(account)
    if token is None:
        return Response(status_code=403)
    return JSONResponse({"token": token})


@router.get("/verify")
def verify_email(token: str, db: Session = Depends(get_db)) -> Response:
    email_token = _find_token(db, token, "verify")
    if email_token is None or email_token.account is None:
        return JSONResponse(status_code=400, content={"error": "token_invalid", "message": "token invalid"})
    if is_expired(email_token.expires_at):
        db.delete(email_token)
        db.commit()
        return JSONResponse(status_code=410, content={"error": "token_expired", "message": "token expired"})

    account = email_token.account
    if account.profile_id is None:
        local_part = account.email.split("@")[0]
        profile = Profile(email=account.email, user_name=local_part)
        db.add(profile)
        db.flush()
        account.profile_id = profile.id

    account.is_email_verified = True
    account.email_verified_at = utcnow()
    jwt_token = _issue_token(account)
    db.delete(email_token)
    db.commit()
    return JSONResponse({"token": jwt_token})


@router.post("/forgot-password")
def forgot_password(body: ForgotPasswordRequest, db: Session = Depends(get_db)) -> Response:
    email = _normalize_email(body.email)
    account = db.scalar(select(Account).where(Account.email == email))
    if account is None:
        return Response(status_code=404)

    raw_token = new_raw_token()
    token = EmailToken(
        account_id=account.id,
        token_hash=hash_token(raw_token),
        token_type="reset",
        expires_at=utcnow() + timedelta(hours=24),
    )
    db.add(token)
    db.commit()

    link = _frontend_link("reset-password", raw_token)
    try:
        send_html_email(account.email, "Сброс пароля", reset_html(link), link)
    except Exception:
        db.delete(token)
        db.commit()
        return Response(status_code=400)
    return Response(status_code=200)


@router.post("/reset-password")
def reset_password(body: ResetPasswordRequest, db: Session = Depends(get_db)) -> Response:
    if len(body.new_password) < 6:
        return JSONResponse(status_code=400, content={"error": "token_invalid", "message": "token invalid"})

    email_token = _find_token(db, body.token, "reset")
    if email_token is None or email_token.account is None:
        return JSONResponse(status_code=400, content={"error": "token_invalid", "message": "token invalid"})
    if is_expired(email_token.expires_at):
        db.delete(email_token)
        db.commit()
        return JSONResponse(status_code=410, content={"error": "token_expired", "message": "token expired"})

    account = email_token.account
    account.password_hash = hash_password(body.new_password)
    jwt_token = _issue_token(account)
    db.delete(email_token)
    db.commit()
    if jwt_token is None:
        return JSONResponse({"token": None})
    return JSONResponse({"token": jwt_token})
