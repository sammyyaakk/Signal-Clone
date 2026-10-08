import type { IconName } from "./ui/Icon";
import { Icon } from "./ui/Icon";
import { Avatar } from "./ui/Avatar";
import { useChat } from "@/store/chat";

export type Tab = "chats" | "calls" | "stories" | "settings";

const TABS: { id: Tab; icon: IconName; label: string }[] = [
  { id: "chats", icon: "chats", label: "Chats" },
  { id: "calls", icon: "calls", label: "Calls" },
  { id: "stories", icon: "stories", label: "Stories" },
];

export function NavRail({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const me = useChat((s) => s.me)!;
  const unread = useChat((s) => Object.values(s.conversations).reduce((n, c) => n + c.unread_count, 0));

  return (
    <nav className="nav-rail">
      {TABS.map((t) => (
        <button key={t.id} className={`nav-button${tab === t.id ? " active" : ""}`} title={t.label}
          aria-label={t.label} onClick={() => onChange(t.id)}>
          <Icon name={t.icon} size={22} />
          {t.id === "chats" && unread > 0 && <span className="nav-badge">{unread}</span>}
        </button>
      ))}
      <div className="nav-spacer" />
      <button className={`nav-button${tab === "settings" ? " active" : ""}`} title="Settings"
        aria-label="Settings" onClick={() => onChange("settings")}>
        <Icon name="settings" size={22} />
      </button>
      <button className="nav-avatar" title="Profile" onClick={() => onChange("settings")}>
        <Avatar name={me.display_name} color={me.avatar_color} size={28} />
      </button>
    </nav>
  );
}
