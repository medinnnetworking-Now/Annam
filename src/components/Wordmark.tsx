export function Mark({ size = 34 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <ellipse cx="20" cy="20" rx="19" ry="12" transform="rotate(-25 20 20)" fill="#5E9A55" />
      <circle cx="20" cy="20" r="10" fill="#fff" />
      <path d="M20 20 L20 10 A10 10 0 0 1 30 20 Z" fill="#E3A03A" />
      <path d="M20 20 L20 30 A10 10 0 0 1 10 20 A10 10 0 0 1 20 10 Z" fill="#7DB06B" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <Mark />
      <span><span className="ml" lang="ml">അന്നം</span><small>Annam</small></span>
    </span>
  );
}
