"""SANAA status/visibility tests (chantier 5/5, new — not in the scaffold).

The real SANAA rule: an exhibition reaches the feed only when
status == "public" AND visibility == "public". These tests cover both
halves of the enforcement:

- the publish webhook (ensure_published): wrong status/visibility -> 409
  and nothing appears in the feed;
- the feed query itself (published_filter): a Post row seeded directly
  for a non-listed exhibition must NOT appear in the feed.
"""
from datetime import datetime, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from api.models import Post
from conftest import feed_titles, publish


def test_publish_public_public_is_visible_in_feed(
    setup_api: tuple[TestClient, object],
) -> None:
    client, _ = setup_api
    response = publish(client, "exhibition-1")
    assert response.status_code == 200
    assert response.json()["published"] is True
    assert feed_titles(client) == ["Quiet Forms"]


def test_publish_public_private_link_rejected_and_invisible(
    setup_api: tuple[TestClient, object],
) -> None:
    client, engine = setup_api
    response = publish(client, "exhibition-private-link")
    assert response.status_code == 409
    with Session(engine) as db:
        assert db.scalar(select(Post.id)) is None
    assert feed_titles(client) == []


def test_publish_public_password_rejected_and_invisible(
    setup_api: tuple[TestClient, object],
) -> None:
    client, engine = setup_api
    response = publish(client, "exhibition-password")
    assert response.status_code == 409
    with Session(engine) as db:
        assert db.scalar(select(Post.id)) is None
    assert feed_titles(client) == []


def test_publish_draft_rejected_and_invisible(
    setup_api: tuple[TestClient, object],
) -> None:
    client, engine = setup_api
    response = publish(client, "exhibition-draft")
    assert response.status_code == 409
    with Session(engine) as db:
        assert db.scalar(select(Post.id)) is None
    assert feed_titles(client) == []


def test_publish_legacy_published_status_rejected(
    setup_api: tuple[TestClient, object],
) -> None:
    """The scaffold's "published" status is NOT a SANAA value: with a
    visibility column present, the webhook requires status exactly
    "public". Guards against the legacy fallback leaking into production."""
    client, engine = setup_api
    response = publish(client, "exhibition-legacy")
    assert response.status_code == 409
    with Session(engine) as db:
        assert db.scalar(select(Post.id)) is None
    assert feed_titles(client) == []


def test_seeded_post_for_private_link_exhibition_hidden_from_feed(
    setup_api: tuple[TestClient, object],
) -> None:
    """Feed filter test (not just the webhook): a Post row created
    directly for a public/private-link exhibition must not be listed."""
    client, engine = setup_api
    with Session(engine) as db:
        db.add(
            Post(
                id="post-hidden",
                exhibitionId="exhibition-private-link",
                authorId="artist-1",
                coverImageUrl="https://cdn.example/hidden.jpg",
                createdAt=datetime(2026, 1, 1, tzinfo=timezone.utc),
                updatedAt=datetime(2026, 1, 1, tzinfo=timezone.utc),
                isVisible=True,
            )
        )
        db.commit()
    assert feed_titles(client) == []


def test_seeded_post_for_draft_exhibition_hidden_from_feed(
    setup_api: tuple[TestClient, object],
) -> None:
    client, engine = setup_api
    with Session(engine) as db:
        db.add(
            Post(
                id="post-draft",
                exhibitionId="exhibition-draft",
                authorId="artist-1",
                coverImageUrl="https://cdn.example/draft.jpg",
                createdAt=datetime(2026, 1, 1, tzinfo=timezone.utc),
                updatedAt=datetime(2026, 1, 1, tzinfo=timezone.utc),
                isVisible=True,
            )
        )
        db.commit()
    assert feed_titles(client) == []


def test_feed_empty_when_no_posts(setup_api: tuple[TestClient, object]) -> None:
    """No Post rows at all -> empty feed, no fictitious data."""
    client, _ = setup_api
    response = client.get("/api/social/feed")
    assert response.status_code == 200
    assert response.json() == {"posts": [], "nextCursor": None}
