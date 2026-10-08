import { SmilePlus } from "lucide-react";
import { usePopover } from "@/hooks/usePopover";
import type { Reaction } from "@/lib/types";

/** Signal's quick-reaction set. */
const QUICK_REACTIONS = ["❤️", "👍", "👎", "😂", "😮", "😢"];

interface PickerProps {
  current?: string; // my reaction on this message, if any
  onPick: (emoji: string) => void;
  alignLeft: boolean;
}

/** The react button and its floating emoji pill. */
export function ReactionPicker({ current, onPick, alignLeft }: PickerProps) {
  const { open, setOpen, anchorRef } = usePopover();

  return (
    <div className={`menu-anchor${open ? " open" : ""}`} ref={anchorRef}>
      <button className="icon-button" aria-label="React" aria-expanded={open} onClick={() => setOpen(!open)}>
        <SmilePlus size={18} />
      </button>
      {open && (
        <div className={`reaction-picker${alignLeft ? " align-left" : ""}`} role="menu">
          {QUICK_REACTIONS.map((emoji) => (
            <button key={emoji} role="menuitem" aria-label={`React with ${emoji}`}
              className={emoji === current ? "selected" : ""}
              onClick={() => { setOpen(false); onPick(emoji); }}>
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface ChipsProps {
  reactions: Reaction[];
  meId: number;
  onToggle: (emoji: string) => void;
}

/** Reaction chips under a bubble: one per emoji with a count; mine is highlighted. */
export function ReactionChips({ reactions, meId, onToggle }: ChipsProps) {
  const groups = new Map<string, { count: number; mine: boolean }>();
  for (const r of reactions) {
    const group = groups.get(r.emoji) ?? { count: 0, mine: false };
    group.count += 1;
    group.mine ||= r.user_id === meId;
    groups.set(r.emoji, group);
  }

  return (
    <div className="reactions">
      {[...groups].map(([emoji, { count, mine }]) => (
        <button key={emoji} className={`reaction-chip${mine ? " mine" : ""}`} onClick={() => onToggle(emoji)}
          aria-label={`${emoji} ${count}${mine ? ", including you" : ""}`}>
          {emoji}
          {count > 1 && <span>{count}</span>}
        </button>
      ))}
    </div>
  );
}
