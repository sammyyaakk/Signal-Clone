import { formatTime } from "@/lib/format";
import type { Message, MessageStatus, User } from "@/lib/types";
import { Avatar } from "../ui/Avatar";
import { Icon, type IconName } from "../ui/Icon";

const STATUS_ICON: Record<MessageStatus, IconName> = {
  sending: "clock",
  sent: "check",
  delivered: "doubleCheck",
  read: "doubleCheck",
};

interface Props {
  message: Message;
  mine: boolean;
  status?: MessageStatus;
  sender?: User; // set for incoming group messages
  firstInRun: boolean;
  lastInRun: boolean;
}

export function MessageBubble({ message, mine, status, sender, firstInRun, lastInRun }: Props) {
  return (
    <div className={`message-row ${mine ? "outgoing" : "incoming"}${lastInRun ? " run-end" : ""}`}>
      {sender && (
        <div className="message-avatar">
          {lastInRun && <Avatar name={sender.display_name} color={sender.avatar_color} size={28} />}
        </div>
      )}
      <div className="bubble">
        {sender && firstInRun && (
          <div className="bubble-sender" style={{ color: sender.avatar_color }}>{sender.display_name}</div>
        )}
        <span className="bubble-body">{message.body}</span>
        <span className="bubble-meta">
          {formatTime(message.created_at)}
          {status && (
            <span className={`status-icon ${status}`} title={status[0].toUpperCase() + status.slice(1)}>
              <Icon name={STATUS_ICON[status]} size={14} />
            </span>
          )}
        </span>
      </div>
    </div>
  );
}
