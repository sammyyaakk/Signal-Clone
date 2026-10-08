from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..database import get_db
from ..deps import get_current_user
from ..models import Conversation, Member, Message, Reaction, User
from ..realtime import manager
from ..schemas import (
    ConversationOut,
    DirectIn,
    GroupIn,
    MembersIn,
    MessageIn,
    MessageOut,
    ReactionIn,
    ReactionOut,
    ReadIn,
)
from ..services import (
    advance_receipts,
    get_membership,
    member_ids,
    push_conversation,
    push_receipt,
    require_group_admin,
    to_conversation_out,
)

router = APIRouter(prefix="/conversations", tags=["conversations"])


def _ensure_users_exist(db: Session, user_ids: set[int]) -> None:
    found = set(db.scalars(select(User.id).where(User.id.in_(user_ids))))
    if found != user_ids:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "One or more users do not exist")


@router.get("", response_model=list[ConversationOut])
def list_conversations(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    conversations = db.scalars(
        select(Conversation)
        .join(Member)
        .where(Member.user_id == user.id)
        .order_by(Conversation.last_activity_at.desc())
    )
    return [to_conversation_out(db, c, user.id) for c in conversations]


@router.post("/direct", response_model=ConversationOut)
def open_direct(body: DirectIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Returns the existing 1:1 chat with a user, creating it on first use."""
    if body.user_id == user.id:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "You can't message yourself")
    _ensure_users_exist(db, {body.user_id})
    key = ":".join(map(str, sorted((user.id, body.user_id))))
    conversation = db.scalar(select(Conversation).where(Conversation.direct_key == key))
    if not conversation:
        conversation = Conversation(
            kind="direct",
            direct_key=key,
            created_by=user.id,
            members=[Member(user_id=user.id), Member(user_id=body.user_id)],
        )
        db.add(conversation)
        db.commit()
    return to_conversation_out(db, conversation, user.id)


@router.post("/group", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
async def create_group(body: GroupIn, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    other_ids = set(body.member_ids) - {user.id}
    _ensure_users_exist(db, other_ids)
    conversation = Conversation(
        kind="group",
        name=body.name,
        created_by=user.id,
        members=[Member(user_id=user.id, role="admin"), *(Member(user_id=i) for i in other_ids)],
    )
    db.add(conversation)
    db.commit()
    await push_conversation(db, conversation)
    return to_conversation_out(db, conversation, user.id)


@router.get("/{conversation_id}/messages", response_model=list[MessageOut])
def list_messages(conversation_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    get_membership(db, conversation_id, user.id)
    return db.scalars(
        select(Message).where(Message.conversation_id == conversation_id).order_by(Message.id)
    ).all()


@router.post(
    "/{conversation_id}/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED
)
async def send_message(
    conversation_id: int,
    body: MessageIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    sender = get_membership(db, conversation_id, user.id)
    conversation = sender.conversation
    message = Message(conversation_id=conversation_id, sender_id=user.id, body=body.body)
    db.add(message)
    db.flush()
    conversation.last_activity_at = message.created_at
    advance_receipts(sender, read_id=message.id)
    # Recipients with an open socket get the message right now, so it counts as delivered to them.
    online = [m for m in conversation.members if m.user_id != user.id and manager.is_online(m.user_id)]
    for member in online:
        advance_receipts(member, delivered_id=message.id)
    db.commit()

    out = MessageOut.model_validate(message)
    await manager.send(member_ids(conversation), {"type": "message", "message": out.model_dump(mode="json")})
    for member in online:
        await push_receipt(member)
    return out


async def _react(db: Session, conversation_id: int, message_id: int, user: User, emoji: str | None):
    """Sets (emoji) or clears (None) the user's reaction and pushes the new list to members."""
    member = get_membership(db, conversation_id, user.id)
    message = db.get(Message, message_id)
    if not message or message.conversation_id != conversation_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Message not found")
    mine = next((r for r in message.reactions if r.user_id == user.id), None)
    if emoji is None:
        if mine:
            message.reactions.remove(mine)
    elif mine:
        mine.emoji = emoji
    else:
        message.reactions.append(Reaction(user_id=user.id, emoji=emoji))
    db.commit()

    reactions = [ReactionOut.model_validate(r) for r in message.reactions]
    await manager.send(
        member_ids(member.conversation),
        {
            "type": "reaction",
            "conversation_id": conversation_id,
            "message_id": message_id,
            "reactions": [r.model_dump() for r in reactions],
        },
    )
    return reactions


@router.put("/{conversation_id}/messages/{message_id}/reaction", response_model=list[ReactionOut])
async def set_reaction(
    conversation_id: int,
    message_id: int,
    body: ReactionIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await _react(db, conversation_id, message_id, user, body.emoji)


@router.delete("/{conversation_id}/messages/{message_id}/reaction", response_model=list[ReactionOut])
async def remove_reaction(
    conversation_id: int,
    message_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return await _react(db, conversation_id, message_id, user, None)


@router.post("/{conversation_id}/read", status_code=status.HTTP_204_NO_CONTENT)
async def mark_read(
    conversation_id: int,
    body: ReadIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    member = get_membership(db, conversation_id, user.id)
    if advance_receipts(member, read_id=body.message_id):
        db.commit()
        await push_receipt(member)


@router.post("/{conversation_id}/members", response_model=ConversationOut)
async def add_members(
    conversation_id: int,
    body: MembersIn,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    admin = get_membership(db, conversation_id, user.id)
    require_group_admin(admin)
    conversation = admin.conversation
    new_ids = set(body.user_ids) - set(member_ids(conversation))
    _ensure_users_exist(db, new_ids)
    conversation.members.extend(Member(user_id=i) for i in new_ids)
    db.commit()
    await push_conversation(db, conversation)
    return to_conversation_out(db, conversation, user.id)


@router.delete("/{conversation_id}/members/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_member(
    conversation_id: int,
    member_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Admins can remove anyone; any member can remove themselves (leave the group)."""
    me = get_membership(db, conversation_id, user.id)
    conversation = me.conversation
    if conversation.kind != "group":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Only groups have removable members")
    if member_id != user.id:
        require_group_admin(me)
    target = get_membership(db, conversation_id, member_id)
    conversation.members.remove(target)
    # A group must keep an admin: promote the longest-standing member if the last one left.
    remaining = conversation.members
    if remaining and not any(m.role == "admin" for m in remaining):
        min(remaining, key=lambda m: m.joined_at).role = "admin"
    db.commit()
    await manager.send([member_id], {"type": "conversation_removed", "conversation_id": conversation_id})
    await push_conversation(db, conversation)
