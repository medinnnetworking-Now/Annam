import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { page } from '@/lib/server';
import { can } from '@/lib/auth/roles';
import { addDays, programmeDay, todayIST, weekOf } from '@/lib/programme';
import { PROGRAMME_DAYS } from '@/lib/scoring/config';

export const metadata: Metadata = { title: 'Work queue' };

export default async function Queue() {
  const { s, db } = await page();
  if (!can(s.role, 'patient.view')) notFound();
  const today = todayIST();
  const pts = await db.query<{ id: string; name: string; code: string; start_date: string | null; state: string }>(
    `select id, name, code, start_date, state from patients where state in ('active','checkin_due','checkin_recorded','report_draft','baseline_recorded','cleared') order by name`);
  const unreviewed = await db.query<{ patient_id: string; n: number; oldest: string }>(`select patient_id, count(*)::int as n, min(created_at) as oldest from plates where reviewed_at is null group by patient_id`);
  const lastPlate = await db.query<{ patient_id: string; last: string }>(`select patient_id, max(eaten_on) as last from plates group by patient_id`);
  const reviews = await db.query<{ patient_id: string; week: number }>(`select patient_id, week from weekly_reviews where review is not null`);
  const alerts = await db.query<{ patient_id: string; n: number }>(`select patient_id, count(*)::int as n from alerts where acknowledged_at is null group by patient_id`);
  const name = (id: string) => pts.find(p => p.id === id);
  const items: { id: string; who: string; what: string; href: string; urgent?: boolean }[] = [];
  for (const a of alerts) { const p = name(a.patient_id); if (p) items.push({ id: `a${p.id}`, who: p.name, what: `${a.n} red flag alert${a.n > 1 ? 's' : ''} to acknowledge: tell the doctor today`, href: `/patients/${p.id}`, urgent: true }); }
  for (const u of unreviewed) { const p = name(u.patient_id); if (p) items.push({ id: `u${p.id}`, who: p.name, what: `${u.n} plate${u.n > 1 ? 's' : ''} waiting for review${new Date(u.oldest) < new Date(Date.now() - 86_400_000) ? ', oldest more than 24 hours' : ''}`, href: `/patients/${p.id}/plates` }); }
  for (const p of pts) {
    if (!p.start_date || !['active', 'checkin_due'].includes(p.state)) continue;
    const day = programmeDay(p.start_date, today);
    if (day < 1) continue;
    const last = lastPlate.find(l => l.patient_id === p.id)?.last;
    if (day >= 3 && (!last || last < addDays(today, -1))) items.push({ id: `l${p.id}`, who: p.name, what: last ? `No plates since ${last}` : 'No plates logged yet', href: `/patients/${p.id}/plates` });
    const doneWeeks = Math.min(3, Math.floor(Math.min(day - 1, PROGRAMME_DAYS) / 7));
    for (let w = 1; w <= doneWeeks; w++) if (!reviews.some(r => r.patient_id === p.id && r.week === w)) items.push({ id: `w${p.id}${w}`, who: p.name, what: `Week ${w} has no review`, href: `/patients/${p.id}/weekly` });
    if (p.state === 'checkin_due') items.push({ id: `c${p.id}`, who: p.name, what: `Week 3 check-in visit is due (day ${day})`, href: `/patients/${p.id}/measures` });
    void weekOf;
  }
  return (
    <>
      <h1>Work queue</h1>
      <p className="lede">What needs doing today: red flags first, then plates to review, patients who have stopped logging, and weeks without a review.</p>
      {items.length ? (
        <div className="plist">
          {items.map(i => (
            <Link key={i.id} href={i.href} className="prow" style={{ gridTemplateColumns: 'minmax(0,1fr) minmax(0,2fr)' }}>
              <div className="name">{i.who}</div>
              <div className={i.urgent ? '' : 'muted'} style={i.urgent ? { color: '#8A2B18', fontWeight: 600 } : undefined}>{i.what}</div>
            </Link>
          ))}
        </div>
      ) : <div className="empty">Nothing waiting. Well done.</div>}
    </>
  );
}
