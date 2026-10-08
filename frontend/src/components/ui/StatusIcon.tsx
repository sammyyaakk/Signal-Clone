import { useId } from "react";
import type { MessageStatus } from "@/lib/types";

const check = (cx: number) => `M${cx - 2.4} 6.1l1.6 1.6 3.2-3.4`;
const LINE = { fill: "none", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

/**
 * Signal's delivery indicators: dashed ring (sending), ring with a check (sent),
 * two overlapping rings (delivered), two filled circles (read).
 */
export function StatusIcon({ status }: { status: MessageStatus }) {
  const maskId = `status-${useId().replace(/[^\w-]/g, "")}`;
  const label = status[0].toUpperCase() + status.slice(1);
  const width = status === "delivered" || status === "read" ? 19 : 12;

  return (
    <svg className={`status-icon ${status}`} viewBox={`0 0 ${width} 12`} width={width} height={12} role="img" aria-label={label}>
      <title>{label}</title>
      {status === "sending" && <circle cx="6" cy="6" r="5" {...LINE} strokeDasharray="2.2 1.7" />}
      {status === "sent" && (
        <>
          <circle cx="6" cy="6" r="5" {...LINE} />
          <path d={check(6)} {...LINE} />
        </>
      )}
      {status === "delivered" && (
        <>
          <mask id={maskId}>
            <rect width="19" height="12" fill="#fff" />
            <circle cx="13" cy="6" r="6" fill="#000" />
          </mask>
          <g mask={`url(#${maskId})`}>
            <circle cx="6" cy="6" r="5" {...LINE} />
            <path d={check(6)} {...LINE} />
          </g>
          <circle cx="13" cy="6" r="5" {...LINE} />
          <path d={check(13)} {...LINE} />
        </>
      )}
      {status === "read" && (
        <>
          <mask id={maskId}>
            <rect width="19" height="12" fill="#fff" />
            <path d={check(6)} {...LINE} stroke="#000" />
            <path d={check(13)} {...LINE} stroke="#000" />
          </mask>
          <g mask={`url(#${maskId})`} fill="currentColor">
            <circle cx="6" cy="6" r="5.6" />
            <circle cx="13" cy="6" r="5.6" />
          </g>
        </>
      )}
    </svg>
  );
}
