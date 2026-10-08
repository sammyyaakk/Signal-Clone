import type { Conversation, Member, Message, MessageStatus } from "./types";

export const AVATAR_COLORS = ["#2c6bed", "#cc163d", "#077d92", "#8f2af4", "#c73800", "#3b7845", "#b1288b", "#5e5e5e"];
const GROUP_COLORS = AVATAR_COLORS.slice(0, 6);

export const otherMembers = (c: Conversation, meId: number): Member[] =>
  c.members.filter((m) => m.user.id !== meId);

export function conversationTitle(c: Conversation, meId: number): string {
  if (c.kind === "group") return c.name ?? "Group";
  return otherMembers(c, meId)[0]?.user.display_name || "Unknown";
}

export function conversationColor(c: Conversation, meId: number): string {
  if (c.kind === "group") return GROUP_COLORS[c.id % GROUP_COLORS.length];
  return otherMembers(c, meId)[0]?.user.avatar_color ?? GROUP_COLORS[0];
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

export const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

/** Conversation list timestamp: time today, weekday this week, date otherwise. */
export function formatListTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) return formatTime(iso);
  if (now.getTime() - date.getTime() < 6 * 86_400_000) return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatDay(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  if (isSameDay(date, now)) return "Today";
  if (isSameDay(date, new Date(now.getTime() - 86_400_000))) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function formatLastSeen(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "Last seen just now";
  if (minutes < 60) return `Last seen ${minutes}m ago`;
  if (minutes < 24 * 60) return `Last seen ${Math.round(minutes / 60)}h ago`;
  return `Last seen ${formatListTime(iso)}`;
}

/** Status of my own message, derived from the other members' receipt watermarks. */
export function messageStatus(m: Message, c: Conversation, meId: number): MessageStatus {
  if (m.pending) return "sending";
  const others = otherMembers(c, meId);
  if (others.length && others.every((o) => o.last_read_id >= m.id)) return "read";
  if (others.length && others.every((o) => o.last_delivered_id >= m.id)) return "delivered";
  return "sent";
}
