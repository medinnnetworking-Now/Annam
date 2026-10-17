// Patients, consent, enrolment state, score snapshots and alerts.
import { SYSTEM, type Db, type Q } from '../db';
import { assess, comparableChange, MEASURE_KEYS, type Assessment, type PatientCore, type Visit } from '../scoring';
import { SCORE_VERSION } from '../scoring/config';
import { patientSchema } from '../measures';
import { addDays, adherence, programmeDay, todayIST } from '../programme';
import { canMove, CHECKIN_DUE_FROM_DAY, clearanceNeeds, type EnrolState } from '../workflow';
import { check, friendly, isUuid, NotFound, UserError, type Ctx } from './context';
import { CONSENT_VERSION } from '../../content/consent';

export const DEFAULT_REFERRER = 'RM Clinic';

export interface PatientRow {
  id: string; code: string; name: string; dob: string; sex: 'M' | 'F'; referrer: string; programme: string; start_date: string | null;
  family_history: 'none' | 'one' | 'both' | null; dob_estimated: boolean; triage: string[]; state: EnrolState; cleared_by_doctor: string | null; cleared_by_lead: string | null;
  is_sample: boolean; created_at: string;
}
export interface VisitRow extends Record<string, unknown> {
  id: string; patient_id: string; label: string; visit_date: string; entered_by: string; created_at: string;
  activity_minutes: number | null; sleep_hours: number | null; tobacco: Visit['tobacco']; secondhand_smoke: boolean | null;
  idrs_activity: Visit['idrsActivity']; on_bp_meds: boolean | null; on_lipid_meds: boolean | null; has_diabetes: boolean | null; warnings_confirmed: string[];
}
export interface PlateRow {
  id: string; patient_id: string; eaten_on: string; eaten_at: string; meal: string; has_photo: boolean;
  tags: Record<string, boolean>; flags: Record<string, boolean>; score: number | null; comment: string | null;
  uploaded_by: string; reviewed_by: string | null; reviewed_at: string | null;
}
export interface ReviewRow { week: number; review: string | null; goals: string | null; checkin_attended: boolean; author: string; updated_at: string }
export interface SnapshotRow {
  visit_id: string; score_version: string; score: number | null; category: string | null; measured: number; status: string; reasons: string[];
  change_since_baseline: number | null; change_since_previous: number | null;
}
export interface AlertRow { id: string; visit_id: string | null; flags: string[]; created_at: string; acknowledged_at: string | null; acknowledged_by: string | null; doctor_informed: string | null }
export interface ConsentRow { id: string; version: string; recorded_by: string; recorded_at: string; withdrawn_at: string | null; withdrawn_by: string | null }

export const toScoringVisit = (r: VisitRow): Visit => ({
  id: r.id, date: r.visit_date, label: r.label,
  ...Object.fromEntries(MEASURE_KEYS.map(k => [k, r[k] as number | null])),
  activityMinutes: r.activity_minutes, sleepHours: r.sleep_hours, tobacco: r.tobacco, secondhandSmoke: r.secondhand_smoke,
  idrsActivity: r.idrs_activity, onBpMeds: r.on_bp_meds, onLipidMeds: r.on_lipid_meds, hasDiabetes: r.has_diabetes
});
export const core = (p: PatientRow): PatientCore => ({ dob: p.dob, sex: p.sex, family: p.family_history });
export const plateForScore = (p: PlateRow) => ({ date: p.eaten_on, score: p.score, reviewed: p.reviewed_at !== null });

const PLATE_COLS = `id, patient_id, eaten_on, eaten_at, meal, photo is not null as has_photo, tags, flags, score, comment, uploaded_by, reviewed_by, reviewed_at`;

export interface Bundle {
  patient: PatientRow; visits: VisitRow[]; plates: PlateRow[]; reviews: ReviewRow[]; snapshots: SnapshotRow[];
  alerts: AlertRow[]; consents: ConsentRow[];
}

export async function loadBundle(q: Q, id: string): Promise<Bundle | null> {
  if (!isUuid(id)) return null;
  const [patient] = await q.query<PatientRow>('select * from patients where id = $1', [id]);
  if (!patient) return null;
  const [visits, plates, reviews, snapshots, alerts, consents] = await Promise.all([
    q.query<VisitRow>('select * from visits where patient_id = $1 order by visit_date, created_at', [id]),
    q.query<PlateRow>(`select ${PLATE_COLS} from plates where patient_id = $1 order by eaten_on, eaten_at`, [id]),
    q.query<ReviewRow>('select week, review, goals, checkin_attended, author, updated_at from weekly_reviews where patient_id = $1 order by week', [id]),
    q.query<SnapshotRow>('select visit_id, score_version, score, category, measured, status, reasons, change_since_baseline, change_since_previous from score_snapshots where patient_id = $1', [id]),
    q.query<AlertRow>('select id, visit_id, flags, created_at, acknowledged_at, acknowledged_by, doctor_informed from alerts where patient_id = $1 order by created_at desc', [id]),
    q.query<ConsentRow>('select id, version, recorded_by, recorded_at, withdrawn_at, withdrawn_by from consents where patient_id = $1 order by recorded_at', [id])
  ]);
  return { patient, visits, plates, reviews, snapshots, alerts, consents };
}

/** Assessments for every visit, oldest first, with comparable changes. Pure: computed from the bundle. */
export function assessAll(b: Bundle): { visit: VisitRow; a: Assessment; changeSinceBaseline: number | null; changeSincePrevious: number | null }[] {
  const visits = b.visits.map(toScoringVisit); const plates = b.plates.map(plateForScore);
  const out: { visit: VisitRow; a: Assessment; changeSinceBaseline: number | null; changeSincePrevious: number | null }[] = [];
  b.visits.forEach((row, i) => {
    const a = assess(core(b.patient), visits.slice(0, i + 1), row.visit_date, plates); // only this visit and earlier ones
    const first = out[0]?.a, prev = out[i - 1]?.a;
    out.push({
      visit: row, a,
      changeSinceBaseline: first ? comparableChange(first.result.components, a.result.components)?.change ?? null : null,
      changeSincePrevious: prev ? comparableChange(prev.result.components, a.result.components)?.change ?? null : null
    });
  });
  return out;
}

/**
 * Save a score snapshot for each visit with the current score version, and raise an alert for any
 * visit with red flags. Snapshots saved under an older version are kept unchanged.
 */
export async function refreshSnapshots(q: Q, patientId: string) {
  const b = await loadBundle(q, patientId); if (!b) return;
  const { status } = await import('../scoring');
  for (const r of assessAll(b)) {
    const existing = b.snapshots.find(s => s.visit_id === r.visit.id);
    if (existing && existing.score_version !== SCORE_VERSION) continue;
    const st = status(r.a.flags, r.a.result.score, r.changeSincePrevious);
    const values = [
      patientId, r.visit.id, SCORE_VERSION, r.a.result.score, r.a.result.category, r.a.result.measured, JSON.stringify(r.a.result.components),
      r.a.idrs?.score ?? null, r.a.fib4?.score ?? null, r.a.egfr?.value ?? null, r.a.whtr?.ratio ?? null, r.a.metSyn.present,
      st.status, st.status === 'See your doctor' ? r.a.flags : [st.reason], r.changeSinceBaseline, r.changeSincePrevious
    ];
    await q.query(
      `insert into score_snapshots (patient_id, visit_id, score_version, score, category, measured, components, idrs, fib4, egfr, whtr, met_syn, status, reasons, change_since_baseline, change_since_previous)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
       on conflict (visit_id) do update set score = excluded.score, category = excluded.category, measured = excluded.measured, components = excluded.components,
         idrs = excluded.idrs, fib4 = excluded.fib4, egfr = excluded.egfr, whtr = excluded.whtr, met_syn = excluded.met_syn, status = excluded.status,
         reasons = excluded.reasons, change_since_baseline = excluded.change_since_baseline, change_since_previous = excluded.change_since_previous
       where score_snapshots.score is distinct from excluded.score or score_snapshots.status is distinct from excluded.status
          or score_snapshots.reasons is distinct from excluded.reasons or score_snapshots.components is distinct from excluded.components
          or score_snapshots.change_since_baseline is distinct from excluded.change_since_baseline`, values);
    if (r.a.flags.length && !b.alerts.some(al => al.visit_id === r.visit.id))
      await q.query('insert into alerts (patient_id, visit_id, flags) values ($1, $2, $3)', [patientId, r.visit.id, r.a.flags]);
  }
}

/** Move programmes on day 19 or later to "check-in due". Runs as the system. */
export async function refreshDueStates(db: Db) {
  const today = todayIST();
  const due = await db.query<{ id: string }>(`select id from patients where state = 'active' and start_date is not null and start_date <= $1::date - $2::int`, [today, CHECKIN_DUE_FROM_DAY - 1]);
  for (const { id } of due) await db.tx(SYSTEM, async q => {
    await q.query(`update patients set state = 'checkin_due' where id = $1 and state = 'active'`, [id]);
    await q.query(`insert into audit_events (account, staff_name, action, table_name, row_id, patient_id, meta) values ('system', 'System', 'state_change', 'patients', $1, $1, $2)`, [id, JSON.stringify({ from: 'active', to: 'checkin_due' })]);
  });
}

export interface ListItem {
  id: string; code: string; name: string; age: number; sex: 'M' | 'F'; referrer: string; state: EnrolState; start_date: string | null;
  day: number | null; score: number | null; status: string | null; last_plate: string | null; unreviewed: number; open_alerts: number; is_sample: boolean;
}

export async function listPatients(db: Db, ctx: Ctx, search = ''): Promise<ListItem[]> {
  check(ctx, 'patient.view');
  await refreshDueStates(db);
  const today = todayIST();
  const rows = await db.query<Omit<ListItem, 'age' | 'day'> & { dob: string }>(`
    select p.id, p.code, p.name, p.dob, p.sex, p.referrer, p.state, p.start_date, p.is_sample,
      (select s.score from score_snapshots s join visits v on v.id = s.visit_id where s.patient_id = p.id order by v.visit_date desc, v.created_at desc limit 1) as score,
      (select s.status from score_snapshots s join visits v on v.id = s.visit_id where s.patient_id = p.id order by v.visit_date desc, v.created_at desc limit 1) as status,
      (select max(eaten_on) from plates where patient_id = p.id) as last_plate,
      (select count(*)::int from plates where patient_id = p.id and reviewed_at is null) as unreviewed,
      (select count(*)::int from alerts where patient_id = p.id and acknowledged_at is null) as open_alerts
    from patients p
    where $1 = '' or p.name ilike '%' || $1 || '%' or p.code ilike '%' || $1 || '%'
    order by p.created_at desc`, [search.trim().slice(0, 80)]);
  const { ageOn } = await import('../scoring');
  return rows.map(r => ({ ...r, age: ageOn(r.dob, today), day: r.start_date ? programmeDay(r.start_date, today) : null }));
}

export async function getPatient(db: Db, ctx: Ctx, id: string): Promise<Bundle> {
  check(ctx, 'patient.view');
  await refreshDueStates(db);
  const b = await loadBundle(db, id);
  if (!b) throw new NotFound();
  return b;
}

let codeLock: Promise<unknown> = Promise.resolve();
export async function createPatient(db: Db, ctx: Ctx, raw: unknown): Promise<string> {
  check(ctx, 'patient.create');
  const parsed = patientSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]!.message);
  const v = parsed.data;
  if (v.consent_version !== CONSENT_VERSION) throw new UserError('The consent text has changed. Reload the page and read the new text to the patient.');
  // Only an age given: store an estimated date of birth in the middle of that birth year.
  const dob = v.dob ?? `${new Date().getUTCFullYear() - v.age! - (new Date().getUTCMonth() < 6 ? 1 : 0)}-07-01`;
  const run = codeLock.then(() => db.tx(ctx.actor, async q => {
    const state: EnrolState = v.triage.length ? 'not_suitable' : 'consented';
    const [{ id }] = await q.query<{ id: string }>(
      `insert into patients (code, name, dob, dob_estimated, sex, referrer, family_history, triage, state)
       values ('AN-' || lpad(nextval('patient_code_seq')::text, 4, '0'), $1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [v.name, dob, !v.dob, v.sex, v.referrer || DEFAULT_REFERRER, v.family_history ?? null, JSON.stringify(v.triage), state]) as [{ id: string }];
    await q.query('insert into consents (patient_id, version, recorded_by) values ($1, $2, $3)', [id, v.consent_version, ctx.actor.staff]);
    return id;
  }));
  codeLock = run.catch(() => undefined);
  return run;
}

export interface StateChange { to: EnrolState; reason?: string; doctorName?: string; leadName?: string; startDate?: string }

export async function changeState(db: Db, ctx: Ctx, id: string, change: StateChange) {
  check(ctx, 'patient.state');
  const b = await loadBundle(db, id); if (!b) throw new NotFound();
  const from = b.patient.state, to = change.to;
  if (!canMove(from, to)) throw new UserError(`A patient cannot move from ${from.replace('_', ' ')} to ${to.replace('_', ' ')}.`);
  const sets: string[] = ['state = $2']; const params: unknown[] = [id, to];
  if (to === 'cleared') {
    const needs = clearanceNeeds(from, b.patient.triage);
    if (!change.doctorName?.trim()) throw new UserError('Enter the name of the doctor who cleared the patient.');
    if (needs.clinicalLead && !change.leadName?.trim()) throw new UserError('This patient was flagged at triage. Enter the clinical lead who also cleared them.');
    params.push(change.doctorName.trim().slice(0, 80)); sets.push(`cleared_by_doctor = $${params.length}`);
    params.push(change.leadName?.trim().slice(0, 80) || null); sets.push(`cleared_by_lead = $${params.length}`);
  }
  if (to === 'active' && !b.patient.start_date) {
    const start = change.startDate && /^\d{4}-\d{2}-\d{2}$/.test(change.startDate) ? change.startDate : todayIST();
    if (start < addDays(todayIST(), -7) || start > addDays(todayIST(), 30)) throw new UserError('Choose a start date within the last week or the next 30 days.');
    params.push(start); sets.push(`start_date = $${params.length}`);
  }
  if (['not_suitable', 'paused'].includes(to) && !change.reason?.trim()) throw new UserError('Give a short reason for this change.');
  await db.tx(ctx.actor, async q => {
    await q.query(`update patients set ${sets.join(', ')} where id = $1`, params);
    await q.query(`insert into audit_events (account, staff_name, action, table_name, row_id, patient_id, meta) values ($1, $2, 'state_change', 'patients', $3, $3, $4)`,
      [ctx.actor.account, ctx.actor.staff, id, JSON.stringify({ from, to, reason: change.reason?.trim().slice(0, 200) ?? null })]);
  });
}

/** Internal: automatic state moves made alongside another save. */
export async function autoState(q: Q, ctx: Ctx, id: string, from: EnrolState[], to: EnrolState) {
  const r = await q.query<{ state: EnrolState }>(`update patients p set state = $2 from (select state from patients where id = $1) old
     where p.id = $1 and p.state = any($3::text[]) returning old.state`, [id, to, from]);
  if (r[0]) await q.query(`insert into audit_events (account, staff_name, action, table_name, row_id, patient_id, meta) values ($1, $2, 'state_change', 'patients', $3, $3, $4)`,
    [ctx.actor.account, ctx.actor.staff, id, JSON.stringify({ from: r[0].state, to, automatic: true })]);
}

export async function withdrawConsent(db: Db, ctx: Ctx, id: string) {
  check(ctx, 'consent.withdraw');
  const b = await loadBundle(db, id); if (!b) throw new NotFound();
  if (b.patient.state === 'withdrawn') throw new UserError('Consent is already withdrawn.');
  await db.tx(ctx.actor, async q => {
    await q.query('update consents set withdrawn_at = now(), withdrawn_by = $2 where patient_id = $1 and withdrawn_at is null', [id, ctx.actor.staff]);
    await q.query(`update patients set state = 'withdrawn' where id = $1`, [id]);
    await q.query(`insert into audit_events (account, staff_name, action, table_name, row_id, patient_id, meta) values ($1, $2, 'consent_withdrawn', 'consents', $3, $3, '{}')`, [ctx.actor.account, ctx.actor.staff, id]);
  });
}

export async function acknowledgeAlert(db: Db, ctx: Ctx, alertId: string, doctorInformed: string) {
  check(ctx, 'alert.acknowledge');
  if (!isUuid(alertId)) throw new NotFound();
  if (!doctorInformed.trim()) throw new UserError('Enter the doctor who was told about the red flag.');
  await db.tx(ctx.actor, async q => {
    const r = await q.query('update alerts set acknowledged_at = now(), acknowledged_by = $2, doctor_informed = $3 where id = $1 and acknowledged_at is null returning id', [alertId, ctx.actor.staff, doctorInformed.trim().slice(0, 80)]);
    if (!r.length) throw new UserError('This alert is already acknowledged.');
  });
}

/** Everything held about a patient, for their own copy. Logged. */
export async function exportPatient(db: Db, ctx: Ctx, id: string) {
  check(ctx, 'patient.export');
  const b = await loadBundle(db, id); if (!b) throw new NotFound();
  const reports = await db.query('select version, content, next_step, approved_by_doctor, approved_at, locked, created_at from reports where patient_id = $1 order by version', [id]);
  await db.query(`insert into audit_events (account, staff_name, action, table_name, row_id, patient_id) values ($1, $2, 'export', 'patients', $3, $3)`, [ctx.actor.account, ctx.actor.staff, id]);
  return { exported_at: new Date().toISOString(), format: 'annam-patient-export-1', ...b, reports };
}

export function patientAdherence(b: Bundle, upTo = todayIST()) {
  if (!b.patient.start_date) return null;
  return adherence(b.patient.start_date, upTo, b.plates.map(p => ({ date: p.eaten_on, reviewed: p.reviewed_at !== null })), b.reviews.filter(r => r.checkin_attended).map(r => r.week));
}

export { friendly };
