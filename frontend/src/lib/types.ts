export interface User {
  id: number;
  phone: string;
  display_name: string;
  avatar_color: string;
  about: string;
  last_seen_at: string;
}

export interface Member {
  user: User;
  role: "admin" | "member";
  last_delivered_id: number;
  last_read_id: number;
}

export interface Message {
  id: number; // negative while an optimistic message is still being sent
  conversation_id: number;
  sender_id: number;
  body: string;
  created_at: string;
  pending?: boolean;
}

export interface Conversation {
  id: number;
  kind: "direct" | "group";
  name: string | null;
  members: Member[];
  last_message: Message | null;
  unread_count: number;
  last_activity_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  needs_profile: boolean;
}

export type MessageStatus = "sending" | "sent" | "delivered" | "read";

export interface ReceiptEvent {
  type: "receipt";
  conversation_id: number;
  user_id: number;
  last_delivered_id: number;
  last_read_id: number;
}

export type ServerEvent =
  | { type: "message"; message: Message }
  | ReceiptEvent
  | { type: "typing"; conversation_id: number; user_id: number; is_typing: boolean }
  | { type: "presence"; user_id: number; online: boolean; last_seen_at?: string }
  | { type: "presence_snapshot"; online_ids: number[] }
  | { type: "conversation"; conversation: Conversation }
  | { type: "conversation_removed"; conversation_id: number };
