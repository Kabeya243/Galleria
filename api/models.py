from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    MetaData,
    String,
    Table,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


Table("User", Base.metadata, Column("id", String, primary_key=True))
Table("Exhibition", Base.metadata, Column("id", String, primary_key=True))


class Post(Base):
    __tablename__ = "Post"
    __table_args__ = (
        UniqueConstraint("exhibitionId", name="Post_exhibitionId_key"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    exhibitionId: Mapped[str] = mapped_column(
        String, ForeignKey("Exhibition.id", ondelete="CASCADE"), nullable=False
    )
    authorId: Mapped[str] = mapped_column(
        String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False
    )
    coverImageUrl: Mapped[str] = mapped_column(String, nullable=False)
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updatedAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    isVisible: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("true")
    )


class Like(Base):
    __tablename__ = "Like"
    __table_args__ = (
        UniqueConstraint("postId", "userId", name="Like_postId_userId_key"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True, default=lambda: str(uuid4()))
    postId: Mapped[str] = mapped_column(
        String, ForeignKey("Post.id", ondelete="CASCADE"), nullable=False
    )
    userId: Mapped[str] = mapped_column(
        String, ForeignKey("User.id", ondelete="CASCADE"), nullable=False
    )
    createdAt: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
