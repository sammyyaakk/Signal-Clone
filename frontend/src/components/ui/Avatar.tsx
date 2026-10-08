import { initials } from "@/lib/format";

interface Props {
  name: string;
  color: string;
  size?: number;
  online?: boolean;
}

/** Signal-style avatar: initials in the user's color on a pale tint of it. */
export function Avatar({ name, color, size = 48, online }: Props) {
  return (
    <div
      className="avatar"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.38,
        color,
        background: `color-mix(in srgb, ${color} 18%, #fff)`,
      }}
    >
      {initials(name) || "?"}
      {online && <span className="avatar-online" />}
    </div>
  );
}
