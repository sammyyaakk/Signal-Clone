import { CircleDashed, MessageCircle, Phone, Settings, type LucideIcon } from "lucide-react";
import { useChat } from "@/store/chat";
import { Avatar } from "./ui/Avatar";

export type Tab = "chats" | "calls" | "stories" | "settings";

const TABS: { id: Tab; icon: LucideIcon; label: string }[] = [
  { id: "chats", icon: MessageCircle, label: "Chats" },
  { id: "calls", icon: Phone, label: "Calls" },
  { id: "stories", icon: CircleDashed, label: "Stories" },
];

export function NavRail({ tab, onSelect }: { tab: Tab; onSelect: (tab: Tab) => void }) {
  const me = useChat((s) => s.me)!;
  const unread = useChat((s) => Object.values(s.conversations).reduce((n, c) => n + c.unread_count, 0));

  return (
    <nav className="nav-rail">
      {TABS.map(({ id, icon: TabIcon, label }) => (
        <button key={id} className={`nav-button${tab === id ? " active" : ""}`} title={label}
          aria-label={label} onClick={() => onSelect(id)}>
          <TabIcon size={22} />
          {id === "chats" && unread > 0 && <span className="nav-badge">{unread}</span>}
        </button>
      ))}
      <div className="nav-spacer" />
      <button className={`nav-button${tab === "settings" ? " active" : ""}`} title="Settings"
        aria-label="Settings" aria-pressed={tab === "settings"} onClick={() => onSelect("settings")}>
        <Settings size={22} />
      </button>
      <button className="nav-avatar" title="Profile" aria-label="Profile" onClick={() => onSelect("settings")}>
        <Avatar name={me.display_name} color={me.avatar_color} size={28} />
      </button>
    </nav>
  );
}
