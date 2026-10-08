from datetime import datetime, timezone
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, PlainSerializer

# SQLite drops tzinfo, so every stored datetime is naive UTC; tag it as UTC on the way out.
UtcDatetime = Annotated[
    datetime,
    PlainSerializer(lambda d: d.replace(tzinfo=timezone.utc).isoformat(), return_type=str),
]
Phone = Annotated[str, Field(pattern=r"^\+?\d{7,15}$")]


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserOut(OrmModel):
    id: int
    phone: str
    display_name: str
    avatar_color: str
    about: str
    last_seen_at: UtcDatetime


class UserUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=60)
    avatar_color: str | None = Field(default=None, pattern=r"^#[0-9a-fA-F]{6}$")
    about: str | None = Field(default=None, max_length=140)


class VerifyIn(BaseModel):
    phone: Phone
    otp: str


class AuthOut(BaseModel):
    token: str
    user: UserOut
    needs_profile: bool


class ContactIn(BaseModel):
    phone: Phone


class MemberOut(OrmModel):
    user: UserOut
    role: str
    last_delivered_id: int
    last_read_id: int


class MessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)


class ReactionIn(BaseModel):
    emoji: str = Field(min_length=1, max_length=16)


class ReactionOut(OrmModel):
    user_id: int
    emoji: str


class MessageOut(OrmModel):
    id: int
    conversation_id: int
    sender_id: int
    body: str
    created_at: UtcDatetime
    reactions: list[ReactionOut] = []


class ConversationOut(BaseModel):
    id: int
    kind: str
    name: str | None
    members: list[MemberOut]
    last_message: MessageOut | None
    unread_count: int
    last_activity_at: UtcDatetime


class DirectIn(BaseModel):
    user_id: int


class GroupIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    member_ids: list[int] = Field(min_length=1)


class MembersIn(BaseModel):
    user_ids: list[int] = Field(min_length=1)


class ReadIn(BaseModel):
    message_id: int
