import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { openDb, type Db } from '../db';
import { addDays, adherence, programmeDay, todayIST, weekOf } from '../programme';
import { CONSENT_VERSION } from '../../content/consent';
import { acknowledgeAlert, changeState, createPatient, exportPatient, getPatient, listPatients, withdrawConsent } from './patients';
import { recordVisit } from './visits';
import { deletePlate, getPhoto, reviewPlate, saveWeeklyReview, uploadPlate } from './plates';
import { approveReport, listReports, saveDraft } from './reports';
import { auditLog, cohort, runRetention } from './admin';
import { Forbidden, UserError, type Ctx } from './context';
import { isJpeg, stripJpegMetadata } from './jpeg';
import { hashPassword, verifyPassword } from '../auth/password';
import { base32Encode, totpCode, verifyTotp } from '../auth/totp';
import { afterFailedSignIn, can } from '../auth/roles';

const clinic: Ctx = { role: 'clinic', actor: { account: 'rmclinic', staff: 'Test clinic staff' } };
const nutri: Ctx = { role: 'nutritionist', actor: { account: 'nutritionist', staff: 'Test nutritionist' } };
const admin: Ctx = { role: 'admin', actor: { account: 'admin', staff: 'Test admin' } };
const today = todayIST();

const newPatient = (over: Record<string, unknown> = {}) => ({
  name: 'Test patient', dob: '1979-05-01', sex: 'M', referrer: 'Dr Test', family_history: 'one', triage: [],
  consent: true, consent_version: CONSENT_VERSION, ...over
});
const baseline = (over: Record<string, unknown> = {}) => ({
  label: 'Baseline', visit_date: addDays(today, -1), weight: '78', height: '168', waist: '98', sbp: '142', dbp: '90', fpg: '138', hba1c: '7.1',
  tc: '212', hdl: '38', tg: '210', activity_minutes: '60', sleep_hours: '6.5', tobacco: 'never', secondhand_smoke: 'no', idrs_activity: 'mild',
  on_bp_meds: 'no', on_lipid_meds: 'no', has_diabetes: 'no', ...over
});
// A tiny valid JPEG with an APP1 (EXIF) segment holding fake GPS text.
const exif = Buffer.from('Exif\0\0GPS-LATITUDE-9.9312');
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8]),
  Buffer.from([0xff, 0xe1, 0, exif.length + 2]), exif,
  Buffer.from([0xff, 0xdb, 0, 4, 0, 0]),
  Buffer.from([0xff, 0xda, 0, 2, 1, 2, 3, 0xff, 0xd9])
]);

let db: Db;
// ANNAM_TEST_DATABASE_URL runs these tests against a real Postgres server (an empty database) instead of PGlite.
beforeAll(async () => { db = await openDb(process.env.ANNAM_TEST_DATABASE_URL ?? 'memory://'); });
afterAll(async () => { await db.close(); });

describe('roles', () => {
  it('match the access table', () => {
    expect(can('clinic', 'patient.create')).toBe(true);
    expect(can('nutritionist', 'patient.create')).toBe(false);
    expect(can('nutritionist', 'plate.review')).toBe(true);
    expect(can('clinic', 'plate.review')).toBe(false);
    expect(can('admin', 'patient.view')).toBe(false);
    expect(can('admin', 'audit.view')).toBe(true);
    expect(can('clinic', 'audit.view')).toBe(false);
  });
});

describe('patients and consent', () => {
  it('cannot be created without consent, at the API as well as the form', async () => {
    await expect(createPatient(db, clinic, newPatient({ consent: false }))).rejects.toBeInstanceOf(UserError);
    await expect(createPatient(db, clinic, newPatient({ consent: undefined }))).rejects.toBeInstanceOf(UserError);
  });
  it('rejects an old consent version', async () => {
    await expect(createPatient(db, clinic, newPatient({ consent_version: 'old' }))).rejects.toThrow(/consent text has changed/);
  });
  it('rejects children and future dates of birth', async () => {
    await expect(createPatient(db, clinic, newPatient({ dob: addDays(today, -365 * 10) }))).rejects.toThrow(/adults/);
  });
  it('only clinic staff can add patients; admin sees no patients', async () => {
    await expect(createPatient(db, nutri, newPatient())).rejects.toBeInstanceOf(Forbidden);
    await expect(listPatients(db, admin)).rejects.toBeInstanceOf(Forbidden);
  });
  it('creates the patient, the consent record and an audit trail without clinical values', async () => {
    const id = await createPatient(db, clinic, newPatient({ name: 'Audit check' }));
    const b = await getPatient(db, nutri, id);
    expect(b.patient.code).toMatch(/^AN-\d{4}$/);
    expect(b.patient.state).toBe('consented');
    expect(b.consents[0]).toMatchObject({ version: CONSENT_VERSION, recorded_by: 'Test clinic staff' });
    const ev = await db.query<{ action: string; table_name: string; meta: unknown; staff_name: string }>('select action, table_name, meta, staff_name from audit_events where patient_id = $1', [id]);
    expect(ev.map(e => `${e.action}:${e.table_name}`)).toEqual(expect.arrayContaining(['insert:patients', 'insert:consents']));
    expect(JSON.stringify(ev)).not.toContain('Audit check');
    expect(ev[0]!.staff_name).toBe('Test clinic staff');
  });
  it('triage flags make the patient not suitable until a doctor and the clinical lead clear them', async () => {
    const id = await createPatient(db, clinic, newPatient({ triage: ['kidney'] }));
    expect((await getPatient(db, clinic, id)).patient.state).toBe('not_suitable');
    await expect(changeState(db, clinic, id, { to: 'cleared', doctorName: 'Dr A' })).rejects.toThrow(/clinical lead/);
    await changeState(db, clinic, id, { to: 'cleared', doctorName: 'Dr A', leadName: 'Lead B' });
    expect((await getPatient(db, clinic, id)).patient).toMatchObject({ state: 'cleared', cleared_by_doctor: 'Dr A', cleared_by_lead: 'Lead B' });
  });
  it('refuses moves that skip steps', async () => {
    const id = await createPatient(db, clinic, newPatient());
    await expect(changeState(db, clinic, id, { to: 'active' })).rejects.toThrow(/cannot move/);
    await expect(changeState(db, nutri, id, { to: 'paused', reason: 'x' })).rejects.toBeInstanceOf(Forbidden);
  });
});

describe('minimal data entry', () => {
  it('needs only name, sex, age and consent', async () => {
    const id = await createPatient(db, clinic, { name: 'Age only', sex: 'F', age: '45', consent: true, consent_version: CONSENT_VERSION });
    const p = (await getPatient(db, clinic, id)).patient;
    expect(p).toMatchObject({ dob_estimated: true, family_history: null, referrer: 'RM Clinic' });
    expect(new Date().getUTCFullYear() - Number(p.dob.slice(0, 4))).toBeGreaterThanOrEqual(45);
    await expect(createPatient(db, clinic, { name: 'No age', sex: 'F', consent: true, consent_version: CONSENT_VERSION })).rejects.toThrow(/age/);
    await expect(createPatient(db, clinic, { name: 'Child', sex: 'F', age: '12', consent: true, consent_version: CONSENT_VERSION })).rejects.toThrow(/adults/);
  });
  it('a visit needs just one value of any kind; the score waits for more', async () => {
    const id = await createPatient(db, clinic, { name: 'One value', sex: 'M', age: '50', consent: true, consent_version: CONSENT_VERSION });
    await expect(recordVisit(db, clinic, id, { label: 'Baseline', visit_date: today })).rejects.toThrow(/at least one/);
    expect((await recordVisit(db, clinic, id, { label: 'Baseline', visit_date: today, sleep_hours: '7' })).ok).toBe(true);
    const b = await getPatient(db, clinic, id);
    expect(b.snapshots[0]).toMatchObject({ score: null, status: 'Not enough data' });
  });
});

describe('the database guards', () => {
  it('refuses writes without a named actor', async () => {
    await expect(db.query(`insert into patients (code, name, dob, sex, referrer, family_history) values ('X', 'x', '1980-01-01', 'M', 'r', 'none')`)).rejects.toThrow(/no actor/);
  });
  it('refuses clinical data for a patient without consent', async () => {
    const id = await createPatient(db, clinic, newPatient());
    await db.tx(clinic.actor, q => q.query('delete from consents where patient_id = $1', [id]));
    await expect(db.tx(clinic.actor, q => q.query(`insert into visits (patient_id, label, visit_date, weight, entered_by) values ($1, 'Baseline', $2, 70, 'x')`, [id, today]))).rejects.toThrow(/consent/);
  });
  it('keeps the audit log append-only', async () => {
    await expect(db.query('delete from audit_events')).rejects.toThrow(/cannot be changed/);
  });
});

describe('the full programme', () => {
  let id = '';
  it('records a baseline: snapshot saved, state moves, warnings need confirmation', async () => {
    id = await createPatient(db, clinic, newPatient());
    expect(await recordVisit(db, clinic, id, baseline({ weight: '20' }))).toEqual({ ok: false, warnings: [expect.stringContaining('Weight 20 kg')] });
    await expect(recordVisit(db, clinic, id, { label: 'Baseline', visit_date: addDays(today, -1) })).rejects.toThrow(/at least one/);
    await expect(recordVisit(db, clinic, id, baseline({ dbp: '' }))).rejects.toThrow(/both systolic/);
    await expect(recordVisit(db, clinic, id, baseline({ visit_date: addDays(today, 2) }))).rejects.toThrow(/future/);
    const r = await recordVisit(db, clinic, id, baseline());
    expect(r.ok).toBe(true);
    const b = await getPatient(db, clinic, id);
    expect(b.patient.state).toBe('baseline_recorded');
    expect(b.snapshots[0]).toMatchObject({ score: 51, category: 'Moderate', measured: 7, status: 'On track' });
    await expect(recordVisit(db, clinic, id, baseline())).rejects.toThrow(/already has a baseline/);
  });
  it('the audit row for a visit holds no measured values', async () => {
    const [ev] = await db.query<{ meta: unknown }>(`select meta from audit_events where patient_id = $1 and table_name = 'visits'`, [id]);
    expect(JSON.stringify(ev)).not.toMatch(/138|212|7\.1/);
  });
  it('clears, starts the programme, and takes plates', async () => {
    await expect(changeState(db, clinic, id, { to: 'cleared' })).rejects.toThrow(/doctor/);
    await changeState(db, clinic, id, { to: 'cleared', doctorName: 'Dr Test' });
    await changeState(db, clinic, id, { to: 'active', startDate: addDays(today, -1) });
    const plateId = await uploadPlate(db, clinic, id, { meal: 'Lunch', eaten_on: today, eaten_at: '13:00', photo: JPEG.toString('base64') });
    const photo = await getPhoto(db, nutri, plateId);
    expect(Buffer.from(photo).includes('GPS')).toBe(false);
    expect(isJpeg(photo)).toBe(true);
    await expect(getPhoto(db, admin, plateId)).rejects.toBeInstanceOf(Forbidden);
    await expect(uploadPlate(db, clinic, id, { meal: 'Lunch', eaten_on: today, eaten_at: '13:00', photo: Buffer.from('not a jpeg').toString('base64') })).rejects.toThrow(/could not be read/);
    await expect(reviewPlate(db, clinic, plateId, { tags: { veg: true, protein: true, grain: true, fruit: false, dairy: false }, flags: { oil: true, sweet: false, upf: false }, score: 8, comment: '' })).rejects.toBeInstanceOf(Forbidden);
    await reviewPlate(db, nutri, plateId, { tags: { veg: true, protein: true, grain: true, fruit: false, dairy: false }, flags: { oil: true, sweet: false, upf: false }, score: 8, comment: 'Less oil.' });
    await expect(deletePlate(db, clinic, plateId)).rejects.toThrow(/Only the nutritionist/);
    const b = await getPatient(db, clinic, id);
    expect(b.plates[0]).toMatchObject({ score: 8, reviewed_by: 'Test nutritionist', has_photo: true });
  });
  it('only nutritionists write weekly reviews', async () => {
    await expect(saveWeeklyReview(db, clinic, id, { week: 1, review: 'x', goals: '', checkin_attended: true })).rejects.toBeInstanceOf(Forbidden);
    await saveWeeklyReview(db, nutri, id, { week: 1, review: 'Good week.', goals: 'Walk daily.', checkin_attended: true });
    await saveWeeklyReview(db, nutri, id, { week: 1, review: 'Good week, edited.', goals: 'Walk daily.', checkin_attended: true });
    expect((await getPatient(db, nutri, id)).reviews).toEqual([expect.objectContaining({ week: 1, review: 'Good week, edited.' })]);
  });
  it('raises an alert for a red flag, which clinic staff acknowledge', async () => {
    const r = await recordVisit(db, clinic, id, { label: 'Other', visit_date: today, sbp: '165', dbp: '95' });
    expect(r.ok).toBe(true);
    const b = await getPatient(db, clinic, id);
    expect(b.alerts[0]!.flags).toEqual(['Blood pressure 160/100 or higher']);
    const snap = b.snapshots.find(s => s.visit_id === (r as { id: string }).id)!;
    expect(snap.status).toBe('See your doctor');
    await expect(acknowledgeAlert(db, nutri, b.alerts[0]!.id, 'Dr Test')).rejects.toBeInstanceOf(Forbidden);
    await acknowledgeAlert(db, clinic, b.alerts[0]!.id, 'Dr Test');
    await expect(acknowledgeAlert(db, clinic, b.alerts[0]!.id, 'Dr Test')).rejects.toThrow(/already/);
  });
  it('records the week 3 visit, drafts, approves and locks the report', async () => {
    await recordVisit(db, clinic, id, { label: 'Week 3 check-in', visit_date: today, weight: '76', waist: '95', sbp: '134', dbp: '84', fpg: '120', activity_minutes: '150' });
    expect((await getPatient(db, clinic, id)).patient.state).toBe('checkin_recorded');
    const draft = await saveDraft(db, nutri, id);
    expect((await getPatient(db, clinic, id)).patient.state).toBe('report_draft');
    const [r1] = await listReports(db, clinic, id);
    expect(r1!.content.score.baseline).toBe(51);
    expect(r1!.content.measures.find(m => m.key === 'weight')).toMatchObject({ baseline: 78, latest: 76 });
    await expect(approveReport(db, nutri, draft, { doctorName: 'Dr Test', nextStep: 'Maintenance', confirmed: true })).rejects.toBeInstanceOf(Forbidden);
    await expect(approveReport(db, clinic, draft, { doctorName: 'Dr Test', nextStep: 'Maintenance', confirmed: false })).rejects.toThrow(/Confirm/);
    await expect(approveReport(db, clinic, draft, { doctorName: '', nextStep: 'Maintenance', confirmed: true })).rejects.toThrow(/name/);
    await approveReport(db, clinic, draft, { doctorName: 'Dr Test', nextStep: 'Maintenance', confirmed: true });
    expect((await getPatient(db, clinic, id)).patient.state).toBe('next_step');
    await expect(db.tx(clinic.actor, q => q.query(`update reports set next_step = 'Condition track' where id = $1`, [draft]))).rejects.toThrow(/cannot be changed/);
    await expect(approveReport(db, clinic, draft, { doctorName: 'Dr Test', nextStep: 'Maintenance', confirmed: true })).rejects.toThrow(/already approved/);
    const second = await saveDraft(db, clinic, id);
    expect(second).not.toBe(draft);
    expect((await listReports(db, clinic, id)).map(r => r.version)).toEqual([2, 1]);
  });
  it('exports the patient’s records and logs it', async () => {
    const out = await exportPatient(db, clinic, id);
    expect(out.visits.length).toBe(3);
    await expect(exportPatient(db, nutri, id)).rejects.toBeInstanceOf(Forbidden);
    const [ev] = await db.query(`select 1 from audit_events where patient_id = $1 and action = 'export'`, [id]);
    expect(ev).toBeTruthy();
  });
  it('withdrawing consent blocks new data straight away', async () => {
    await withdrawConsent(db, clinic, id);
    await expect(recordVisit(db, clinic, id, { label: 'Other', visit_date: today, weight: '75' })).rejects.toThrow(/not accepting/);
    await expect(uploadPlate(db, nutri, id, { meal: 'Lunch', eaten_on: today, eaten_at: '13:00' })).rejects.toThrow();
    await expect(saveWeeklyReview(db, nutri, id, { week: 2, review: 'x', goals: '', checkin_attended: false })).rejects.toThrow(/consent/);
    await expect(saveDraft(db, clinic, id)).rejects.toThrow(/withdrawn/);
  });
});

describe('admin', () => {
  it('cohort hides groups under 5 and is admin or clinic only', async () => {
    const empty = await openDb('memory://');
    expect((await cohort(empty, admin, null, null)).suppressed).toBe(true);
    await empty.close();
    await expect(cohort(db, nutri, null, null)).rejects.toBeInstanceOf(Forbidden);
    const c = await cohort(db, admin, null, null);
    expect(c.suppressed).toBe(false);
    expect(c.enrolled).toBeGreaterThanOrEqual(5);
    expect(JSON.stringify(c)).not.toContain('Test patient');
  });
  it('the audit log is admin only, and viewing it is logged', async () => {
    await expect(auditLog(db, clinic, {}, 'view')).rejects.toBeInstanceOf(Forbidden);
    const rows = await auditLog(db, admin, { account: 'rmclinic' }, 'view');
    expect(rows.every(r => r.account === 'rmclinic')).toBe(true);
    const [last] = await db.query<{ action: string }>('select action from audit_events order by id desc limit 1');
    expect(last!.action).toBe('audit_view');
  });
  it('retention does nothing until a period is set, then deletes withdrawn patients after it', async () => {
    expect(await runRetention(db, null)).toEqual({ deleted: 0, skipped: true });
    const later = new Date(Date.now() + 3 * 86_400_000);
    const r = await runRetention(db, 1, later);
    expect(r.deleted).toBeGreaterThanOrEqual(1);
    const left = await db.query(`select 1 from patients where state = 'withdrawn'`);
    expect(left).toHaveLength(0);
  });
});

describe('helpers', () => {
  it('programme calendar and adherence', () => {
    expect(programmeDay('2026-10-01', '2026-10-01')).toBe(1);
    expect(weekOf('2026-10-01', '2026-10-07')).toBe(1);
    expect(weekOf('2026-10-01', '2026-10-08')).toBe(2);
    const a = adherence('2026-10-01', '2026-10-30', [
      { date: '2026-09-30', reviewed: true }, { date: '2026-10-01', reviewed: true }, { date: '2026-10-01', reviewed: false },
      { date: '2026-10-21', reviewed: true }, { date: '2026-10-22', reviewed: true }
    ], [1, 2, 2, 9]);
    expect(a).toEqual({ daysElapsed: 21, daysLogged: 2, weeksCompleted: 3, checkinsAttended: 2, platesUploaded: 3, platesReviewed: 2 });
    expect(adherence('2026-10-01', '2026-10-01', [], []).weeksCompleted).toBe(0);
  });
  it('sign-in lockout: 5 wrong tries lock it; after the lock runs out the count starts again', () => {
    const now = new Date('2026-10-17T10:00:00Z');
    expect(afterFailedSignIn(3, null, now)).toEqual({ failedAttempts: 4, lock: false });
    expect(afterFailedSignIn(4, null, now)).toEqual({ failedAttempts: 5, lock: true });
    expect(afterFailedSignIn(5, '2026-10-17T09:59:00Z', now)).toEqual({ failedAttempts: 1, lock: false }); // lock expired
    expect(afterFailedSignIn(5, '2026-10-17T10:05:00Z', now)).toEqual({ failedAttempts: 6, lock: true }); // still locked
  });
  it('passwords', () => {
    const h = hashPassword('correct horse');
    expect(verifyPassword('correct horse', h)).toBe(true);
    expect(verifyPassword('wrong', h)).toBe(false);
    expect(verifyPassword('x', '!disabled')).toBe(false);
  });
  it('TOTP matches RFC 6238 test vector', () => {
    const secret = base32Encode(Buffer.from('12345678901234567890'));
    expect(totpCode(secret, 59_000)).toBe('287082');
    expect(verifyTotp(secret, '287082', 59_000)).toBe(true);
    expect(verifyTotp(secret, '000000', 59_000)).toBe(false);
  });
  it('JPEG metadata stripping', () => {
    const out = stripJpegMetadata(JPEG);
    expect(Buffer.from(out).includes('GPS')).toBe(false);
    expect(() => stripJpegMetadata(Buffer.from('nope'))).toThrow();
  });
});
