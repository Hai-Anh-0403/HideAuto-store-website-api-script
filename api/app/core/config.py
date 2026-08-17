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

    # Mini-app licensing. The store signs a licence the packaged mini app checks on
    # launch; the private seed stays here, the public key travels inside the package.
    # Generate a pair with: uv run python scripts/gen_license_key.py
    license_signing_key: str | None = None  # base64 Ed25519 seed (32 bytes)
    # How long a licence stays valid without contacting the store again — this is the
    # buyer's offline grace period, and also how long a revoked key keeps working.
    license_ttl_days: int = 7
    # Public URL the packaged mini app calls back on. Baked into every package, so it
    # must be reachable from the buyer's machine (not localhost) in production.
    store_public_url: str = "http://localhost:8000"

    # Dev convenience: new sellers are approved on registration instead of waiting for an
    # admin. Leave off in production — it lets anyone publish to the store.
    seller_auto_approve: bool = False

    # Dev convenience: a fresh upload goes straight on the store instead of queueing for
    # review. An upload whose graph still carries embedded credentials is never
    # auto-published — that one still waits for an admin. Leave off in production.
    script_auto_publish: bool = False

    # Initial admin (seeded on startup if no admin exists)
    initial_admin_email: str | None = None
    initial_admin_password: str | None = None


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
