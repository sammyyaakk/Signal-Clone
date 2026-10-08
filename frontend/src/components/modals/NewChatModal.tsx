"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useChat } from "@/store/chat";
import { ContactRow } from "../ui/ContactRow";
import { Icon } from "../ui/Icon";
import { Modal } from "../ui/Modal";
import { ContactPicker, toggleIn } from "./ContactPicker";

const PHONE_RE = /^\+?\d{7,15}$/;

/** "New chat": pick a contact, add a contact by phone number, or create a group. */
export function NewChatModal({ onClose }: { onClose: () => void }) {
  const { contacts, setContacts, openDirect, upsertConversation, setActive, toast } = useChat();
  const [mode, setMode] = useState<"chat" | "group">("chat");
  const [query, setQuery] = useState("");
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  const q = query.trim().toLowerCase();
  const matches = contacts.filter((u) => u.display_name.toLowerCase().includes(q) || u.phone.includes(q));
  const phone = query.replace(/[\s-]/g, "");
  const canAddPhone = PHONE_RE.test(phone) && !contacts.some((u) => u.phone === phone);

  const withBusy = async (action: () => Promise<void>) => {
    setBusy(true);
    try {
      await action();
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const startChat = (userId: number) => withBusy(async () => {
    await openDirect(userId);
    onClose();
  });

  const addContact = () => withBusy(async () => {
    const user = await api.addContact(phone);
    setContacts([...contacts, user].sort((a, b) => a.display_name.localeCompare(b.display_name)));
    toast(`${user.display_name} added to contacts`);
    await openDirect(user.id);
    onClose();
  });

  const createGroup = () => withBusy(async () => {
    const group = await api.createGroup(groupName.trim(), [...selected]);
    upsertConversation(group);
    setActive(group.id);
    toast(`Group "${group.name}" created`);
    onClose();
  });

  if (mode === "group") {
    return (
      <Modal title="New group" onClose={onClose}>
        <input autoFocus className="text-input" placeholder="Group name (required)" maxLength={80}
          value={groupName} onChange={(e) => setGroupName(e.target.value)} />
        <div className="list-section-title">Members · {selected.size} selected</div>
        <ContactPicker users={contacts} selected={selected} onToggle={(id) => setSelected(toggleIn(selected, id))} />
        <div className="modal-actions">
          <button className="secondary-button" onClick={() => setMode("chat")}>Back</button>
          <button className="primary-button" disabled={busy || !groupName.trim() || selected.size === 0}
            onClick={createGroup}>Create</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New chat" onClose={onClose}>
      <label className="search-box">
        <Icon name="search" size={18} />
        <input autoFocus placeholder="Name or phone number" value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <button className="action-row" onClick={() => setMode("group")}>
        <span className="action-row-icon"><Icon name="group" /></span> New group
      </button>
      {canAddPhone && (
        <button className="action-row" disabled={busy} onClick={addContact}>
          <span className="action-row-icon"><Icon name="personAdd" /></span> Add {phone} to contacts
        </button>
      )}
      <div className="list-section-title">Contacts</div>
      {matches.map((u) => <ContactRow key={u.id} user={u} onClick={() => startChat(u.id)} />)}
      {matches.length === 0 && !canAddPhone && <p className="empty-text">No contacts found</p>}
    </Modal>
  );
}
