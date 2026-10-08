"use client";

import { useMemo, useState } from "react";
import { conversationTitle } from "@/lib/format";
import { useChat } from "@/store/chat";
import { ContactRow } from "../ui/ContactRow";
import { Icon } from "../ui/Icon";
import { ConversationItem } from "./ConversationItem";

export function ConversationList({ onCompose }: { onCompose: () => void }) {
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
        <h1>Chats</h1>
        <button className="icon-button" title="New chat (Ctrl+N)" aria-label="New chat" onClick={onCompose}>
          <Icon name="compose" />
        </button>
      </header>
      <div className="search-row">
        <label className="search-box">
          <Icon name="search" size={18} />
          <input placeholder="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
          {query && (
            <button className="icon-button small" aria-label="Clear search" onClick={() => setQuery("")}>
              <Icon name="close" size={16} />
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
