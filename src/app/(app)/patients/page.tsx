import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { page } from '@/lib/server';
import { can } from '@/lib/auth/roles';
import { listPatients } from '@/lib/data/patients';
import { CONSENT_TEXT, CONSENT_VERSION } from '@/content/consent';
import { PatientList } from './PatientList';

export const metadata: Metadata = { title: 'Patients' };

export default async function Patients() {
  const { s, ctx, db } = await page();
  if (!can(s.role, 'patient.view')) notFound();
  const rows = await listPatients(db, ctx);
  return (
    <>
      <h1>Patients</h1>
      <p className="lede">Everyone in a programme, with their latest score and status. Open a patient to see measures, plates and the report.</p>
      {rows.some(r => r.is_sample) && <p className="notice">Patients named “Sample” are invented, for training and demos. Use real details only once the pilot checklist is signed off.</p>}
      <PatientList rows={rows} canAdd={can(s.role, 'patient.create')} consentText={CONSENT_TEXT} consentVersion={CONSENT_VERSION} />
    </>
  );
}
