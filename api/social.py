from __future__ import annotations

import base64
import binascii
from datetime import datetime, timezone
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
from sqlalchemy import and_, delete, exists, func, literal, or_, select
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


@router.get("/feed")
def read_feed(
    request: Request,
    cursor: str | None = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
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
