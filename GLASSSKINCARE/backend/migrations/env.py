"""Alembic env: uses backend.app.config for DATABASE_URL + imports all models."""
from logging.config import fileConfig
import sys
from pathlib import Path
from sqlalchemy import engine_from_config, pool
from alembic import context

# Add backend dir to path so 'app' package is importable
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.database import Base  # noqa: E402
# Register every model with Base.metadata so autogenerate sees the full schema.
# Add a new import here whenever a new model module is added under app/models/.
from app.models import (  # noqa: E402, F401
    user,
    skin_profile,
    product_embedding,
    ai_conversation,
    admin_action,
    theme_setting,
)

config = context.config
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL.replace("+asyncpg", ""))

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(url=url, target_metadata=target_metadata, literal_binds=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
