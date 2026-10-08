import { Fragment, useEffect, useRef } from "react";
import { conversationColor, conversationTitle, formatDay, messageStatus } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { NO_IDS, useChat } from "@/store/chat";
import { Avatar } from "../ui/Avatar";
import { Icon } from "../ui/Icon";
import { MessageBubble } from "./MessageBubble";

const RUN_GAP_MS = 5 * 60_000; // consecutive messages within this gap are grouped visually

export function MessageList({ conversation: c }: { conversation: Conversation }) {
  const meId = useChat((s) => s.me!.id);
  const messages = useChat((s) => s.messages[c.id]);
  const typingIds = useChat((s) => s.typing[c.id] ?? NO_IDS);
  const bottomRef = useRef<HTMLDivElement>(null);
  const usersById = new Map(c.members.map((m) => [m.user.id, m.user]));
  const title = conversationTitle(c, meId);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages?.length, typingIds.length, c.id]);

  return (
    <div className="message-list">
      <div className="conversation-intro">
        <Avatar name={title} color={conversationColor(c, meId)} size={80} />
        <h2>{title}</h2>
        <p className="muted">
          {c.kind === "group" ? `${c.members.length} members` : c.members.find((m) => m.user.id !== meId)?.user.phone}
        </p>
        <p className="encryption-note">
          <Icon name="lock" size={14} /> Messages are end-to-end encrypted. No one outside this chat can read them.
        </p>
      </div>

      {messages?.map((m, i) => {
        const prev = messages[i - 1];
        const next = messages[i + 1];
        const sameRun = (a?: typeof m, b?: typeof m) =>
          !!a && !!b && a.sender_id === b.sender_id &&
          Math.abs(Date.parse(a.created_at) - Date.parse(b.created_at)) < RUN_GAP_MS;
        const newDay = !prev || formatDay(prev.created_at) !== formatDay(m.created_at);
        const mine = m.sender_id === meId;
        return (
          <Fragment key={m.id}>
            {newDay && <div className="day-separator">{formatDay(m.created_at)}</div>}
            <MessageBubble
              message={m}
              mine={mine}
              status={mine ? messageStatus(m, c, meId) : undefined}
              sender={!mine && c.kind === "group" ? usersById.get(m.sender_id) : undefined}
              firstInRun={newDay || !sameRun(prev, m)}
              lastInRun={!sameRun(m, next)}
            />
          </Fragment>
        );
      })}

      {typingIds.length > 0 && (
        <div className="message-row incoming run-end">
          <div className="bubble typing-bubble" title={typingIds.map((id) => usersById.get(id)?.display_name).join(", ")}>
            <span /><span /><span />
          </div>
        </div>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
