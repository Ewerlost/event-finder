from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = (
        "postgresql+psycopg://event_finder_user:event_finder_password@localhost:5432/event_finder_db"
    )
    jwt_key: str = "dev_only_change_me_please_use_a_long_secret_key"
    jwt_issuer: str = "EventFinder.Api"
    jwt_audience: str = "EventFinder.Client"
    jwt_expires_minutes: int = 5000
    frontend_url: str = "http://localhost:5173/#"
    cors_origins: str = (
        "http://localhost:5173,http://127.0.0.1:5173,https://alexthunder2005.github.io"
    )
    mailersend_api_token: str = ""
    mailersend_from_email: str = ""
    mailersend_from_name: str = "EventFinderTeam"
    upload_dir: str = "wwwroot"

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
