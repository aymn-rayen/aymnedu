from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from app.core.config import settings

import re

db_url = settings.DATABASE_URL.strip() if settings.DATABASE_URL else ""
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql+psycopg2://", 1)
elif db_url.startswith("postgresql://") and not db_url.startswith("postgresql+"):
    db_url = db_url.replace("postgresql://", "postgresql+psycopg2://", 1)

# Remove channel_binding parameter if present (can cause issues with psycopg2 on some Linux environments)
if "channel_binding=" in db_url:
    db_url = re.sub(r"[?&]channel_binding=[^&]+", "", db_url)
    if "?" not in db_url and "&" in db_url:
        db_url = db_url.replace("&", "?", 1)

# Ensure sslmode=require for cloud PostgreSQL if not localhost
if "localhost" not in db_url and "127.0.0.1" not in db_url and "sslmode" not in db_url:
    sep = "&" if "?" in db_url else "?"
    db_url = f"{db_url}{sep}sslmode=require"

engine = create_engine(
    db_url,
    pool_pre_ping=True,
    pool_size=5,
    max_overflow=10,
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
