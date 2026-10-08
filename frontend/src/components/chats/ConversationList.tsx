"use client";

import { useMemo, useState } from "react";
import { conversationTitle } from "@/lib/format";
import { useChat } from "@/store/chat";
import { Search, SquarePen, X } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { ContactRow } from "../ui/ContactRow";
import { ConversationItem } from "./ConversationItem";

interface Props {
  onCompose: () => void;
  onOpenSettings: () => void;
}

export function ConversationList({ onCompose, onOpenSettings }: Props) {
  const { me, conversations, contacts, activeId, setActive, openDirect } = useChat();
  const [query, setQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);

  const sorted = useMemo(
    () => Object.values(conversations).sort((a, b) => b.last_activity_at.localeCompare(a.last_activity_at)),
    [conversations],
  );

  const q = query.trim().toLowerCase();
  const chats = sorted.filter(
    (c) =>
      (!unreadOnly || c.unread_count > 0) &&
      (!q || conversationTitle(c, me!.id).toLowerCase().includes(q) || c.last_message?.body.toLowerCase().includes(q)),
  );
  const contactHits = q
    ? contacts.filter((u) => u.display_name.toLowerCase().includes(q) || u.phone.includes(q))
    : [];

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        {/* The nav rail is hidden on narrow screens, so the profile avatar opens Settings there. */}
        <button className="mobile-only" aria-label="Settings" onClick={onOpenSettings}>
          <Avatar name={me!.display_name} color={me!.avatar_color} size={32} />
        </button>
        <h1>Chats</h1>
        <button className="icon-button" title="New chat (Ctrl+N)" aria-label="New chat" onClick={onCompose}>
          <SquarePen size={20} />
        </button>
      </header>
      <div className="search-row">
        <label className="search-box">
          <Search size={18} />
          <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button className="icon-button small" aria-label="Clear search" onClick={() => setQuery("")}>
              <X size={16} />
            </button>
          )}
        </label>
        <button className={`chip${unreadOnly ? " active" : ""}`} onClick={() => setUnreadOnly(!unreadOnly)}>
          Unread
        </button>
      </div>

      <div className="conversation-scroll">
        {q && <div className="list-section-title">Chats</div>}
        {chats.map((c) => (
          <ConversationItem key={c.id} conversation={c} active={c.id === activeId} onSelect={() => setActive(c.id)} />
        ))}
        {chats.length === 0 && <p className="empty-text">{unreadOnly ? "No unread chats" : "No chats found"}</p>}
        {contactHits.length > 0 && (
          <>
            <div className="list-section-title">Contacts</div>
            {contactHits.map((u) => (
              <ContactRow key={u.id} user={u} onClick={() => { setQuery(""); openDirect(u.id); }} />
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
