"""Application settings, loaded from environment / .env via pydantic-settings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # App
    app_name: str = "storeAutoHide"
    env: str = "dev"

    # MongoDB
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_db: str = "storeautohide"

    # JWT (portal auth: sellers + admins)
    jwt_secret: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    # Flowdesk auth/device server (end-user identity + app usage)
    flowdesk_base_url: str = "https://flowdesk.hachitechsolution.com/api"
    flowdesk_service_token: str | None = None

    # Artifact storage (uploaded packages + extracted graphs)
    storage_dir: str = "var/storage"
    max_upload_bytes: int = 200 * 1024 * 1024

    # Empty mini-app template (a zipped packaged hideflow app, no workflow embedded).
    # Required to repackage downloads as .zip; unset ⇒ only graph downloads work.
    mini_app_template_path: str | None = None

    # Dev convenience: new sellers are approved on registration instead of waiting for an
    # admin. Leave off in production — it lets anyone publish to the store.
    seller_auto_approve: bool = False

    # Initial admin (seeded on startup if no admin exists)
    initial_admin_email: str | None = None
    initial_admin_password: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
