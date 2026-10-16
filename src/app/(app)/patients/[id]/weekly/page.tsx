import { patientView } from '@/lib/view';
import { can } from '@/lib/auth/roles';
import { addDays, WEEKS } from '@/lib/programme';
import { PLATE_FLAGS } from '@/lib/measures';
import { WeeklyForm } from './WeeklyForm';

const fmtDay = (d: string) => new Date(d + 'T00:00:00Z').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', timeZone: 'UTC' });

export default async function Weekly({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await patientView(id);
  const start = v.b.patient.start_date;
  if (!start || v.day === null || v.day < 1) return <div className="empty">The weekly audit starts once the programme starts.</div>;
  const weeks = Math.max(1, Math.min(WEEKS, Math.ceil(Math.min(v.day, WEEKS * 7) / 7)));
  const canWrite = can(v.s.role, 'review.write') && v.b.patient.state !== 'withdrawn';
  return (
    <>
      {Array.from({ length: weeks }, (_, i) => weeks - i).map(w => {
        const days = Array.from({ length: 7 }, (_, i) => addDays(start, (w - 1) * 7 + i)).filter(d => d <= v.today);
        const wp = v.b.plates.filter(p => days.includes(p.eaten_on));
        const rv = wp.filter(p => p.reviewed_at !== null && p.score !== null);
        const avg = rv.length ? rv.reduce((a, p) => a + p.score!, 0) / rv.length : null;
        const logged = new Set(wp.map(p => p.eaten_on)).size;
        const flags = PLATE_FLAGS.map(([k, l]) => [l, wp.filter(p => p.flags[k]).length] as const).filter(x => x[1] > 0);
        const r = v.b.reviews.find(x => x.week === w);
        return (
          <section className="week" key={w} aria-labelledby={`wk-${w}`}>
            <div className="panel">
              <h2 id={`wk-${w}`}>Week {w}</h2>
              <div className="days">
                {days.map(d => {
                  const ps = rv.filter(p => p.eaten_on === d);
                  const a = ps.length ? ps.reduce((x, p) => x + p.score!, 0) / ps.length : null;
                  return (
                    <div className="drow" key={d}>
                      <span>{fmtDay(d)}</span>
                      <div className={`bar ${a !== null && a < 6 ? 't' : ''}`} role="img" aria-label={`${fmtDay(d)}: ${a === null ? 'no reviewed plates' : `average ${a.toFixed(1)} of 10`}`}><i style={{ width: `${a === null ? 0 : a * 10}%` }} /></div>
                      <span className="num">{a === null ? '' : a.toFixed(1)}</span>
                    </div>
                  );
                })}
              </div>
              <p style={{ margin: '12px 0 0' }}><b>Week score {avg === null ? 'not yet' : `${avg.toFixed(1)} of 10`}.</b> Logged {logged} of {days.length} days. {wp.length - rv.length > 0 ? `${wp.length - rv.length} plates waiting for review. ` : ''}{flags.length ? `Flags: ${flags.map(([l, n]) => `${l.toLowerCase()} ${n}`).join(', ')}.` : 'No flags.'}</p>
            </div>
            <div className="panel">
              <h3>Nutritionist review</h3>
              {canWrite ? <WeeklyForm patientId={id} week={w} review={r?.review ?? ''} goals={r?.goals ?? ''} attended={r?.checkin_attended ?? false} />
                : <>
                  <p>{r?.review ?? <span className="muted">No review yet.</span>}</p>
                  {r?.goals && <p><b>Goals:</b> {r.goals}</p>}
                  <p className="muted">{r?.checkin_attended ? 'Attended the check-in session.' : 'Check-in not recorded.'}</p>
                </>}
              {r && <p className="muted small" style={{ margin: '6px 0 0' }}>Last saved by {r.author} on {r.updated_at.slice(0, 10)}.</p>}
            </div>
          </section>
        );
      })}
    </>
  );
}
