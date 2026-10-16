// Shared view model for a patient's pages: the bundle plus everything computed from it.
import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { page } from './server';
import { assessAll, getPatient, patientAdherence } from './data/patients';
import { NotFound } from './data/context';
import { programmeDay, todayIST } from './programme';
import { status as statusOf } from './scoring';

export const patientView = cache(async (id: string) => {
  const p = await page();
  let b;
  try { b = await getPatient(p.db, p.ctx, id); } catch (e) { if (e instanceof NotFound) notFound(); throw e; }
  const assessments = assessAll(b);
  const latest = assessments[assessments.length - 1] ?? null;
  const st = latest ? statusOf(latest.a.flags, latest.a.result.score, latest.changeSincePrevious) : null;
  const today = todayIST();
  return {
    ...p, b, assessments, latest, status: st,
    day: b.patient.start_date ? programmeDay(b.patient.start_date, today) : null,
    adherence: patientAdherence(b, today), today,
    openAlerts: b.alerts.filter(a => !a.acknowledged_at),
    consent: b.consents.find(c => !c.withdrawn_at) ?? null
  };
});
export type PatientView = Awaited<ReturnType<typeof patientView>>;
