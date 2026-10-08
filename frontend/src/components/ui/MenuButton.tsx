import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export interface MenuItem {
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
}

interface Props {
  label: string;
  icon: ReactNode;
  items: MenuItem[];
  /** Open above the button (for message actions near the composer). */
  up?: boolean;
  /** Grow to the right of the button instead of the left. */
  alignLeft?: boolean;
}

/** An icon button with a dropdown menu; closes on outside click, Escape, or selection. */
export function MenuButton({ label, icon, items, up, alignLeft }: Props) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (!anchorRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={`menu-anchor${open ? " open" : ""}`} ref={anchorRef}>
      <button className="icon-button" aria-label={label} aria-haspopup="menu" aria-expanded={open}
        onClick={() => setOpen(!open)}>
        {icon}
      </button>
      {open && (
        <div className={`menu${up ? " up" : ""}${alignLeft ? " align-left" : ""}`} role="menu">
          {items.map(({ label: itemLabel, icon: ItemIcon, onSelect }) => (
            <button key={itemLabel} role="menuitem" className="menu-item"
              onClick={() => { setOpen(false); onSelect(); }}>
              <ItemIcon size={18} />
              {itemLabel}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
