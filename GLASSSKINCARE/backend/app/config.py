"""Pydantic settings loaded from backend/.env."""
from typing import List
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    DATABASE_URL: str
    REDIS_URL: str = "redis://localhost:6379/0"
    ENVIRONMENT: str = "development"
    ALLOWED_ORIGINS: str = "http://localhost:3000"

    ANTHROPIC_API_KEY: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_DAYS: int = 30

    SHOPIFY_STORE_DOMAIN: str = ""
    SHOPIFY_ADMIN_API_TOKEN: str = ""
    SHOPIFY_WEBHOOK_SECRET: str = ""
    PUBLIC_STOREFRONT_API_TOKEN: str = ""

    R2_ACCOUNT_ID: str = ""
    R2_ACCESS_KEY_ID: str = ""
    R2_SECRET_ACCESS_KEY: str = ""
    R2_BUCKET_NAME: str = ""
    R2_PUBLIC_URL: str = ""

    AI_CHALLENGE_SECRET: str = ""

    @property
    def allowed_origins_list(self) -> List[str]:
        """Parse comma-separated ALLOWED_ORIGINS into list."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


# Alias for backward compat with tests that import ALLOWED_ORIGINS directly
settings = Settings()
settings.ALLOWED_ORIGINS = settings.allowed_origins_list
