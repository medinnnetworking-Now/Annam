'use server';
// Server actions. Each one checks the session and permission again in the data layer.
import { revalidatePath } from 'next/cache';
import { act, type ActionResult } from '@/lib/server';
import { acknowledgeAlert, changeState, createPatient, withdrawConsent } from '@/lib/data/patients';
import { recordVisit } from '@/lib/data/visits';
import { deletePlate, reviewPlate, saveWeeklyReview, uploadPlate } from '@/lib/data/plates';
import { approveReport, logReportDownload, saveDraft } from '@/lib/data/reports';
import type { EnrolState } from '@/lib/workflow';

const str = (f: FormData, k: string) => String(f.get(k) ?? '');

export async function addPatientAction(_: ActionResult | null, f: FormData): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    const id = await createPatient(db, ctx, {
      name: str(f, 'name'), dob: str(f, 'dob'), sex: str(f, 'sex'), referrer: str(f, 'referrer'), family_history: str(f, 'family_history'),
      triage: f.getAll('triage').map(String), consent: f.get('consent') === 'on' ? true : undefined, consent_version: str(f, 'consent_version')
    });
    revalidatePath('/patients');
    return { ok: true, id, message: 'Patient added' };
  });
}

export async function recordVisitAction(patientId: string, _: ActionResult | null, f: FormData): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    const r = await recordVisit(db, ctx, patientId, Object.fromEntries(f.entries()));
    if (!r.ok) return { ok: false, error: 'Some values are outside the usual range. Check them, then confirm to save.', warnings: r.warnings };
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'Visit recorded' };
  });
}

export async function changeStateAction(patientId: string, _: ActionResult | null, f: FormData): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    await changeState(db, ctx, patientId, { to: str(f, 'to') as EnrolState, reason: str(f, 'reason'), doctorName: str(f, 'doctor'), leadName: str(f, 'lead'), startDate: str(f, 'start') });
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'State changed' };
  });
}

export async function withdrawConsentAction(patientId: string, _: ActionResult | null, f: FormData): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    if (f.get('confirm') !== 'on') return { ok: false, error: 'Tick the box to confirm the patient asked to withdraw.' };
    await withdrawConsent(db, ctx, patientId);
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'Consent withdrawn' };
  });
}

export async function acknowledgeAlertAction(patientId: string, alertId: string, _: ActionResult | null, f: FormData): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    await acknowledgeAlert(db, ctx, alertId, str(f, 'doctor'));
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'Alert acknowledged' };
  });
}

export async function uploadPlateAction(patientId: string, data: { meal: string; eaten_on: string; eaten_at: string; photo?: string }): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    const id = await uploadPlate(db, ctx, patientId, data);
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, id, message: 'Plate uploaded' };
  });
}

export async function reviewPlateAction(patientId: string, plateId: string, data: unknown): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    await reviewPlate(db, ctx, plateId, data);
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'Review saved' };
  });
}

export async function deletePlateAction(patientId: string, plateId: string): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    await deletePlate(db, ctx, plateId);
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'Plate deleted' };
  });
}

export async function weeklyReviewAction(patientId: string, week: number, _: ActionResult | null, f: FormData): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    await saveWeeklyReview(db, ctx, patientId, { week, review: str(f, 'review'), goals: str(f, 'goals'), checkin_attended: f.get('attended') === 'on' });
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'Review saved' };
  });
}

export async function saveDraftAction(patientId: string): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    await saveDraft(db, ctx, patientId);
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'Report draft saved' };
  });
}

export async function approveReportAction(patientId: string, reportId: string, _: ActionResult | null, f: FormData): Promise<ActionResult> {
  return act(async ({ db, ctx }) => {
    await approveReport(db, ctx, reportId, { doctorName: str(f, 'doctor'), nextStep: str(f, 'next_step'), confirmed: f.get('confirm') === 'on' });
    revalidatePath(`/patients/${patientId}`, 'layout');
    return { ok: true, message: 'Report approved' };
  });
}

export async function logPrintAction(reportId: string, kind: 'report' | 'summary'): Promise<ActionResult> {
  return act(async ({ db, ctx }) => { await logReportDownload(db, ctx, reportId, kind); return { ok: true }; });
}
