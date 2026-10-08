"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, Ellipsis, Palette, Phone, Search, ShieldCheck, Timer, Users, Video } from "lucide-react";
import { conversationColor, conversationTitle, formatLastSeen, otherMembers } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { NO_IDS, useChat } from "@/store/chat";
import { GroupInfoModal } from "../modals/GroupInfoModal";
import { Avatar } from "../ui/Avatar";
import { MenuButton, type MenuItem } from "../ui/MenuButton";
import { Composer } from "./Composer";
import { MessageList } from "./MessageList";

function useSubtitle(c: Conversation, meId: number): string {
  const typingIds = useChat((s) => s.typing[c.id] ?? NO_IDS);
  const online = useChat((s) => s.online);
  const lastSeen = useChat((s) => s.lastSeen);
  if (c.kind === "group") {
    if (typingIds.length) {
      const names = typingIds.map((id) => c.members.find((m) => m.user.id === id)?.user.display_name.split(" ")[0]);
      return `${names.join(", ")} typing…`;
    }
    return `${c.members.length} members`;
  }
  const peer = otherMembers(c, meId)[0]?.user;
  if (!peer) return "";
  if (typingIds.length) return "typing…";
  if (online.has(peer.id)) return "Online";
  return formatLastSeen(lastSeen[peer.id] ?? peer.last_seen_at);
}

export function ChatPane({ conversation: c }: { conversation: Conversation }) {
  const meId = useChat((s) => s.me!.id);
  const { loadMessages, markRead, setActive, toast, comingSoon } = useChat();
  const hasMessages = useChat((s) => !!s.messages[c.id]);
  const lastMessage = c.last_message;
  const [showInfo, setShowInfo] = useState(false);
  const title = conversationTitle(c, meId);
  const subtitle = useSubtitle(c, meId);

  useEffect(() => {
    if (!hasMessages) loadMessages(c.id).catch(() => toast("Could not load messages"));
  }, [c.id, hasMessages, loadMessages, toast]);

  // Opening a chat (or receiving a message while it is open) marks everything as read.
  const myReadId = c.members.find((m) => m.user.id === meId)?.last_read_id ?? 0;
  useEffect(() => {
    if (lastMessage && lastMessage.id > myReadId && lastMessage.sender_id !== meId) markRead(c.id, lastMessage.id);
  }, [c.id, lastMessage, myReadId, meId, markRead]);

  const menuItems: MenuItem[] = [
    ...(c.kind === "group" ? [{ label: "Group members", icon: Users, onSelect: () => setShowInfo(true) }] : []),
    { label: "Search in chat", icon: Search, onSelect: () => comingSoon("Search in chat") },
    { label: "Disappearing messages", icon: Timer, onSelect: () => comingSoon("Disappearing messages") },
    { label: "Chat color & wallpaper", icon: Palette, onSelect: () => comingSoon("Chat colors and wallpapers") },
    { label: "View safety number", icon: ShieldCheck, onSelect: () => comingSoon("Safety numbers") },
  ];

  return (
    <section className="chat-pane">
      <header className="chat-header">
        <button className="icon-button mobile-only" aria-label="Back" onClick={() => setActive(null)}>
          <ChevronLeft />
        </button>
        <button className="chat-header-title" onClick={() => c.kind === "group" && setShowInfo(true)}>
          <Avatar name={title} color={conversationColor(c, meId)} size={36} />
          <div>
            <div className="chat-title">{title}</div>
            <div className={`chat-subtitle${subtitle.includes("typing") ? " typing" : ""}`}>{subtitle}</div>
          </div>
        </button>
        <div className="chat-header-actions">
          <button className="icon-button" aria-label="Video call" onClick={() => comingSoon("Video calls")}>
            <Video />
          </button>
          <button className="icon-button" aria-label="Voice call" onClick={() => comingSoon("Voice calls")}>
            <Phone />
          </button>
          <MenuButton label="Chat options" icon={<Ellipsis />} items={menuItems} />
        </div>
      </header>
      <MessageList conversation={c} />
      <Composer conversationId={c.id} />
      {showInfo && <GroupInfoModal conversation={c} onClose={() => setShowInfo(false)} />}
    </section>
  );
}
