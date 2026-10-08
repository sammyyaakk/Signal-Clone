"use client";

import { useState } from "react";
import { ChevronLeft } from "lucide-react";
import { ApiError } from "@/lib/api";
import { AVATAR_COLORS } from "@/lib/format";
import { applyTheme, loadTheme, type Theme } from "@/lib/theme";
import { useChat } from "@/store/chat";
import { Avatar } from "./ui/Avatar";

const PLACEHOLDER_SECTIONS = [
  { title: "Privacy", rows: ["Read receipts", "Typing indicators", "Disappearing messages", "Blocked users"] },
  { title: "Notifications", rows: ["Message notifications", "Notification sound", "Call notifications"] },
  { title: "Linked devices", rows: ["Link new device"] },
];

export function SettingsPanel({ onClose }: { onClose: () => void }) {
  const { me, updateProfile, logout, toast } = useChat();
  const [name, setName] = useState(me!.display_name);
  const [about, setAbout] = useState(me!.about);
  const [theme, setTheme] = useState<Theme>(loadTheme);

  const changeTheme = (next: Theme) => {
    setTheme(next);
    applyTheme(next);
  };

  const save = (patch: Parameters<typeof updateProfile>[0]) =>
    updateProfile(patch)
      .then(() => toast("Profile updated"))
      .catch((err) => toast(err instanceof ApiError ? err.message : "Could not update profile"));

  const dirty = name.trim() !== me!.display_name || about !== me!.about;

  return (
    <aside className="sidebar settings">
      <header className="sidebar-header">
        <button className="icon-button mobile-only" aria-label="Back to chats" onClick={onClose}>
          <ChevronLeft />
        </button>
        <h1>Settings</h1>
      </header>
      <div className="conversation-scroll">
        <section className="settings-section">
          <div className="profile-card">
            <Avatar name={me!.display_name} color={me!.avatar_color} size={64} />
            <div>
              <div className="chat-title">{me!.display_name}</div>
              <div className="muted">{me!.phone}</div>
            </div>
          </div>
          <div className="color-picker">
            {AVATAR_COLORS.map((c) => (
              <button key={c} aria-label={c} className={c === me!.avatar_color ? "selected" : ""}
                style={{ background: c }} onClick={() => save({ avatar_color: c })} />
            ))}
          </div>
          <label className="field-label">Name
            <input className="text-input" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="field-label">About
            <input className="text-input" maxLength={140} value={about} onChange={(e) => setAbout(e.target.value)} />
          </label>
          <button className="primary-button" disabled={!dirty || !name.trim()}
            onClick={() => save({ display_name: name.trim(), about })}>Save profile</button>
        </section>

        <section className="settings-section">
          <h3>Appearance</h3>
          <div className="segmented">
            {(["light", "dark"] as const).map((t) => (
              <button key={t} className={theme === t ? "active" : ""} onClick={() => changeTheme(t)}>
                {t === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </section>

        {PLACEHOLDER_SECTIONS.map((section) => (
          <section key={section.title} className="settings-section">
            <h3>{section.title}</h3>
            {section.rows.map((row) => (
              <div key={row} className="settings-row">
                <span>{row}</span>
                <span className="soon-badge">Coming soon</span>
              </div>
            ))}
          </section>
        ))}

        <section className="settings-section">
          <button className="action-row danger" onClick={logout}>Log out</button>
        </section>
      </div>
    </aside>
  );
}
