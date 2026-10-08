"""Conversation logic shared by the REST routers and the WebSocket endpoint."""

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import Conversation, Member, Message
from .realtime import manager
from .schemas import ConversationOut, MemberOut, MessageOut


def get_membership(db: Session, conversation_id: int, user_id: int) -> Member:
    member = db.get(Member, (conversation_id, user_id))
    if not member:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Conversation not found")
    return member


def require_group_admin(member: Member) -> None:
    if member.conversation.kind != "group" or member.role != "admin":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Only group admins can do that")


def member_ids(conversation: Conversation) -> list[int]:
    return [m.user_id for m in conversation.members]


def to_conversation_out(db: Session, conversation: Conversation, viewer_id: int) -> ConversationOut:
    """Serializes a conversation from one member's point of view (unread count differs per member)."""
    viewer = next(m for m in conversation.members if m.user_id == viewer_id)
    last_message = db.scalar(
        select(Message)
        .where(Message.conversation_id == conversation.id)
        .order_by(Message.id.desc())
        .limit(1)
    )
    unread_count = db.scalar(
        select(func.count(Message.id)).where(
            Message.conversation_id == conversation.id,
            Message.id > viewer.last_read_id,
            Message.sender_id != viewer_id,
        )
    )
    return ConversationOut(
        id=conversation.id,
        kind=conversation.kind,
        name=conversation.name,
        members=[MemberOut.model_validate(m) for m in conversation.members],
        last_message=MessageOut.model_validate(last_message) if last_message else None,
        unread_count=unread_count or 0,
        last_activity_at=conversation.last_activity_at,
    )


async def push_conversation(db: Session, conversation: Conversation) -> None:
    """Sends every member their own up-to-date view of the conversation."""
    for user_id in member_ids(conversation):
        out = to_conversation_out(db, conversation, user_id)
        await manager.send([user_id], {"type": "conversation", "conversation": out.model_dump(mode="json")})


def advance_receipts(member: Member, delivered_id: int = 0, read_id: int = 0) -> bool:
    """Moves a member's watermarks forward (never back). Reading implies delivery."""
    new_read = max(member.last_read_id, read_id)
    new_delivered = max(member.last_delivered_id, delivered_id, new_read)
    changed = (new_read, new_delivered) != (member.last_read_id, member.last_delivered_id)
    member.last_read_id, member.last_delivered_id = new_read, new_delivered
    return changed


async def push_receipt(member: Member) -> None:
    await manager.send(
        member_ids(member.conversation),
        {
            "type": "receipt",
            "conversation_id": member.conversation_id,
            "user_id": member.user_id,
            "last_delivered_id": member.last_delivered_id,
            "last_read_id": member.last_read_id,
        },
    )
