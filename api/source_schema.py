"""Reflection of the live SANAA Prisma tables for the publication feed.

SANAA publication rule (Prisma schema, model Exhibition):
an exhibition is published for the feed only when BOTH hold:
    status == "public" AND visibility == "public".
A "public" exhibition with visibility "private-link" or "password" must
NEVER appear in the feed, neither via the publish webhook
(``ensure_published``) nor via the feed query (``published_filter``).

Legacy fallback: when the reflected Exhibition table has NO ``visibility``
column at all (the scaffold's SQLite test fixtures), the status alone
decides, accepting "public" or the scaffold's "published". In the real
SANAA database the ``visibility`` column always exists, so the fallback
never applies in production.
"""
from __future__ import annotations

import os
import re
from functools import lru_cache

from fastapi import HTTPException
from sqlalchemy import Boolean, DateTime, MetaData, String, Table, and_, cast, func, inspect, select
from sqlalchemy.engine import Engine
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session


_IDENTIFIER = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")

# Values a string status column may hold for a published exhibition.
# "published" is the scaffold's legacy value, only honoured when the
# Exhibition table has no visibility column (see module docstring).
_PUBLISHED_STATUS_VALUES = ("public", "published")


def _candidate(env_name: str, defaults: tuple[str, ...]) -> tuple[str, ...]:
    configured = os.getenv(env_name)
    names = (configured,) if configured else defaults
    if any(not name or not _IDENTIFIER.fullmatch(name) for name in names):
        raise HTTPException(status_code=503, detail="Invalid source schema configuration.")
    return names


def _existing_column(table: Table, names: tuple[str, ...]):
    return next((table.c[name] for name in names if name in table.c), None)


@lru_cache(maxsize=8)
def _reflect_sources(engine: Engine) -> tuple[Table, Table]:
    try:
        inspector = inspect(engine)
        if not inspector.has_table("Exhibition") or not inspector.has_table("User"):
            raise HTTPException(status_code=503, detail="SANAA source tables are unavailable.")
        metadata = MetaData()
        exhibition = Table("Exhibition", metadata, autoload_with=engine)
        user = Table("User", metadata, autoload_with=engine)
        return exhibition, user
    except HTTPException:
        raise
    except SQLAlchemyError as exc:
        raise HTTPException(status_code=503, detail="Could not read the SANAA source schema.") from exc


def get_sources(db: Session) -> tuple[Table, Table, dict[str, object]]:
    exhibition, user = _reflect_sources(db.get_bind())
    fields = {
        "exhibition_id": _existing_column(
            exhibition, _candidate("SANAA_EXHIBITION_ID_COLUMN", ("id",))
        ),
        "exhibition_title": _existing_column(
            exhibition, _candidate("SANAA_EXHIBITION_TITLE_COLUMN", ("title", "name"))
        ),
        "exhibition_slug": _existing_column(
            exhibition, _candidate("SANAA_EXHIBITION_SLUG_COLUMN", ("slug",))
        ),
        "exhibition_author": _existing_column(
            exhibition,
            # SANAA Prisma: Exhibition.ownerId -> User (not userId/authorId).
            _candidate("SANAA_EXHIBITION_AUTHOR_COLUMN", ("ownerId", "userId", "authorId", "artistId")),
        ),
        "exhibition_status": _existing_column(
            exhibition, _candidate("SANAA_EXHIBITION_STATUS_COLUMN", ("status", "published"))
        ),
        "exhibition_visibility": _existing_column(
            exhibition, _candidate("SANAA_EXHIBITION_VISIBILITY_COLUMN", ("visibility",))
        ),
        "user_id": _existing_column(user, _candidate("SANAA_USER_ID_COLUMN", ("id",))),
        "user_name": _existing_column(
            user, _candidate("SANAA_USER_NAME_COLUMN", ("name", "displayName", "username"))
        ),
        "user_avatar": _existing_column(
            user,
            _candidate(
                "SANAA_USER_AVATAR_COLUMN",
                ("avatarUrl", "imageUrl", "profileImageUrl", "image"),
            ),
        ),
    }
    if any(fields[key] is None for key in ("exhibition_id", "exhibition_title", "exhibition_slug", "user_id", "user_name")):
        raise HTTPException(
            status_code=503,
            detail="Configure SANAA source columns for the exhibition and artist fields.",
        )
    return exhibition, user, fields


def _status_is_published(status_column, value) -> bool:
    """Status half of the publication rule (visibility checked separately)."""
    if isinstance(status_column.type, Boolean):
        return value is True
    if isinstance(status_column.type, DateTime):
        return value is not None
    return str(value).casefold() in _PUBLISHED_STATUS_VALUES


def ensure_published(
    db: Session, exhibition: Table, fields: dict[str, object], exhibition_id: str
) -> None:
    status_column = fields["exhibition_status"]
    if status_column is None:
        raise HTTPException(
            status_code=503,
            detail="Configure SANAA_EXHIBITION_STATUS_COLUMN to verify publication state.",
        )
    visibility_column = fields.get("exhibition_visibility")
    columns = [status_column] + ([visibility_column] if visibility_column is not None else [])
    row = db.execute(
        select(*columns).where(fields["exhibition_id"] == exhibition_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Exhibition not found.")
    published = _status_is_published(status_column, row[0])
    if published and visibility_column is not None:
        # SANAA rule: status "public" alone is not enough — a "public"
        # exhibition with visibility "private-link" or "password" is not
        # listed, so it must not enter the feed either. When the visibility
        # column exists, the string status must be exactly "public"
        # (same rule as published_filter below).
        if not isinstance(status_column.type, (Boolean, DateTime)):
            published = str(row[0]).casefold() == "public"
        published = published and str(row[1]).casefold() == "public"
    if not published:
        raise HTTPException(status_code=409, detail="Exhibition is not published.")


def ensure_author_matches(
    db: Session, fields: dict[str, object], exhibition_id: str, author_id: str
) -> None:
    author_column = fields["exhibition_author"]
    if author_column is None:
        raise HTTPException(
            status_code=503,
            detail="Configure SANAA_EXHIBITION_AUTHOR_COLUMN to verify exhibition ownership.",
        )
    row = db.execute(
        select(author_column).where(fields["exhibition_id"] == exhibition_id)
    ).first()
    if row is None:
        raise HTTPException(status_code=404, detail="Exhibition not found.")
    if row[0] != author_id:
        raise HTTPException(status_code=403, detail="Exhibition author does not match.")


def published_filter(fields: dict[str, object]):
    status_column = fields["exhibition_status"]
    if status_column is None:
        raise HTTPException(
            status_code=503,
            detail="Configure SANAA_EXHIBITION_STATUS_COLUMN to verify publication state.",
        )
    if isinstance(status_column.type, Boolean):
        status_clause = status_column.is_(True)
    elif isinstance(status_column.type, DateTime):
        status_clause = status_column.is_not(None)
    else:
        status_clause = func.lower(cast(status_column, String)).in_(_PUBLISHED_STATUS_VALUES)
    visibility_column = fields.get("exhibition_visibility")
    if visibility_column is None:
        return status_clause
    # SANAA rule: only status "public" AND visibility "public" is listed.
    # ("published" is never a SANAA status value, so in production this
    # reduces to exactly status = "public" AND visibility = "public".)
    if isinstance(status_column.type, (Boolean, DateTime)):
        visibility_clause = func.lower(cast(visibility_column, String)) == "public"
        return and_(status_clause, visibility_clause)
    return and_(
        func.lower(cast(status_column, String)) == "public",
        func.lower(cast(visibility_column, String)) == "public",
    )
