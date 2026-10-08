import { socketUrl } from "./api";
import type { ServerEvent } from "./types";

let socket: WebSocket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

/** Opens the realtime socket and reconnects automatically until disconnectSocket() is called. */
export function connectSocket(token: string, onEvent: (event: ServerEvent) => void) {
  const open = () => {
    const ws = new WebSocket(socketUrl(token));
    socket = ws;
    ws.onmessage = (msg) => onEvent(JSON.parse(msg.data));
    ws.onclose = () => {
      if (socket === ws) retryTimer = setTimeout(open, 2000);
    };
  };
  open();
}

export function disconnectSocket() {
  clearTimeout(retryTimer);
  const ws = socket;
  socket = null;
  ws?.close();
}

export function sendTyping(conversationId: number, isTyping: boolean) {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "typing", conversation_id: conversationId, is_typing: isTyping }));
  }
}
