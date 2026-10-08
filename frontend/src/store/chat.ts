import { create } from "zustand";
import { api, setUnauthorizedHandler, tokenStore } from "@/lib/api";
import { disconnectSocket } from "@/lib/socket";
import type { AuthResponse, Conversation, Message, Reaction, ReceiptEvent, User } from "@/lib/types";

interface Toast {
  id: number;
  text: string;
}

interface ChatState {
  me: User | null;
  contacts: User[];
  conversations: Record<number, Conversation>;
  messages: Record<number, Message[]>; // only for conversations that have been opened
  activeId: number | null;
  online: Set<number>;
  lastSeen: Record<number, string>; // live overrides of user.last_seen_at
  typing: Record<number, number[]>; // conversation id -> ids of users typing
  toasts: Toast[];

  // session
  restoreSession(): Promise<void>;
  login(auth: AuthResponse): void;
  logout(): Promise<void>;
  endSession(notice?: string): void;
  updateProfile(patch: Partial<Pick<User, "display_name" | "avatar_color" | "about">>): Promise<void>;

  // data loading
  loadInitial(): Promise<void>;
  resync(): Promise<void>;
  loadMessages(conversationId: number): Promise<void>;
  setContacts(contacts: User[]): void;

  // conversations
  setActive(id: number | null): void;
  openDirect(userId: number): Promise<void>;
  upsertConversation(c: Conversation): void;
  removeConversation(id: number): void;

  // messages
  sendMessage(conversationId: number, body: string): Promise<void>;
  addMessage(m: Message): void;
  markRead(conversationId: number, messageId: number): void;
  toggleReaction(message: Message, emoji: string): Promise<void>;
  setReactions(conversationId: number, messageId: number, reactions: Reaction[]): void;
  applyReceipt(e: ReceiptEvent): void;

  // realtime presence/typing
  setTyping(conversationId: number, userId: number, isTyping: boolean): void;
  setPresence(userId: number, online: boolean, lastSeen?: string): void;
  setOnline(ids: number[]): void;

  toast(text: string): void;
  comingSoon(feature: string): void;
}

const initialData = {
  me: null,
  contacts: [],
  conversations: {},
  messages: {},
  activeId: null,
  online: new Set<number>(),
  lastSeen: {},
  typing: {},
  toasts: [],
};

let nextToastId = 1;

/** Stable empty array so selectors don't return a new reference every render. */
export const NO_IDS: number[] = [];

/** The frontend can go live before the API during a deploy; default fields the older API lacks. */
const normalize = (m: Message): Message => (m.reactions ? m : { ...m, reactions: [] });

export const useChat = create<ChatState>()((set, get) => ({
  ...initialData,

  async restoreSession() {
    if (!tokenStore.get()) return;
    try {
      set({ me: await api.me() });
    } catch {
      // A rejected token is handled by the unauthorized handler below; a cold-starting
      // or unreachable server keeps the token so the user stays logged in.
    }
  },

  login({ token, user }) {
    tokenStore.set(token);
    set({ me: user });
  },

  async logout() {
    await api.logout().catch(() => undefined);
    get().endSession();
  },

  endSession(notice) {
    disconnectSocket();
    tokenStore.clear();
    set({ ...initialData, online: new Set() });
    if (notice) get().toast(notice);
  },

  async updateProfile(patch) {
    set({ me: await api.updateMe(patch) });
  },

  async loadInitial() {
    const [conversations, contacts] = await Promise.all([api.conversations(), api.contacts()]);
    set({ conversations: Object.fromEntries(conversations.map((c) => [c.id, c])), contacts });
  },

  async resync() {
    set({ messages: {} }); // open chats reload their history
    await get().loadInitial();
  },

  async loadMessages(conversationId) {
    const list = (await api.messages(conversationId)).map(normalize);
    set((s) => ({ messages: { ...s.messages, [conversationId]: list } }));
  },

  setContacts: (contacts) => set({ contacts }),

  setActive: (id) => set({ activeId: id }),

  async openDirect(userId) {
    const conversation = await api.openDirect(userId);
    get().upsertConversation(conversation);
    set({ activeId: conversation.id });
  },

  upsertConversation: (c) => set((s) => ({ conversations: { ...s.conversations, [c.id]: c } })),

  removeConversation: (id) =>
    set((s) => {
      const conversations = { ...s.conversations };
      delete conversations[id];
      return { conversations, activeId: s.activeId === id ? null : s.activeId };
    }),

  async sendMessage(conversationId, body) {
    const me = get().me!;
    // Optimistic message, shown immediately with the "sending" status.
    const temp: Message = {
      id: -Date.now(),
      conversation_id: conversationId,
      sender_id: me.id,
      body,
      created_at: new Date().toISOString(),
      reactions: [],
      pending: true,
    };
    get().addMessage(temp);
    const dropTemp = () =>
      set((s) => ({
        messages: {
          ...s.messages,
          [conversationId]: (s.messages[conversationId] ?? []).filter((m) => m.id !== temp.id),
        },
      }));
    try {
      const saved = await api.send(conversationId, body);
      dropTemp(); // the socket may already have delivered `saved`; addMessage de-duplicates
      get().addMessage(saved);
    } catch {
      dropTemp();
      get().toast("Message failed to send");
    }
  },

  addMessage: (incoming) =>
    set((s) => {
      const m = normalize(incoming);
      const list = s.messages[m.conversation_id];
      if (list?.some((x) => x.id === m.id)) return {};
      const messages = list ? { ...s.messages, [m.conversation_id]: [...list, m] } : s.messages;
      const conversation = s.conversations[m.conversation_id];
      if (!conversation) return { messages };
      const unseen = m.sender_id !== s.me?.id && s.activeId !== m.conversation_id;
      return {
        messages,
        conversations: {
          ...s.conversations,
          [m.conversation_id]: {
            ...conversation,
            last_message: m,
            last_activity_at: m.created_at,
            unread_count: conversation.unread_count + (unseen ? 1 : 0),
          },
        },
      };
    }),

  markRead(conversationId, messageId) {
    api.markRead(conversationId, messageId).catch(() => undefined);
    set((s) => {
      const conversation = s.conversations[conversationId];
      if (!conversation) return {};
      return { conversations: { ...s.conversations, [conversationId]: { ...conversation, unread_count: 0 } } };
    });
  },

  async toggleReaction(message, emoji) {
    // Picking my current emoji again removes it; any other emoji replaces it.
    const meId = get().me!.id;
    const isMine = message.reactions.some((r) => r.user_id === meId && r.emoji === emoji);
    try {
      const reactions = isMine
        ? await api.unreact(message.conversation_id, message.id)
        : await api.react(message.conversation_id, message.id, emoji);
      get().setReactions(message.conversation_id, message.id, reactions);
    } catch {
      get().toast("Could not update reaction");
    }
  },

  setReactions: (conversationId, messageId, reactions) =>
    set((s) => {
      const withReactions = (m: Message) => (m.id === messageId ? { ...m, reactions } : m);
      const list = s.messages[conversationId];
      const conversation = s.conversations[conversationId];
      return {
        messages: list ? { ...s.messages, [conversationId]: list.map(withReactions) } : s.messages,
        conversations: conversation?.last_message
          ? {
              ...s.conversations,
              [conversationId]: { ...conversation, last_message: withReactions(conversation.last_message) },
            }
          : s.conversations,
      };
    }),

  applyReceipt: (e) =>
    set((s) => {
      const conversation = s.conversations[e.conversation_id];
      if (!conversation) return {};
      const members = conversation.members.map((m) =>
        m.user.id === e.user_id
          ? { ...m, last_delivered_id: e.last_delivered_id, last_read_id: e.last_read_id }
          : m,
      );
      return { conversations: { ...s.conversations, [e.conversation_id]: { ...conversation, members } } };
    }),

  setTyping: (conversationId, userId, isTyping) =>
    set((s) => {
      const current = (s.typing[conversationId] ?? []).filter((id) => id !== userId);
      return { typing: { ...s.typing, [conversationId]: isTyping ? [...current, userId] : current } };
    }),

  setPresence: (userId, isOnline, lastSeen) =>
    set((s) => {
      const online = new Set(s.online);
      if (isOnline) online.add(userId);
      else online.delete(userId);
      return { online, lastSeen: lastSeen ? { ...s.lastSeen, [userId]: lastSeen } : s.lastSeen };
    }),

  setOnline: (ids) => set({ online: new Set(ids) }),

  toast(text) {
    const id = nextToastId++;
    set((s) => ({ toasts: [...s.toasts, { id, text }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 3500);
  },

  comingSoon: (feature) => get().toast(`${feature}: coming soon`),
}));

export const SESSION_EXPIRED = "Your session expired. Please log in again.";

// The server rejects our token after logout elsewhere or when its database is reset.
setUnauthorizedHandler(() => useChat.getState().endSession(SESSION_EXPIRED));
