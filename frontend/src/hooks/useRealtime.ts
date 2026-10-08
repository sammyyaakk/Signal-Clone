import { useEffect } from "react";
import { api, tokenStore } from "@/lib/api";
import { conversationTitle } from "@/lib/format";
import { connectSocket, disconnectSocket } from "@/lib/socket";
import type { ServerEvent } from "@/lib/types";
import { SESSION_EXPIRED, useChat } from "@/store/chat";

const TYPING_TIMEOUT_MS = 5000;
const typingTimers = new Map<string, ReturnType<typeof setTimeout>>();

function handleEvent(event: ServerEvent) {
  const s = useChat.getState();
  switch (event.type) {
    case "message": {
      const { message } = event;
      const conversation = s.conversations[message.conversation_id];
      if (!conversation) {
        // Someone started a new chat with us: fetch it with its server-side unread count.
        api.conversations().then((list) => list.forEach(s.upsertConversation));
        return;
      }
      s.addMessage(message);
      if (message.sender_id === s.me?.id) return;
      s.setTyping(message.conversation_id, message.sender_id, false);
      if (s.activeId !== message.conversation_id) {
        const sender = conversation.members.find((m) => m.user.id === message.sender_id)?.user.display_name;
        const title = conversationTitle(conversation, s.me!.id);
        s.toast(conversation.kind === "group" ? `${title} · ${sender}: ${message.body}` : `${title}: ${message.body}`);
      }
      return;
    }
    case "receipt":
      return s.applyReceipt(event);
    case "typing": {
      const key = `${event.conversation_id}:${event.user_id}`;
      clearTimeout(typingTimers.get(key));
      s.setTyping(event.conversation_id, event.user_id, event.is_typing);
      // Clear the indicator even if the "stopped typing" event never arrives.
      if (event.is_typing) {
        typingTimers.set(key, setTimeout(() => s.setTyping(event.conversation_id, event.user_id, false), TYPING_TIMEOUT_MS));
      }
      return;
    }
    case "presence":
      return s.setPresence(event.user_id, event.online, event.last_seen_at);
    case "presence_snapshot":
      return s.setOnline(event.online_ids);
    case "conversation":
      return s.upsertConversation(event.conversation);
    case "conversation_removed":
      s.removeConversation(event.conversation_id);
      return s.toast("You were removed from a group");
  }
}

/** Loads the user's data and keeps it in sync over the WebSocket while mounted. */
export function useRealtime() {
  useEffect(() => {
    const token = tokenStore.get();
    if (!token) return;
    const { loadInitial, resync, endSession } = useChat.getState();
    loadInitial().catch(() => undefined); // a 401 here is handled globally
    connectSocket(token, {
      onEvent: handleEvent,
      onReconnect: () => resync().catch(() => undefined),
      onUnauthorized: () => endSession(SESSION_EXPIRED),
    });
    return disconnectSocket;
  }, []);
}
