import type { ReactNode } from "react";
import type { User } from "@/lib/types";
import { Avatar } from "./Avatar";

interface Props {
  user: User;
  subtitle?: string;
  onClick?: () => void;
  trailing?: ReactNode;
}

/** A user row used by contact pickers, search results and member lists. */
export function ContactRow({ user, subtitle, onClick, trailing }: Props) {
  return (
    <div className={`contact-row${onClick ? " clickable" : ""}`} onClick={onClick}>
      <Avatar name={user.display_name} color={user.avatar_color} size={36} />
      <div className="contact-row-text">
        <div className="contact-row-name">{user.display_name}</div>
        <div className="contact-row-sub">{subtitle ?? (user.about || user.phone)}</div>
      </div>
      {trailing}
    </div>
  );
}
