"use client";

import { useEffect, useState } from "react";
import { useRealtime } from "@/hooks/useRealtime";
import { applyTheme, loadTheme } from "@/lib/theme";
import { useChat } from "@/store/chat";
import { ChatPane } from "./chat/ChatPane";
import { ConversationList } from "./chats/ConversationList";
import { NewChatModal } from "./modals/NewChatModal";
import { NavRail, type Tab } from "./NavRail";
import { SettingsPanel } from "./SettingsPanel";
import { SignalLogo } from "./ui/SignalLogo";

function Placeholder({ title, text }: { title: string; text: string }) {
  return (
    <aside className="sidebar">
      <header className="sidebar-header"><h1>{title}</h1></header>
      <p className="empty-text">{text}</p>
    </aside>
  );
}

/** The signed-in app shell: nav rail | sidebar for the current tab | chat pane. */
export function Messenger() {
  useRealtime();
  const [tab, setTab] = useState<Tab>("chats");
  const [composing, setComposing] = useState(false);
  const active = useChat((s) => (s.activeId ? s.conversations[s.activeId] : undefined));

  // Selecting Settings while it is open closes it again (back to Chats).
  const selectTab = (next: Tab) =>
    setTab((current) => (next === "settings" && current === "settings" ? "chats" : next));

  useEffect(() => {
    applyTheme(loadTheme());
    // Ctrl/Cmd+N opens "New chat", like Signal Desktop.
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setTab("chats");
        setComposing(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className={`app${active ? " has-active" : ""}`}>
      <NavRail tab={tab} onSelect={selectTab} />
      {tab === "chats" && <ConversationList onCompose={() => setComposing(true)} onOpenSettings={() => selectTab("settings")} />}
      {tab === "calls" && <Placeholder title="Calls" text="Voice and video calls are coming soon." />}
      {tab === "stories" && <Placeholder title="Stories" text="Stories are coming soon." />}
      {tab === "settings" && <SettingsPanel onClose={() => setTab("chats")} />}
      {active ? (
        <ChatPane key={active.id} conversation={active} />
      ) : (
        <section className="chat-pane empty">
          <SignalLogo size={72} />
          <h2>Welcome to Signal</h2>
          <p className="muted">Select a chat or start a new one. Your messages are private.</p>
        </section>
      )}
      {composing && <NewChatModal onClose={() => setComposing(false)} />}
    </div>
  );
}
