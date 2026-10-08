"use client";

import { useState } from "react";
import { UserPlus } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import type { Conversation } from "@/lib/types";
import { useChat } from "@/store/chat";
import { ContactRow } from "../ui/ContactRow";
import { Modal } from "../ui/Modal";
import { ContactPicker, toggleIn } from "./ContactPicker";

/** Group members with admin controls: add members, remove members, leave group. */
export function GroupInfoModal({ conversation: c, onClose }: { conversation: Conversation; onClose: () => void }) {
  const { me, contacts, online, upsertConversation, removeConversation, toast } = useChat();
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const isAdmin = c.members.some((m) => m.user.id === me!.id && m.role === "admin");
  const memberIds = new Set(c.members.map((m) => m.user.id));
  const candidates = contacts.filter((u) => !memberIds.has(u.id));

  const attempt = (action: () => Promise<void>) => () =>
    action().catch((err) => toast(err instanceof ApiError ? err.message : "Something went wrong"));

  const addMembers = attempt(async () => {
    upsertConversation(await api.addMembers(c.id, [...selected]));
    toast(`Added ${selected.size} member${selected.size > 1 ? "s" : ""}`);
    setSelected(new Set());
    setAdding(false);
  });

  const remove = (userId: number, name: string) => attempt(async () => {
    await api.removeMember(c.id, userId);
    toast(`${name} removed from the group`);
  });

  const leave = attempt(async () => {
    await api.removeMember(c.id, me!.id);
    removeConversation(c.id);
    toast(`You left "${c.name}"`);
    onClose();
  });

  if (adding) {
    return (
      <Modal title="Add members" onClose={onClose}>
        <ContactPicker users={candidates} selected={selected} onToggle={(id) => setSelected(toggleIn(selected, id))} />
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setAdding(false)}>Back</button>
          <button className="primary-button" disabled={selected.size === 0} onClick={addMembers}>Add</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={c.name ?? "Group"} onClose={onClose}>
      <div className="list-section-title">{c.members.length} members</div>
      {isAdmin && (
        <button className="action-row" onClick={() => setAdding(true)}>
          <span className="action-row-icon"><UserPlus size={20} /></span> Add members
        </button>
      )}
      {c.members.map(({ user, role }) => (
        <ContactRow
          key={user.id}
          user={user}
          subtitle={user.id === me!.id ? "You" : online.has(user.id) ? "Online" : user.phone}
          trailing={
            <div className="member-trailing">
              {role === "admin" && <span className="role-badge">Admin</span>}
              {isAdmin && user.id !== me!.id && (
                <button className="link-button danger" onClick={remove(user.id, user.display_name)}>Remove</button>
              )}
            </div>
          }
        />
      ))}
      <button className="action-row danger" onClick={leave}>Leave group</button>
    </Modal>
  );
}
