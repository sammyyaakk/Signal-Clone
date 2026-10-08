import { conversationColor, conversationTitle, formatListTime, otherMembers } from "@/lib/format";
import type { Conversation } from "@/lib/types";
import { useChat } from "@/store/chat";
import { Avatar } from "../ui/Avatar";

interface Props {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
}

export function ConversationItem({ conversation: c, active, onSelect }: Props) {
  const meId = useChat((s) => s.me!.id);
  const typing = useChat((s) => (s.typing[c.id] ?? []).length > 0);
  const peer = c.kind === "direct" ? otherMembers(c, meId)[0]?.user : undefined;
  const peerOnline = useChat((s) => (peer ? s.online.has(peer.id) : false));
  const title = conversationTitle(c, meId);

  let preview = "";
  if (typing) preview = "typing…";
  else if (c.last_message) {
    const senderId = c.last_message.sender_id;
    const sender =
      senderId === meId ? "You" : c.kind === "group" ? c.members.find((m) => m.user.id === senderId)?.user.display_name.split(" ")[0] : "";
    preview = sender ? `${sender}: ${c.last_message.body}` : c.last_message.body;
  }

  return (
    <button className={`conversation-item${active ? " active" : ""}`} onClick={onSelect}>
      <Avatar name={title} color={conversationColor(c, meId)} online={peerOnline} />
      <div className="conversation-item-text">
        <div className="conversation-item-top">
          <span className="conversation-item-title">{title}</span>
          {c.last_message && <span className="conversation-item-time">{formatListTime(c.last_activity_at)}</span>}
        </div>
        <div className="conversation-item-bottom">
          <span className={`conversation-item-preview${typing ? " typing" : ""}`}>{preview}</span>
          {c.unread_count > 0 && <span className="unread-badge">{c.unread_count}</span>}
        </div>
      </div>
    </button>
  );
}
