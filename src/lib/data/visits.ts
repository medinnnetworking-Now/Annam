// Recording visits: measures, lifestyle answers and medicines, asked of the patient by clinic staff.
import type { Db } from '../db';
import { plausibilityWarnings, visitSchema, FIELDS } from '../measures';
import { ACCEPTS_DATA } from '../workflow';
import { autoState, loadBundle, refreshSnapshots } from './patients';
import { check, friendly, NotFound, UserError, type Ctx } from './context';
import { todayIST } from '../programme';

export type RecordVisitResult = { ok: true; id: string } | { ok: false; warnings: string[] };

export async function recordVisit(db: Db, ctx: Ctx, patientId: string, raw: unknown): Promise<RecordVisitResult> {
  check(ctx, 'visit.create');
  const b = await loadBundle(db, patientId); if (!b) throw new NotFound();
  if (!ACCEPTS_DATA.includes(b.patient.state)) throw new UserError('This patient is not accepting new data. Check their consent and state.');
  const parsed = visitSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]!.message);
  const v = parsed.data;
  if (v.visit_date > todayIST()) throw new UserError('A visit cannot be in the future. Check the date.');
  const warnings = plausibilityWarnings(v);
  if (warnings.length && !v.confirmed) return { ok: false, warnings };
  if (v.label === 'Baseline' && b.visits.some(x => x.label === 'Baseline')) throw new UserError('This patient already has a baseline. Choose another visit type.');
  if (v.label !== 'Baseline' && !b.visits.length) throw new UserError('Record the baseline first.');
  const cols = [...FIELDS.map(f => f.key), 'activity_minutes', 'sleep_hours', 'tobacco', 'secondhand_smoke', 'idrs_activity', 'on_bp_meds', 'on_lipid_meds', 'has_diabetes'] as const;
  try {
    return await db.tx(ctx.actor, async q => {
      const [{ id }] = await q.query<{ id: string }>(
        `insert into visits (patient_id, label, visit_date, ${cols.join(', ')}, warnings_confirmed, entered_by)
         values ($1, $2, $3, ${cols.map((_, i) => `$${i + 4}`).join(', ')}, $${cols.length + 4}, $${cols.length + 5}) returning id`,
        [patientId, v.label, v.visit_date, ...cols.map(c => v[c]), warnings, ctx.actor.staff]) as [{ id: string }];
      if (v.label === 'Baseline') await autoState(q, ctx, patientId, ['consented'], 'baseline_recorded');
      if (v.label === 'Week 3 check-in') await autoState(q, ctx, patientId, ['active', 'checkin_due'], 'checkin_recorded');
      await refreshSnapshots(q, patientId);
      return { ok: true as const, id };
    });
  } catch (e) { friendly(e); }
}
