export function ScoreRing({ score, change }: { score: number | null; change: number | null }) {
  const r = 62, C = 2 * Math.PI * r, s = score ?? 0;
  return (
    <div className="ring">
      <svg width="150" height="150" viewBox="0 0 150 150" aria-hidden="true">
        <circle cx="75" cy="75" r={r} fill="none" stroke="#E6EDE7" strokeWidth="14" />
        <circle className="fg" cx="75" cy="75" r={r} fill="none" stroke="#2E6B47" strokeWidth="14" strokeLinecap="round" strokeDasharray={C.toFixed(1)} strokeDashoffset={(C * (1 - s / 100)).toFixed(1)} />
      </svg>
      <div className="val">
        <div>
          <b>{score ?? '–'}</b><br />
          <span>{change === null ? (score === null ? 'Not enough data' : 'Health score, of 100') : `${change >= 0 ? '+' : ''}${change} points since baseline`}</span>
        </div>
      </div>
    </div>
  );
}

export function Spark({ values, colour, label }: { values: (number | null)[]; colour: string; label: string }) {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 2) return <p className="muted small" style={{ margin: '6px 0 0' }}>{v.length ? `One reading so far: ${v[0]}` : 'No readings yet'}</p>;
  const w = 220, h = 60, min = Math.min(...v), max = Math.max(...v), rng = max - min || 1;
  const pts = v.map((x, i) => [8 + (i * (w - 16)) / (v.length - 1), h - 8 - ((x - min) * (h - 16)) / rng] as const);
  return (
    <>
      <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <polyline fill="none" stroke={colour} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={pts.map(p => p.map(n => n.toFixed(1)).join(',')).join(' ')} />
        {pts.map((p, i) => <circle key={i} cx={p[0].toFixed(1)} cy={p[1].toFixed(1)} r="4" fill={colour} />)}
      </svg>
      <p className="muted small" style={{ margin: 0 }}><span className="sr-only">{label}: </span>{v.join(' → ')}</p>
    </>
  );
}

export const statusClass = (s: string | null) => s === 'On track' ? 'ok' : s === 'Needs attention' ? 'warn' : s === 'See your doctor' ? 'alert' : 'flag';
export const riskClass = (c: string | null | undefined) => !c ? 'flag' : c === 'Low' ? 'ok' : c === 'High' ? 'alert' : 'warn';

export function StatusChip({ status, reason }: { status: string | null; reason?: string | null }) {
  return <span className={`chip ${statusClass(status)}`} title={reason ?? undefined}>{status ?? 'No score yet'}</span>;
}
