from collections import defaultdict
from collections.abc import Iterable

from fastapi import WebSocket


class ConnectionManager:
    """Tracks open WebSockets per user (a user may have several tabs/devices) and fans events out.

    State is in-process, which is fine for a single server instance.
    """

    def __init__(self) -> None:
        self._sockets: dict[int, set[WebSocket]] = defaultdict(set)

    async def connect(self, user_id: int, ws: WebSocket) -> None:
        await ws.accept()
        self._sockets[user_id].add(ws)

    def disconnect(self, user_id: int, ws: WebSocket) -> bool:
        """Returns True when the user has no sockets left, i.e. just went offline."""
        self._sockets[user_id].discard(ws)
        if self._sockets[user_id]:
            return False
        del self._sockets[user_id]
        return True

    def is_online(self, user_id: int) -> bool:
        return user_id in self._sockets

    def online_ids(self) -> list[int]:
        return list(self._sockets)

    async def send(self, user_ids: Iterable[int], event: dict) -> None:
        for user_id in user_ids:
            for ws in list(self._sockets.get(user_id, ())):
                try:
                    await ws.send_json(event)
                except RuntimeError:
                    pass  # socket closed mid-send; its own handler cleans it up

    async def broadcast(self, event: dict) -> None:
        await self.send(self.online_ids(), event)


manager = ConnectionManager()
