from __future__ import annotations

import base64
import binascii
from datetime import datetime, timezone
from functools import lru_cache
import hmac
import json
import logging
import os
from urllib.parse import quote, urlsplit

import jwt
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from jwt import PyJWTError
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, field_validator, model_validator
from sqlalchemy import MetaData, Table, and_, delete, exists, func, inspect, literal, or_, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from api.database import get_db
from api.models import Like, Post
from api.source_schema import (
    ensure_author_matches,
    ensure_published,
    get_sources,
    published_filter,
)


logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/social")
PAGE_SIZE = 12


class PublishedExhibition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exhibitionId: str
    authorId: str
    coverImageUrl: AnyHttpUrl | None = None
    publishToFeed: bool = True

    @field_validator("coverImageUrl")
    @classmethod
    def require_https_cover(cls, value: AnyHttpUrl | None) -> AnyHttpUrl | None:
        if value is not None and value.scheme != "https":
            raise ValueError("Cover image URLs must use HTTPS.")
        return value

    @model_validator(mode="after")
    def require_cover_when_publishing(self) -> PublishedExhibition:
        if self.publishToFeed and self.coverImageUrl is None:
            raise ValueError("A cover image is required when publishing to the feed.")
        return self


class UnpublishedExhibition(BaseModel):
    model_config = ConfigDict(extra="forbid")

    exhibitionId: str


def _require_internal_key(request: Request) -> None:
    expected = os.getenv("SOCIAL_INTERNAL_API_KEY")
    if not expected:
        raise HTTPException(status_code=503, detail="Internal API key is not configured.")
    provided = request.headers.get("X-Sanaa-Internal-Key", "")
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(status_code=401, detail="Internal authorization required.")


def _decode_session(request: Request) -> str:
    token = request.cookies.get("sanaa_session")
    secret = os.getenv("SANAA_SESSION_SECRET")
    if not token or not secret:
        raise HTTPException(status_code=401, detail="A valid SANAA session is required.")
    try:
        claims = jwt.decode(token, secret, algorithms=["HS256"])
    except PyJWTError as exc:
        raise HTTPException(status_code=401, detail="A valid SANAA session is required.") from exc
    user_id = claims.get("userId") or claims.get("sub")
    if not isinstance(user_id, str) or not user_id:
        raise HTTPException(status_code=401, detail="A valid SANAA session is required.")
    return user_id


def _cursor_encode(created_at: datetime, post_id: str) -> str:
    if created_at.tzinfo is None:
        created_at = created_at.replace(tzinfo=timezone.utc)
    payload = json.dumps(
        {"createdAt": created_at.isoformat(), "id": post_id}, separators=(",", ":")
    ).encode()
    return base64.urlsafe_b64encode(payload).decode().rstrip("=")


def _cursor_decode(cursor: str) -> tuple[datetime, str]:
    try:
        raw = base64.urlsafe_b64decode(cursor + "=" * (-len(cursor) % 4))
        value = json.loads(raw)
        created_at = datetime.fromisoformat(value["createdAt"])
        post_id = value["id"]
        if created_at.tzinfo is None or not isinstance(post_id, str) or not post_id:
            raise ValueError("Invalid cursor values.")
        return created_at, post_id
    except (ValueError, UnicodeDecodeError, binascii.Error, KeyError, TypeError) as exc:
        raise HTTPException(status_code=400, detail="Invalid feed cursor.") from exc


def _user_exists(db: Session, user_id: str) -> bool:
    _, _, fields = get_sources(db)
    return db.scalar(
        select(fields["user_id"]).where(fields["user_id"] == user_id).limit(1)
    ) is not None


def _viewer_id(request: Request, db: Session) -> str | None:
    if not request.cookies.get("sanaa_session"):
        return None
    try:
        user_id = _decode_session(request)
    except HTTPException as exc:
        if exc.status_code == 401:
            return None
        raise
    if not _user_exists(db, user_id):
        return None
    return user_id


def _request_origin(request: Request) -> str:
    """Public origin of the incoming request (for absolute cover URLs)."""
    host = request.headers.get("host", "")
    if not host:
        return ""
    proto = request.headers.get("x-forwarded-proto", "")
    if not proto:
        proto = "http" if host.startswith(("localhost", "127.0.0.1")) else "https"
    return f"{proto}://{host}"


def _absolute_cover(raw: str | None, origin: str) -> str | None:
    """Cover URL as absolute HTTPS (same rule as the publish webhook)."""
    if not raw:
        return None
    if raw.startswith("https://"):
        return raw
    if raw.startswith("/") and origin:
        return f"{origin}{raw}"
    return None


@lru_cache(maxsize=8)
def _reflect_artwork_cached(engine):
    """Reflected Artwork table (first artwork image = feed cover).
    Autoloads directly instead of gating on has_table, which can
    report False under a restricted search_path even when the table
    is readable. Raises on failure: lru_cache does not cache
    exceptions, so a transient failure at cold start does not poison
    later reads on the same instance (see _reflect_artwork)."""
    metadata = MetaData()
    return Table("Artwork", metadata, autoload_with=engine)


def _reflect_artwork(engine):
    """Reflected Artwork table, or None when it cannot be read.
    A failure returns None and the caller skips the cover lookup;
    the failure is not cached, so the next request retries."""
    try:
        return _reflect_artwork_cached(engine)
    except SQLAlchemyError:
        return None


def _reconcile_feed_posts(db: Session, request: Request) -> None:
    """Self-healing feed: create a Post for every public exhibition
    that has a cover image but no Post row yet. The publish webhook
    is the fast path, but it is fail-soft (missing key, timeout, cold
    start), so a public exhibition could otherwise never reach the
    feed and /feed would stay empty. Idempotent, and never raises:
    a failure is logged and the feed still renders from the Post
    rows that exist."""
    try:
        exhibition, _user, fields = get_sources(db)
        origin = _request_origin(request)
        id_col = fields["exhibition_id"]
        owner_col = fields["exhibition_author"]
        published_at_col = exhibition.c.get("publishedAt")
        columns = [id_col, owner_col]
        if published_at_col is not None:
            columns.append(published_at_col)
        public_rows = db.execute(select(*columns).where(published_filter(fields))).all()
        if not public_rows:
            return
        existing = {row[0] for row in db.execute(select(Post.exhibitionId)).all()}
        missing = [row[0] for row in public_rows if row[0] not in existing]
        if not missing:
            # Nothing to heal: skip the Artwork reflection and the
            # cover scan entirely, so a warm feed read stays cheap.
            return
        artwork_table = _reflect_artwork(db.get_bind())
        if artwork_table is None:
            return
        img_col = artwork_table.c.get("imageUrl")
        exh_col = artwork_table.c.get("exhibitionId")
        created_col = artwork_table.c.get("createdAt")
        if img_col is None or exh_col is None:
            return
        order = [exh_col]
        if created_col is not None:
            order.append(created_col.asc())
        art_rows = db.execute(
            select(exh_col, img_col)
            .where(img_col.is_not(None), exh_col.in_(missing))
            .order_by(*order)
        ).all()
        cover_by_exhibition: dict[str, str] = {}
        for row in art_rows:
            if row[0] not in cover_by_exhibition and row[1]:
                cover_by_exhibition[row[0]] = row[1]
        to_create = []
        for row in public_rows:
            ex_id = row[0]
            if ex_id in existing:
                continue
            cover = _absolute_cover(cover_by_exhibition.get(ex_id), origin)
            if not cover:
                continue
            created_at = row[2] if len(row) > 2 and row[2] is not None else datetime.now(timezone.utc)
            to_create.append(
                Post(exhibitionId=ex_id, authorId=row[1], coverImageUrl=cover, isVisible=True, createdAt=created_at, updatedAt=created_at)
            )
        if to_create:
            db.add_all(to_create)
            try:
                db.commit()
            except IntegrityError:
                db.rollback()
    except Exception:
        logger.exception("Feed reconciliation failed; serving the feed from existing posts.")
        try:
            db.rollback()
        except Exception:
            pass


def _feed_posts_from_exhibitions(db: Session, request: Request, exhibition, user, fields) -> list[dict[str, object]]:
    """Fallback feed: derive posts from the public exhibitions
    themselves when the Post table has no rows for them (the publish
    webhook never ran, or the reconciliation missed). Creates the
    missing Post rows best-effort so likes keep working; when a row
    cannot be created the post still renders, with a synthetic id
    (liking it then fails cleanly instead of the feed staying empty).
    Never raises: a failure returns an empty list."""
    try:
        artwork_table = _reflect_artwork(db.get_bind())
        if artwork_table is None:
            return []
        origin = _request_origin(request)
        id_col = fields["exhibition_id"]
        owner_col = fields["exhibition_author"]
        title_col = fields["exhibition_title"]
        slug_col = fields["exhibition_slug"]
        published_at_col = exhibition.c.get("publishedAt")
        columns = [id_col, owner_col, title_col, slug_col]
        if published_at_col is not None:
            columns.append(published_at_col)
        public_rows = db.execute(select(*columns).where(published_filter(fields))).all()
        if not public_rows:
            return []
        public_ids = [row[0] for row in public_rows]
        img_col = artwork_table.c.get("imageUrl")
        exh_col = artwork_table.c.get("exhibitionId")
        created_col = artwork_table.c.get("createdAt")
        if img_col is None or exh_col is None:
            return []
        order = [exh_col]
        if created_col is not None:
            order.append(created_col.asc())
        art_rows = db.execute(
            select(exh_col, img_col)
            .where(img_col.is_not(None), exh_col.in_(public_ids))
            .order_by(*order)
        ).all()
        cover_by_exhibition: dict[str, str] = {}
        for row in art_rows:
            if row[0] not in cover_by_exhibition and row[1]:
                cover_by_exhibition[row[0]] = row[1]
        # Author names/avatars for the fallback posts.
        user_id_col = fields["user_id"]
        user_name_col = fields["user_name"]
        user_avatar_col = fields.get("user_avatar")
        author_cols = [user_id_col, user_name_col]
        if user_avatar_col is not None:
            author_cols.append(user_avatar_col)
        author_ids = {row[1] for row in public_rows}
        authors = {
            row[0]: row
            for row in db.execute(
                select(*author_cols).where(user_id_col.in_(author_ids))
            ).all()
        }
        existing_posts = {
            row[0]: row[1]
            for row in db.execute(
                select(Post.exhibitionId, Post.id).where(
                    Post.exhibitionId.in_(public_ids)
                )
            ).all()
        }
        posts: list[dict[str, object]] = []
        to_create = []
        for row in public_rows:
            ex_id = row[0]
            cover = _absolute_cover(cover_by_exhibition.get(ex_id), origin)
            if not cover:
                continue
            created_at = row[4] if len(row) > 4 and row[4] is not None else datetime.now(timezone.utc)
            author = authors.get(row[1])
            post_id = existing_posts.get(ex_id)
            if post_id is None:
                to_create.append(
                    Post(exhibitionId=ex_id, authorId=row[1], coverImageUrl=cover, isVisible=True, createdAt=created_at, updatedAt=created_at)
                )
            posts.append(
                {
                    "id": post_id if post_id is not None else f"exh:{ex_id}",
                    "exhibitionId": ex_id,
                    "coverImageUrl": cover,
                    "createdAt": created_at.isoformat() if hasattr(created_at, "isoformat") else str(created_at),
                    "title": row[2],
                    "slug": row[3],
                    "artist": {
                        "name": author[1] if author is not None else "",
                        "avatarUrl": author[2] if author is not None and len(author) > 2 else None,
                    },
                    "likeCount": 0,
                    "likedByMe": False,
                    "visitUrl": f"/exhibition/{quote(str(row[3]), safe='')}",
                }
            )
        if to_create:
            try:
                db.add_all(to_create)
                db.commit()
                # Swap the synthetic ids for the real Post ids.
                real_ids = {
                    row[0]: row[1]
                    for row in db.execute(
                        select(Post.exhibitionId, Post.id).where(
                            Post.exhibitionId.in_([p["exhibitionId"] for p in posts])
                        )
                    ).all()
                }
                for post in posts:
                    real = real_ids.get(str(post["exhibitionId"]))
                    if real is not None:
                        post["id"] = real
            except IntegrityError:
                db.rollback()
        posts.sort(key=lambda p: str(p["createdAt"]), reverse=True)
        return posts[:PAGE_SIZE]
    except Exception:
        logger.exception("Feed fallback failed; returning an empty feed.")
        try:
            db.rollback()
        except Exception:
            pass
        return []


def _complete_feed_posts(
    db: Session,
    request: Request,
    exhibition,
    user,
    fields,
    posts: list[dict[str, object]],
) -> list[dict[str, object]] | None:
    """Complete the first page with any covered public exhibition
    missing from the main query, or None when the feed is already
    complete (or the check cannot run). The main query only returns
    Post rows, so a missed reconciliation (webhook never ran, row
    deleted) would otherwise serve a partial feed indefinitely; the
    fallback derives the missing posts from the exhibitions
    themselves and creates their Post rows, so the next read is
    complete through the main query. Never raises."""
    try:
        artwork_table = _reflect_artwork(db.get_bind())
        if artwork_table is None:
            return None
        exh_col = artwork_table.c.get("exhibitionId")
        img_col = artwork_table.c.get("imageUrl")
        if exh_col is None or img_col is None:
            return None
        id_col = fields["exhibition_id"]
        covered = exists(
            select(1).where(and_(exh_col == id_col, img_col.is_not(None)))
        )
        covered_count = db.scalar(
            select(func.count(id_col)).where(published_filter(fields), covered)
        ) or 0
        if covered_count <= len(posts):
            return None
        fallback_posts = _feed_posts_from_exhibitions(db, request, exhibition, user, fields)
        if not fallback_posts:
            return None
        seen = {post["exhibitionId"] for post in posts}
        merged = [*posts, *(p for p in fallback_posts if p["exhibitionId"] not in seen)]
        merged.sort(key=lambda p: str(p["createdAt"]), reverse=True)
        return merged[:PAGE_SIZE]
    except Exception:
        logger.exception("Feed completion check failed; serving the posts already loaded.")
        try:
            db.rollback()
        except Exception:
            pass
        return None


@router.get("/feed")
def read_feed(
    request: Request,
    cursor: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    # Self-healing: a public exhibition reaches the feed through the
    # publish webhook, but that webhook is fail-soft (missing key,
    # timeout, cold start), so a public exhibition could otherwise
    # never get a Post row and the feed would stay empty. Reconcile
    # first: it only ever creates the missing rows and never raises.
    _reconcile_feed_posts(db, request)
    exhibition, user, fields = get_sources(db)
    title = fields["exhibition_title"]
    slug = fields["exhibition_slug"]
    artist_name = fields["user_name"]
    artist_avatar = fields["user_avatar"]
    user_id = _viewer_id(request, db)

    clauses = [Post.isVisible.is_(True)]
    clauses.append(published_filter(fields))
    if cursor:
        cursor_date, cursor_id = _cursor_decode(cursor)
        clauses.append(
            or_(Post.createdAt < cursor_date, and_(Post.createdAt == cursor_date, Post.id < cursor_id))
        )

    like_count = (
        select(func.count(Like.id))
        .where(Like.postId == Post.id)
        .correlate(Post)
        .scalar_subquery()
    )
    liked_by_viewer = (
        exists(
            select(Like.id).where(Like.postId == Post.id, Like.userId == user_id)
        )
        if user_id
        else literal(False)
    )
    query = (
        select(
            Post.id.label("id"),
            Post.exhibitionId.label("exhibitionId"),
            Post.coverImageUrl.label("coverImageUrl"),
            Post.createdAt.label("createdAt"),
            title.label("title"),
            slug.label("slug"),
            artist_name.label("artistName"),
            artist_avatar.label("artistAvatarUrl") if artist_avatar is not None else literal(None).label("artistAvatarUrl"),
            like_count.label("likeCount"),
            liked_by_viewer.label("likedByMe"),
        )
        .select_from(Post)
        .join(exhibition, exhibition.c.id == Post.exhibitionId)
        .join(user, user.c.id == Post.authorId)
        .where(*clauses)
        .order_by(Post.createdAt.desc(), Post.id.desc())
        .limit(PAGE_SIZE + 1)
    )
    rows = db.execute(query).mappings().all()
    if not rows:
        # The Post table has no rows for the public exhibitions (the
        # publish webhook never ran, or the reconciliation missed).
        # Derive the feed from the exhibitions themselves instead of
        # rendering an empty feed; the fallback also creates the
        # missing Post rows so likes keep working.
        fallback_posts = _feed_posts_from_exhibitions(db, request, exhibition, user, fields)
        if fallback_posts:
            return {"posts": fallback_posts, "nextCursor": None}
    has_more = len(rows) > PAGE_SIZE
    page_rows = rows[:PAGE_SIZE]
    posts = [
        {
            "id": row["id"],
            "exhibitionId": row["exhibitionId"],
            "coverImageUrl": row["coverImageUrl"],
            "createdAt": row["createdAt"].isoformat(),
            "title": row["title"],
            "slug": row["slug"],
            "artist": {"name": row["artistName"], "avatarUrl": row["artistAvatarUrl"]},
            "likeCount": row["likeCount"],
            "likedByMe": bool(row["likedByMe"]),
            "visitUrl": f"/exhibition/{quote(str(row['slug']), safe='')}",
        }
        for row in page_rows
    ]
    if not cursor and not has_more and posts:
        # First page, fully loaded from Post rows: if a covered public
        # exhibition still has no Post row, the list above is partial.
        # Complete it from the exhibitions themselves rather than
        # serving the partial list (see _complete_feed_posts).
        completed = _complete_feed_posts(db, request, exhibition, user, fields, posts)
        if completed is not None:
            posts = completed
    next_cursor = (
        _cursor_encode(page_rows[-1]["createdAt"], page_rows[-1]["id"])
        if has_more and page_rows
        else None
    )
    return {"posts": posts, "nextCursor": next_cursor}


@router.post("/internal/exhibition-published")
def publish_exhibition(
    payload: PublishedExhibition,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    _require_internal_key(request)
    exhibition, _, fields = get_sources(db)
    ensure_published(db, exhibition, fields, payload.exhibitionId)
    ensure_author_matches(db, fields, payload.exhibitionId, payload.authorId)
    if not _user_exists(db, payload.authorId):
        raise HTTPException(status_code=404, detail="Exhibition author not found.")

    post = db.scalar(select(Post).where(Post.exhibitionId == payload.exhibitionId))
    if not payload.publishToFeed:
        if post is not None:
            db.delete(post)
            db.commit()
        return {"id": None, "exhibitionId": payload.exhibitionId, "published": False}

    if payload.coverImageUrl is None:
        raise HTTPException(status_code=422, detail="A cover image is required.")
    if post is None:
        post = Post(
            exhibitionId=payload.exhibitionId,
            authorId=payload.authorId,
            coverImageUrl=str(payload.coverImageUrl),
            isVisible=True,
        )
        db.add(post)
    else:
        post.authorId = payload.authorId
        post.coverImageUrl = str(payload.coverImageUrl)
        post.isVisible = True
        post.updatedAt = datetime.now(timezone.utc)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        post = db.scalar(select(Post).where(Post.exhibitionId == payload.exhibitionId))
        if post is None:
            raise HTTPException(status_code=409, detail="Could not publish exhibition.") from exc
        post.authorId = payload.authorId
        post.coverImageUrl = str(payload.coverImageUrl)
        post.isVisible = True
        post.updatedAt = datetime.now(timezone.utc)
        db.commit()
    db.refresh(post)
    return {
        "id": post.id,
        "exhibitionId": post.exhibitionId,
        "published": True,
        "created": post.createdAt,
    }


@router.post("/internal/exhibition-unpublished", status_code=204)
def unpublish_exhibition(
    payload: UnpublishedExhibition,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    _require_internal_key(request)
    post = db.scalar(select(Post).where(Post.exhibitionId == payload.exhibitionId))
    if post is not None:
        db.delete(post)
        db.commit()
    return Response(status_code=204)


def _authenticated_user(request: Request, db: Session) -> str:
    user_id = _decode_session(request)
    origin = urlsplit(request.headers.get("origin", ""))
    host = request.headers.get("host", "")
    if not origin.scheme or origin.netloc.casefold() != host.casefold():
        raise HTTPException(status_code=403, detail="Same-origin request required.")
    if not _user_exists(db, user_id):
        raise HTTPException(status_code=401, detail="SANAA session user was not found.")
    return user_id


@router.post("/posts/{post_id}/like", status_code=201)
def like_post(
    post_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    user_id = _authenticated_user(request, db)
    post = db.scalar(select(Post).where(Post.id == post_id, Post.isVisible.is_(True)))
    if post is None:
        raise HTTPException(status_code=404, detail="Publication not found.")
    existing = db.scalar(
        select(Like.id).where(Like.postId == post_id, Like.userId == user_id)
    )
    if existing is not None:
        raise HTTPException(status_code=409, detail="You have already liked this publication.")
    db.add(Like(postId=post_id, userId=user_id))
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=409, detail="You have already liked this publication."
        ) from exc
    count = db.scalar(select(func.count(Like.id)).where(Like.postId == post_id)) or 0
    return {"postId": post_id, "likeCount": count, "likedByMe": True}


@router.delete("/posts/{post_id}/like", status_code=204)
def unlike_post(
    post_id: str,
    request: Request,
    db: Session = Depends(get_db),
) -> Response:
    user_id = _authenticated_user(request, db)
    post_exists = db.scalar(
        select(Post.id).where(Post.id == post_id, Post.isVisible.is_(True))
    )
    if post_exists is None:
        raise HTTPException(status_code=404, detail="Publication not found.")
    db.execute(delete(Like).where(Like.postId == post_id, Like.userId == user_id))
    db.commit()
    return Response(status_code=204)


app = FastAPI(title="SANAA publication feed", debug=False)
app.include_router(router)


@app.exception_handler(SQLAlchemyError)
def handle_database_error(_: Request, exc: SQLAlchemyError) -> JSONResponse:
    logger.exception("Social feed database operation failed.", exc_info=exc)
    return JSONResponse(status_code=503, content={"detail": "Database operation failed."})
