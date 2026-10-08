from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import func, select

from ..database import SessionLocal
from ..deps import user_from_token
from ..models import Member, Message, User, utcnow
from ..realtime import manager
from ..services import advance_receipts, member_ids, push_receipt

router = APIRouter(tags=["realtime"])


@router.websocket("/ws")
async def websocket_endpoint(ws: WebSocket, token: str):
    """One socket per client tab.

    Server -> client events: message, receipt, typing, presence, presence_snapshot,
    conversation, conversation_removed. Client -> server events: typing.
    """
    with SessionLocal() as db:
        user = user_from_token(db, token)
        if not user:
            await ws.close(code=4401)
            return
        user_id = user.id
        await manager.connect(user_id, ws)
        await ws.send_json({"type": "presence_snapshot", "online_ids": manager.online_ids()})
        await manager.broadcast({"type": "presence", "user_id": user_id, "online": True})
        await _deliver_pending(db, user_id)

    try:
        while True:
            event = await ws.receive_json()
            if event.get("type") == "typing":
                await _relay_typing(user_id, int(event["conversation_id"]), bool(event.get("is_typing")))
    except WebSocketDisconnect:
        pass
    finally:
        if manager.disconnect(user_id, ws):
            await _go_offline(user_id)


async def _deliver_pending(db, user_id: int) -> None:
    """A device coming online receives everything sent while it was away."""
    rows = db.execute(
        select(Member, func.max(Message.id))
        .join(Message, Message.conversation_id == Member.conversation_id)
        .where(Member.user_id == user_id)
        .group_by(Member.conversation_id, Member.user_id)
    ).all()
    changed = [member for member, latest_id in rows if advance_receipts(member, delivered_id=latest_id)]
    db.commit()
    for member in changed:
        await push_receipt(member)


async def _relay_typing(user_id: int, conversation_id: int, is_typing: bool) -> None:
    with SessionLocal() as db:
        member = db.get(Member, (conversation_id, user_id))
        if not member:
            return
        recipients = [i for i in member_ids(member.conversation) if i != user_id]
    await manager.send(
        recipients,
        {"type": "typing", "conversation_id": conversation_id, "user_id": user_id, "is_typing": is_typing},
    )


async def _go_offline(user_id: int) -> None:
    last_seen = utcnow()
    with SessionLocal() as db:
        db.get(User, user_id).last_seen_at = last_seen
        db.commit()
    await manager.broadcast(
        {"type": "presence", "user_id": user_id, "online": False, "last_seen_at": last_seen.isoformat()}
    )
