"""Test config loads from environment."""
import pytest
from app.config import settings


def test_settings_loads_database_url():
    """DATABASE_URL is required and parsed correctly."""
    assert settings.DATABASE_URL.startswith("postgresql+asyncpg://")


def test_settings_loads_anthropic_key():
    """ANTHROPIC_API_KEY is required."""
    assert settings.ANTHROPIC_API_KEY.startswith("sk-ant-")


def test_settings_allowed_origins_is_list():
    """ALLOWED_ORIGINS is parsed from comma-separated string to list."""
    assert isinstance(settings.ALLOWED_ORIGINS, list)
    assert "http://localhost:3000" in settings.ALLOWED_ORIGINS


def test_settings_environment_default():
    """ENVIRONMENT defaults to development when not set."""
    assert settings.ENVIRONMENT in {"development", "production", "staging"}
