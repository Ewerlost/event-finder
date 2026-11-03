from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import InvalidTokenError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Account
from app.security import decode_access_token

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass
class CurrentUser:
    account: Account
    profile_id: str


def parse_id(value: str) -> str:
    try:
        return str(UUID(value))
    except ValueError as exc:
        raise HTTPException(status_code=404) from exc


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> CurrentUser:
    if credentials is None or not credentials.credentials:
        raise HTTPException(status_code=401)
    try:
        payload = decode_access_token(credentials.credentials)
    except InvalidTokenError as exc:
        raise HTTPException(status_code=401) from exc

    profile_id = payload.get("profileId")
    account_id = payload.get("sub")
    if not profile_id or not account_id:
        raise HTTPException(status_code=401)

    account = db.scalar(select(Account).where(Account.id == str(account_id)))
    if account is None or account.profile_id != str(profile_id):
        raise HTTPException(status_code=401)
    return CurrentUser(account=account, profile_id=str(profile_id))
