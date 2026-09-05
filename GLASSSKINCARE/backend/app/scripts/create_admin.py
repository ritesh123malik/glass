"""Create or update an admin user.

Usage:
    python -m app.scripts.create_admin [email] [password]
"""
from __future__ import annotations

import argparse
import asyncio
import getpass
import sys
from pathlib import Path

# Add parent to path so we can import app modules
sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from app.database import AsyncSessionLocal
from app.models.user import User
from app.services.password_service import hash_password


async def main(email: str, password: str) -> None:
    async with AsyncSessionLocal() as session:
        from sqlalchemy import select

        result = await session.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if user is None:
            user = User(email=email, is_admin=True, password_hash=hash_password(password))
            session.add(user)
            action = "Created"
        else:
            user.is_admin = True
            user.password_hash = hash_password(password)
            action = "Updated"

        await session.commit()
        print(f"{action} admin: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create or update an admin user")
    parser.add_argument("email", nargs="?", help="Admin email address (optional, will prompt if missing)")
    parser.add_argument("password", nargs="?", help="Admin password (optional, will prompt if missing)")
    args = parser.parse_args()

    email = args.email
    if not email:
        email = input("Admin email: ").strip()

    password = args.password
    if not password:
        password = getpass.getpass("Admin password: ")

    if not email or not password:
        print("Error: Email and password are required.")
        sys.exit(1)

    asyncio.run(main(email, password))
