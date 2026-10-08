/** Signal's mark: a speech bubble inside a dashed ring. Same shapes as app/icon.svg. */
export function SignalLogo({ size = 56 }: { size?: number }) {
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} fill="var(--logo)" aria-label="Signal">
      <circle cx="24" cy="24" r="20" fill="none" stroke="var(--logo)" strokeWidth="3" strokeDasharray="8.4 2.07" />
      <path d="M24 9A15 15 0 1 1 17.66 37.59L9.5 38.5l.91-8.16A15 15 0 0 1 24 9z" />
    </svg>
  );
}
