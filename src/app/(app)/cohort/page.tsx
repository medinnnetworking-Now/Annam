import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { page } from '@/lib/server';
import { can } from '@/lib/auth/roles';
import { cohort, MIN_GROUP } from '@/lib/data/admin';

export const metadata: Metadata = { title: 'Cohort' };

export default async function Cohort({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const { s, ctx, db } = await page();
  if (!can(s.role, 'cohort.view')) notFound();
  const sp = await searchParams;
  const ok = (d?: string) => (d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : null);
  const includeSamples = process.env.NODE_ENV !== 'production';
  const c = await cohort(db, ctx, ok(sp.from), ok(sp.to), includeSamples);
  const tiles: [string, string][] = c.suppressed ? [] : [
    ['Enrolled', String(c.enrolled)], ['In programme', String(c.active)], ['Completed', String(c.completed)], ['Withdrawn', String(c.withdrawn)],
    ['Average score change', c.avgScoreChange === null ? `Fewer than ${MIN_GROUP} with two visits` : `${c.avgScoreChange > 0 ? '+' : ''}${c.avgScoreChange} points`],
    ['Average days logged, of 21', c.avgDaysLogged === null ? '–' : String(c.avgDaysLogged)],
    ['Weeks with a check-in', c.checkinShare === null ? '–' : `${Math.round(c.checkinShare * 100)}%`]
  ];
  return (
    <>
      <h1>Cohort</h1>
      <p className="lede">Programme results as totals only. No names are shown, and any group under {MIN_GROUP} patients is hidden.</p>
      {includeSamples && <p className="notice">Development mode: sample patients are included.</p>}
      <form className="toolbar" method="get">
        <label className="small muted">Enrolled from <input type="date" name="from" defaultValue={sp.from} style={{ minHeight: 44, border: '1px solid var(--color-line)', borderRadius: 8, padding: '6px 8px' }} /></label>
        <label className="small muted">to <input type="date" name="to" defaultValue={sp.to} style={{ minHeight: 44, border: '1px solid var(--color-line)', borderRadius: 8, padding: '6px 8px' }} /></label>
        <button className="btn secondary" type="submit">Show</button>
      </form>
      {c.suppressed ? <div className="empty">Fewer than {MIN_GROUP} patients in this range, so results are hidden to protect privacy.</div> : (
        <div className="grid3">{tiles.map(([k, val]) => <div className="panel" key={k}><div className="muted small">{k}</div><div style={{ fontSize: 26, fontWeight: 700, color: 'var(--color-leaf-deep)' }}>{val}</div></div>)}</div>
      )}
    </>
  );
}
