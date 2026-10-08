import { socketUrl } from "./api";
import type { ServerEvent } from "./types";

let socket: WebSocket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;

const UNAUTHORIZED = 4401; // close code the server uses for a rejected token

interface SocketHandlers {
  onEvent: (event: ServerEvent) => void;
  onReconnect: () => void; // events may have been missed while disconnected
  onUnauthorized: () => void;
}

/** Opens the realtime socket and reconnects automatically until disconnectSocket() is called. */
export function connectSocket(token: string, { onEvent, onReconnect, onUnauthorized }: SocketHandlers) {
  let connectedBefore = false;
  const open = () => {
    const ws = new WebSocket(socketUrl(token));
    socket = ws;
    ws.onopen = () => {
      if (connectedBefore) onReconnect();
      connectedBefore = true;
    };
    ws.onmessage = (msg) => onEvent(JSON.parse(msg.data));
    ws.onclose = (e) => {
      if (socket !== ws) return;
      if (e.code === UNAUTHORIZED) onUnauthorized();
      else retryTimer = setTimeout(open, 2000);
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
