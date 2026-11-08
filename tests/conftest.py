"""Shared fixtures for the publication-feed API tests.

SQLite in-memory + TestClient against the INTEGRATED FastAPI app
(api/index.py — the app Vercel serves, social router mounted at
/api/social), with the REAL Prisma-shaped source tables:

- "User" (id, name) — no avatarUrl column in Prisma.
- "Exhibition" (id, title, slug, ownerId, status, visibility).

Seeded exhibitions (all owned by artist-1):
- exhibition-1:           public / public        (listed in the feed)
- exhibition-private-link: public / private-link (never listed)
- exhibition-password:     public / password      (never listed)
- exhibition-draft:        draft  / public        (never listed)
- exhibition-legacy:       published / public     (scaffold legacy status;
                          rejected under the real rule, which requires
                          status exactly "public" when a visibility
                          column exists)
"""
from collections.abc import Iterator

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from api.database import get_db
from api.index import app
from api.models import Like, Post
from api.source_schema import _reflect_sources

SECRET = "test-session-secret-key-1234567890"
INTERNAL_KEY = "test-internal-key"

EXHIBITIONS: tuple[tuple[str, str, str, str, str], ...] = (
    ("exhibition-1", "Quiet Forms", "quiet-forms", "public", "public"),
    ("exhibition-private-link", "Hidden Link Show", "hidden-link-show", "public", "private-link"),
    ("exhibition-password", "Locked Show", "locked-show", "public", "password"),
    ("exhibition-draft", "Draft Show", "draft-show", "draft", "public"),
    ("exhibition-legacy", "Legacy Show", "legacy-show", "published", "public"),
)

INTERNAL_HEADERS = {"X-Sanaa-Internal-Key": INTERNAL_KEY}


@pytest.fixture
def setup_api(monkeypatch: pytest.MonkeyPatch) -> Iterator[tuple[TestClient, object]]:
    monkeypatch.setenv("SANAA_SESSION_SECRET", SECRET)
    monkeypatch.setenv("SOCIAL_INTERNAL_API_KEY", INTERNAL_KEY)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    event.listen(
        engine,
        "connect",
        lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"),
    )
    with engine.begin() as connection:
        connection.exec_driver_sql(
            'CREATE TABLE "User" (id TEXT PRIMARY KEY, name TEXT NOT NULL)'
        )
        connection.exec_driver_sql(
            'CREATE TABLE "Exhibition" (id TEXT PRIMARY KEY, title TEXT NOT NULL, '
            'slug TEXT NOT NULL, ownerId TEXT NOT NULL, '
            'status TEXT NOT NULL, visibility TEXT NOT NULL)'
        )
        connection.exec_driver_sql(
            'INSERT INTO "User" (id, name) VALUES (\'artist-1\', \'Awa K.\')'
        )
        for exhibition_id, title, slug, status, visibility in EXHIBITIONS:
            connection.exec_driver_sql(
                'INSERT INTO "Exhibition" (id, title, slug, ownerId, status, visibility) '
                "VALUES (:id, :title, :slug, 'artist-1', :status, :visibility)",
                {
                    "id": exhibition_id,
                    "title": title,
                    "slug": slug,
                    "status": status,
                    "visibility": visibility,
                },
            )
    Post.__table__.create(engine)
    Like.__table__.create(engine)
    _reflect_sources.cache_clear()

    def override_get_db() -> Iterator[Session]:
        with Session(engine, expire_on_commit=False) as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client, engine
    app.dependency_overrides.clear()
    _reflect_sources.cache_clear()
    engine.dispose()


def session_cookie() -> str:
    return jwt.encode({"userId": "artist-1"}, SECRET, algorithm="HS256")


def publish_payload(
    exhibition_id: str = "exhibition-1",
    cover: str = "https://cdn.example/quiet-forms.jpg",
) -> dict[str, str]:
    return {
        "exhibitionId": exhibition_id,
        "authorId": "artist-1",
        "coverImageUrl": cover,
    }


def publish(client: TestClient, exhibition_id: str = "exhibition-1"):
    return client.post(
        "/api/social/internal/exhibition-published",
        json=publish_payload(exhibition_id),
        headers=INTERNAL_HEADERS,
    )


def feed_titles(client: TestClient) -> list[str]:
    response = client.get("/api/social/feed")
    assert response.status_code == 200
    return [post["title"] for post in response.json()["posts"]]
