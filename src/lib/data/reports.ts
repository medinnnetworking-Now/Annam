// Reports: a draft built from the record, the doctor's decision and approval (recorded by clinic staff
// with the doctor's name), and locking. Approved versions never change.
import type { Db } from '../db';
import { NEXT_STEPS, type NextStep } from '../workflow';
import { FIELDS } from '../measures';
import { bmi, SCORE_VERSION } from '../scoring';
import { todayIST } from '../programme';
import { assessAll, autoState, loadBundle, patientAdherence, type Bundle } from './patients';
import { check, friendly, isUuid, NotFound, UserError, type Ctx } from './context';

export interface ReportRow {
  id: string; version: number; content: ReportContent; next_step: NextStep | null; approved_by_doctor: string | null;
  recorded_by: string | null; approved_at: string | null; locked: boolean; created_by: string; created_at: string;
}

export function buildReportContent(b: Bundle) {
  const all = assessAll(b);
  const first = all[0], last = all[all.length - 1];
  if (!first || !last) throw new UserError('The report needs at least a baseline visit.');
  const measureRows = [{ key: 'bmi', label: 'BMI', unit: 'kg/m²' }, ...FIELDS.map(f => ({ key: f.key as string, label: f.label, unit: f.unit }))].map(f => {
    const val = (a: typeof first) => f.key === 'bmi' ? bmi(a.a.effective.values) : (a.visit[f.key] as number | null) ?? null;
    return { ...f, baseline: val(first), latest: all.length > 1 ? val(last) : null };
  }).filter(r => r.baseline !== null || r.latest !== null);
  const reviewed = b.plates.filter(p => p.reviewed_at && p.score !== null);
  const latestReview = [...b.reviews].reverse().find(r => r.review);
  return {
    score_version: SCORE_VERSION,
    generated_on: todayIST(),
    patient: { code: b.patient.code, name: b.patient.name, sex: b.patient.sex, age: last.a.age, referrer: b.patient.referrer, programme: b.patient.programme, start_date: b.patient.start_date, is_sample: b.patient.is_sample },
    from: { label: first.visit.label, date: first.visit.visit_date },
    to: all.length > 1 ? { label: last.visit.label, date: last.visit.visit_date } : null,
    score: { baseline: first.a.result.score, latest: last.a.result.score, category: last.a.result.category, change: last.changeSinceBaseline, measured: last.a.result.measured },
    components: last.a.result.components.map(c => ({ name: c.name, points: c.points, baseline: first.a.result.components.find(x => x.key === c.key)?.points ?? null })),
    risk: {
      idrs: last.a.idrs, idrs_baseline: first.a.idrs, fib4: last.a.fib4, whtr: last.a.whtr, egfr: last.a.egfr,
      met_syn: last.a.metSyn.present, met_syn_met: last.a.metSyn.met
    },
    measures: measureRows,
    adherence: patientAdherence(b),
    average_plate: reviewed.length ? Math.round((reviewed.reduce((a, p) => a + (p.score as number), 0) / reviewed.length) * 10) / 10 : null,
    review: latestReview ? { week: latestReview.week, text: latestReview.review, goals: latestReview.goals } : null,
    red_flags: last.a.flags,
    alerts: b.alerts.map(a => ({ flags: a.flags, raised: a.created_at, doctor_informed: a.doctor_informed }))
  };
}
export type ReportContent = ReturnType<typeof buildReportContent>;

export async function listReports(db: Db, ctx: Ctx, patientId: string): Promise<ReportRow[]> {
  check(ctx, 'patient.view');
  if (!isUuid(patientId)) throw new NotFound();
  return db.query<ReportRow>('select id, version, content, next_step, approved_by_doctor, recorded_by, approved_at, locked, created_by, created_at from reports where patient_id = $1 order by version desc', [patientId]);
}

/** Create a draft, or refresh the open draft with the latest data. */
export async function saveDraft(db: Db, ctx: Ctx, patientId: string): Promise<string> {
  check(ctx, 'report.create');
  const b = await loadBundle(db, patientId); if (!b) throw new NotFound();
  if (b.patient.state === 'withdrawn') throw new UserError('Consent is withdrawn, so no new report can be made.');
  const content = buildReportContent(b);
  const toVisit = b.visits[b.visits.length - 1]!.id, fromVisit = b.visits[0]!.id;
  try {
    return await db.tx(ctx.actor, async q => {
      const [open] = await q.query<{ id: string }>('select id from reports where patient_id = $1 and not locked order by version desc limit 1', [patientId]);
      if (open) {
        await q.query('update reports set content = $2, from_visit = $3, to_visit = $4 where id = $1', [open.id, JSON.stringify(content), fromVisit, toVisit]);
        return open.id;
      }
      const [r] = await q.query<{ id: string }>(
        `insert into reports (patient_id, version, from_visit, to_visit, content, created_by)
         values ($1, coalesce((select max(version) from reports where patient_id = $1), 0) + 1, $2, $3, $4, $5) returning id`,
        [patientId, fromVisit, toVisit, JSON.stringify(content), ctx.actor.staff]);
      await autoState(q, ctx, patientId, ['checkin_recorded', 'next_step', 'report_approved'], 'report_draft');
      return r!.id;
    });
  } catch (e) { friendly(e); }
}

export interface Approval { doctorName: string; nextStep: string; confirmed: boolean }

/** Record the doctor's next step and approval. Locks the version. */
export async function approveReport(db: Db, ctx: Ctx, reportId: string, a: Approval) {
  check(ctx, 'report.approve');
  if (!isUuid(reportId)) throw new NotFound();
  if (!a.doctorName.trim()) throw new UserError('Enter the name of the doctor who approved the report.');
  if (!(NEXT_STEPS as readonly string[]).includes(a.nextStep)) throw new UserError('Choose the next step the doctor decided.');
  if (!a.confirmed) throw new UserError('Confirm that the doctor reviewed and approved this report.');
  const [r] = await db.query<{ patient_id: string; locked: boolean }>('select patient_id, locked from reports where id = $1', [reportId]);
  if (!r) throw new NotFound();
  if (r.locked) throw new UserError('This report is already approved.');
  try {
    await db.tx(ctx.actor, async q => {
      await q.query(`update reports set next_step = $2, approved_by_doctor = $3, recorded_by = $4, approved_at = now(), locked = true where id = $1`,
        [reportId, a.nextStep, a.doctorName.trim().slice(0, 80), ctx.actor.staff]);
      await q.query(`insert into audit_events (account, staff_name, action, table_name, row_id, patient_id, meta) values ($1, $2, 'report_approved', 'reports', $3, $4, $5)`,
        [ctx.actor.account, ctx.actor.staff, reportId, r.patient_id, JSON.stringify({ next_step: a.nextStep })]);
      await autoState(q, ctx, r.patient_id, ['report_draft', 'checkin_recorded', 'active', 'checkin_due'], 'next_step');
    });
  } catch (e) { friendly(e); }
}

export async function logReportDownload(db: Db, ctx: Ctx, reportId: string, kind: 'report' | 'summary') {
  check(ctx, 'patient.view');
  if (!isUuid(reportId)) throw new NotFound();
  const [r] = await db.query<{ patient_id: string }>('select patient_id from reports where id = $1', [reportId]);
  if (!r) throw new NotFound();
  await db.query(`insert into audit_events (account, staff_name, action, table_name, row_id, patient_id, meta) values ($1, $2, 'print', 'reports', $3, $4, $5)`,
    [ctx.actor.account, ctx.actor.staff, reportId, r.patient_id, JSON.stringify({ kind })]);
}
