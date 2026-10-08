import { Copy, Ellipsis, Forward, Info, Reply, Trash2 } from "lucide-react";
import { formatTime } from "@/lib/format";
import type { Message, MessageStatus, User } from "@/lib/types";
import { useChat } from "@/store/chat";
import { Avatar } from "../ui/Avatar";
import { MenuButton, type MenuItem } from "../ui/MenuButton";
import { StatusIcon } from "../ui/StatusIcon";
import { ReactionChips, ReactionPicker } from "./Reactions";

interface Props {
  message: Message;
  mine: boolean;
  status?: MessageStatus;
  sender?: User; // set for incoming group messages
  firstInRun: boolean;
  lastInRun: boolean;
}

export function MessageBubble({ message, mine, status, sender, firstInRun, lastInRun }: Props) {
  const meId = useChat((s) => s.me!.id);
  const toast = useChat((s) => s.toast);
  const comingSoon = useChat((s) => s.comingSoon);
  const toggleReaction = useChat((s) => s.toggleReaction);
  const myReaction = message.reactions.find((r) => r.user_id === meId)?.emoji;
  const react = (emoji: string) => toggleReaction(message, emoji);

  const actions: MenuItem[] = [
    { label: "Reply", icon: Reply, onSelect: () => comingSoon("Replies") },
    {
      label: "Copy text",
      icon: Copy,
      onSelect: () =>
        navigator.clipboard.writeText(message.body).then(
          () => toast("Copied to clipboard"),
          () => toast("Could not copy"),
        ),
    },
    { label: "Forward", icon: Forward, onSelect: () => comingSoon("Forwarding") },
    { label: "Info", icon: Info, onSelect: () => comingSoon("Message details") },
    { label: "Delete", icon: Trash2, onSelect: () => comingSoon("Deleting messages") },
  ];

  const rowClass = [
    "message-row",
    mine ? "outgoing" : "incoming",
    firstInRun && "run-start",
    lastInRun && "run-end",
    message.reactions.length > 0 && "has-reactions",
  ].filter(Boolean).join(" ");

  return (
    <div className={rowClass}>
      {sender && (
        <div className="message-avatar">
          {lastInRun && <Avatar name={sender.display_name} color={sender.avatar_color} size={28} />}
        </div>
      )}
      <div className="bubble-stack">
        <div className="bubble">
          {sender && firstInRun && (
            <div className="bubble-sender" style={{ color: sender.avatar_color }}>{sender.display_name}</div>
          )}
          <span className="bubble-body">{message.body}</span>
          <span className="bubble-meta">
            {formatTime(message.created_at)}
            {status && <StatusIcon status={status} />}
          </span>
        </div>
        {message.reactions.length > 0 && (
          <ReactionChips reactions={message.reactions} meId={meId} onToggle={react} />
        )}
      </div>
      {!message.pending && (
        <div className="message-actions">
          <ReactionPicker current={myReaction} onPick={react} alignLeft={!mine} />
          <MenuButton label="More actions" icon={<Ellipsis size={18} />} items={actions} up alignLeft={!mine} />
        </div>
      )}
    </div>
  );
}
