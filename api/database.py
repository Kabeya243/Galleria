from collections.abc import Generator
import os

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker


def _database_url() -> str | None:
    value = os.getenv("DATABASE_URL")
    if value and value.startswith("postgres://"):
        return value.replace("postgres://", "postgresql+psycopg://", 1)
    if value and value.startswith("postgresql://"):
        return value.replace("postgresql://", "postgresql+psycopg://", 1)
    return value


def create_database_engine() -> Engine | None:
    url = _database_url()
    if not url:
        return None
    return create_engine(url, pool_pre_ping=True, pool_recycle=300)


engine = create_database_engine()
SessionFactory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False) if engine else None


def get_db() -> Generator[Session, None, None]:
    if SessionFactory is None:
        raise HTTPException(status_code=503, detail="Database is not configured.")
    db = SessionFactory()
    try:
        yield db
    finally:
        db.close()
