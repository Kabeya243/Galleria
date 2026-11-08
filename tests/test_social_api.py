"""The 7 scaffold tests, ported to the integrated app (api/index.py) and
the real Prisma schema.

Differences vs the scaffold original:
- app imported from api.index (the served app), not api.social's
  standalone scaffold app;
- fixture tables use ownerId / status "public" / visibility "public"
  (see conftest.py) — the scaffold's userId + status "published" do not
  exist in SANAA;
- the pagination test seeds exhibitions as public/public, because under
  the real rule the feed filter requires status "public" AND
  visibility "public".
"""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from api.models import Like, Post
from conftest import INTERNAL_HEADERS, publish, publish_payload, session_cookie


def test_internal_write_requires_key(setup_api: tuple[TestClient, object]) -> None:
    client, _ = setup_api
    response = client.post(
        "/api/social/internal/exhibition-published", json=publish_payload()
    )
    assert response.status_code == 401


def test_publish_is_idempotent_and_updates_cover(
    setup_api: tuple[TestClient, object],
) -> None:
    client, engine = setup_api
    first = publish(client)
    second_payload = publish_payload()
    second_payload["coverImageUrl"] = "https://cdn.example/updated-cover.jpg"
    second = client.post(
        "/api/social/internal/exhibition-published",
        json=second_payload,
        headers=INTERNAL_HEADERS,
    )
    assert first.status_code == 200
    assert second.status_code == 200
    with Session(engine) as db:
        rows = db.scalars(select(Post)).all()
        assert len(rows) == 1
        assert rows[0].coverImageUrl.endswith("updated-cover.jpg")


def test_like_requires_session_and_rejects_duplicate(
    setup_api: tuple[TestClient, object],
) -> None:
    client, engine = setup_api
    published = publish(client)
    post_id = published.json()["id"]

    assert client.post(f"/api/social/posts/{post_id}/like").status_code == 401
    client.cookies.set("sanaa_session", session_cookie())
    headers = {"Origin": "http://testserver"}
    liked = client.post(f"/api/social/posts/{post_id}/like", headers=headers)
    duplicate = client.post(f"/api/social/posts/{post_id}/like", headers=headers)

    assert liked.status_code == 201
    assert liked.json()["likeCount"] == 1
    assert duplicate.status_code == 409
    feed = client.get("/api/social/feed")
    assert feed.json()["posts"][0]["likedByMe"] is True
    assert feed.json()["posts"][0]["likeCount"] == 1
    unliked = client.delete(
        f"/api/social/posts/{post_id}/like", headers=headers
    )
    assert unliked.status_code == 204
    refreshed = client.get("/api/social/feed")
    assert refreshed.json()["posts"][0]["likedByMe"] is False
    assert refreshed.json()["posts"][0]["likeCount"] == 0
    with Session(engine) as db:
        assert len(db.scalars(select(Like)).all()) == 0


def test_like_rejects_cross_origin_write(
    setup_api: tuple[TestClient, object],
) -> None:
    client, _ = setup_api
    published = publish(client)
    client.cookies.set("sanaa_session", session_cookie())
    response = client.post(
        f"/api/social/posts/{published.json()['id']}/like",
        headers={"Origin": "https://attacker.example"},
    )
    assert response.status_code == 403


def test_unpublish_removes_publication(setup_api: tuple[TestClient, object]) -> None:
    client, engine = setup_api
    publish(client)
    response = client.post(
        "/api/social/internal/exhibition-unpublished",
        json={"exhibitionId": "exhibition-1"},
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 204
    with Session(engine) as db:
        assert db.scalar(select(Post.id)) is None


def test_artist_can_opt_out_of_feed(setup_api: tuple[TestClient, object]) -> None:
    client, engine = setup_api
    response = client.post(
        "/api/social/internal/exhibition-published",
        json={"exhibitionId": "exhibition-1", "authorId": "artist-1", "publishToFeed": False},
        headers=INTERNAL_HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["published"] is False
    with Session(engine) as db:
        assert db.scalar(select(Post.id)) is None


def test_feed_uses_twelve_item_cursor_pages(
    setup_api: tuple[TestClient, object],
) -> None:
    client, engine = setup_api
    with Session(engine) as db:
        for index in range(1, 13):
            db.execute(
                text(
                    'INSERT INTO "Exhibition" (id, title, slug, ownerId, status, visibility) '
                    "VALUES (:id, :title, :slug, 'artist-1', 'public', 'public')"
                ),
                {
                    "id": f"exhibition-{index:02}",
                    "title": f"Exhibition {index:02}",
                    "slug": f"exhibition-{index:02}",
                },
            )
        for index in range(13):
            db.add(
                Post(
                    id=f"post-{index:02}",
                    exhibitionId="exhibition-1" if index == 0 else f"exhibition-{index:02}",
                    authorId="artist-1",
                    coverImageUrl=f"https://cdn.example/{index}.jpg",
                    createdAt=datetime(2026, 1, 1, tzinfo=timezone.utc)
                    + timedelta(minutes=index),
                    updatedAt=datetime(2026, 1, 1, tzinfo=timezone.utc),
                    isVisible=True,
                )
            )
        db.commit()
    first = client.get("/api/social/feed")
    assert first.status_code == 200
    assert len(first.json()["posts"]) == 12
    assert first.json()["posts"][0]["title"] == "Exhibition 12"
    client.cookies.set("sanaa_session", "expired-or-invalid")
    assert client.get("/api/social/feed").status_code == 200
    second = client.get(
        "/api/social/feed", params={"cursor": first.json()["nextCursor"]}
    )
    assert second.status_code == 200
    assert len(second.json()["posts"]) == 1
    assert second.json()["posts"][0]["title"] == "Quiet Forms"
    assert set(post["id"] for post in first.json()["posts"]).isdisjoint(
        post["id"] for post in second.json()["posts"]
    )
