import type { AuthResponse, Conversation, Message, User } from "./types";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TOKEN_KEY = "signal.token";

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

async function request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, typeof data.detail === "string" ? data.detail : "Something went wrong");
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const api = {
  verify: (phone: string, otp: string) => request<AuthResponse>("/auth/verify", "POST", { phone, otp }),
  logout: () => request<void>("/auth/logout", "POST"),
  me: () => request<User>("/users/me"),
  updateMe: (patch: Partial<Pick<User, "display_name" | "avatar_color" | "about">>) =>
    request<User>("/users/me", "PATCH", patch),
  contacts: () => request<User[]>("/contacts"),
  addContact: (phone: string) => request<User>("/contacts", "POST", { phone }),
  conversations: () => request<Conversation[]>("/conversations"),
  openDirect: (userId: number) => request<Conversation>("/conversations/direct", "POST", { user_id: userId }),
  createGroup: (name: string, memberIds: number[]) =>
    request<Conversation>("/conversations/group", "POST", { name, member_ids: memberIds }),
  messages: (conversationId: number) => request<Message[]>(`/conversations/${conversationId}/messages`),
  send: (conversationId: number, body: string) =>
    request<Message>(`/conversations/${conversationId}/messages`, "POST", { body }),
  markRead: (conversationId: number, messageId: number) =>
    request<void>(`/conversations/${conversationId}/read`, "POST", { message_id: messageId }),
  addMembers: (conversationId: number, userIds: number[]) =>
    request<Conversation>(`/conversations/${conversationId}/members`, "POST", { user_ids: userIds }),
  removeMember: (conversationId: number, userId: number) =>
    request<void>(`/conversations/${conversationId}/members/${userId}`, "DELETE"),
};

export const socketUrl = (token: string) => `${API_URL.replace(/^http/, "ws")}/ws?token=${token}`;
