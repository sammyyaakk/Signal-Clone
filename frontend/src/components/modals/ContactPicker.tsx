import type { User } from "@/lib/types";
import { ContactRow } from "../ui/ContactRow";

interface Props {
  users: User[];
  selected: Set<number>;
  onToggle: (id: number) => void;
}

/** Checkbox list of users, shared by "new group" and "add members". */
export function ContactPicker({ users, selected, onToggle }: Props) {
  if (users.length === 0) return <p className="empty-text">No contacts to add</p>;
  return (
    <div className="picker">
      {users.map((u) => (
        <ContactRow key={u.id} user={u} onClick={() => onToggle(u.id)}
          trailing={<input type="checkbox" readOnly checked={selected.has(u.id)} />} />
      ))}
    </div>
  );
}

export function toggleIn(set: Set<number>, id: number): Set<number> {
  const next = new Set(set);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}
