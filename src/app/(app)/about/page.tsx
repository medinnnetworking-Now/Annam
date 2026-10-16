import type { Metadata } from 'next';
import { SCORE_VERSION } from '@/lib/scoring';

export const metadata: Metadata = { title: 'About' };

export default function About() {
  return (
    <div style={{ maxWidth: 760 }} className="stack">
      <h1>About <span className="ml" lang="ml">അന്നം</span></h1>
      <p className="lede">Annam keeps one profile per patient: the plates they eat, the measures taken at the clinic, a health score, a risk profile, and a report for the doctor who referred them.</p>
      <section className="panel"><h2>Who does what</h2><ul>
        <li><b>RM Clinic staff</b> register patients and record consent, ask the patient each question, enter measures and labs, upload plates the patient shares, tell the doctor about red flags, and record the doctor’s clearance, decision and approval.</li>
        <li><b>The nutritionist</b> reviews and scores every plate, writes the weekly review and records check-ins.</li>
        <li><b>The admin</b> sees cohort totals and the audit log, never patient records.</li>
        <li><b>Doctors</b> decide. Annam calculates and displays; it never makes a treatment decision and never gives medication advice.</li>
      </ul></section>
      <section className="panel"><h2>The score</h2><p>Score version {SCORE_VERSION}: the American Heart Association’s Life’s Essential 8 (2022), with WHO cut-offs for BMI in Asian populations. Risk tools: Indian Diabetes Risk Score, FIB-4, the harmonised metabolic syndrome criteria with South Asian waist cut-offs, waist-to-height ratio and CKD-EPI 2021 eGFR. All are drafts until the clinical lead signs them off.</p></section>
      <section className="panel"><h2>Before real patients</h2><ul>
        <li>Lawyer review of the consent text and privacy notice under the Digital Personal Data Protection Act, 2023.</li>
        <li>Regulatory advice on whether the score counts as medical device software under the Medical Devices Rules, 2017.</li>
        <li>Clinical lead sign-off of the score, risk tools, red flags and the plate rubric.</li>
        <li>Hosting in India (Supabase Mumbai, Vercel Mumbai functions), backups with a tested restore, and processor agreements.</li>
      </ul></section>
    </div>
  );
}
