from datetime import datetime, timezone

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    phone: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(60), default="")
    avatar_color: Mapped[str] = mapped_column(String(9), default="#2c6bed")
    about: Mapped[str] = mapped_column(String(140), default="")
    last_seen_at: Mapped[datetime] = mapped_column(default=utcnow)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class AuthSession(Base):
    """An opaque bearer token issued at login; deleting the row logs the device out."""

    __tablename__ = "sessions"

    token: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    user: Mapped[User] = relationship()


class Contact(Base):
    """A one-directional address-book entry: owner has saved contact."""

    __tablename__ = "contacts"

    owner_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    contact_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    contact: Mapped[User] = relationship(foreign_keys=[contact_id])


class Conversation(Base):
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(10))  # "direct" | "group"
    name: Mapped[str | None] = mapped_column(String(80))  # groups only
    # "<low_user_id>:<high_user_id>" for direct chats, so the DB guarantees one chat per pair.
    direct_key: Mapped[str | None] = mapped_column(String(40), unique=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    last_activity_at: Mapped[datetime] = mapped_column(default=utcnow, index=True)

    members: Mapped[list["Member"]] = relationship(
        back_populates="conversation", cascade="all, delete-orphan"
    )


class Member(Base):
    """Membership plus per-member receipt watermarks.

    Instead of one receipt row per message per recipient, each member stores the highest
    message id delivered to / read by them. A message is "delivered"/"read" once every
    other member's watermark has reached its id.
    """

    __tablename__ = "conversation_members"

    conversation_id: Mapped[int] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), primary_key=True
    )
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    role: Mapped[str] = mapped_column(String(10), default="member")  # "admin" | "member"
    joined_at: Mapped[datetime] = mapped_column(default=utcnow)
    last_delivered_id: Mapped[int] = mapped_column(default=0)
    last_read_id: Mapped[int] = mapped_column(default=0)

    conversation: Mapped[Conversation] = relationship(back_populates="members")
    user: Mapped[User] = relationship(lazy="joined")


class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (Index("ix_messages_conversation_id_id", "conversation_id", "id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    conversation_id: Mapped[int] = mapped_column(ForeignKey("conversations.id", ondelete="CASCADE"))
    sender_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)

    # selectin: one extra query loads reactions for a whole page of messages
    reactions: Mapped[list["Reaction"]] = relationship(cascade="all, delete-orphan", lazy="selectin")


class Reaction(Base):
    """One emoji per user per message, as in Signal: reacting again replaces it."""

    __tablename__ = "reactions"

    message_id: Mapped[int] = mapped_column(ForeignKey("messages.id", ondelete="CASCADE"), primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    emoji: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
