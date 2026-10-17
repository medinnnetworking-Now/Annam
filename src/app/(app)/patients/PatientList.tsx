'use client';
import Link from 'next/link';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ListItem } from '@/lib/data/patients';
import { STATE_LABELS } from '@/lib/workflow';
import { TRIAGE_QUESTIONS } from '@/lib/workflow';
import { PROGRAMME_DAYS } from '@/lib/scoring/config';
import { Dialog, Submit, useToast } from '@/components/ui';
import { StatusChip } from '@/components/ScoreRing';
import { addPatientAction } from '../../actions';

export function PatientList({ rows, canAdd, consentText, consentVersion }: { rows: ListItem[]; canAdd: boolean; consentText: string[]; consentVersion: string }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const shown = useMemo(() => { const s = q.trim().toLowerCase(); return s ? rows.filter(r => r.name.toLowerCase().includes(s) || r.code.toLowerCase().includes(s)) : rows; }, [q, rows]);
  return (
    <>
      <div className="toolbar">
        <input type="search" value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or patient code" aria-label="Search patients" aria-controls="plist" />
        {canAdd && <button className="btn" type="button" onClick={() => setOpen(true)}>Add patient</button>}
      </div>
      <p className="sr-only" role="status" aria-live="polite">{shown.length} {shown.length === 1 ? 'patient' : 'patients'} shown</p>
      <div className="plist" id="plist">
        <div className="prow head" aria-hidden="true"><div>Patient</div><div>Programme</div><div>Score</div><div>Status</div><div>Plates</div></div>
        {shown.map(r => (
          <Link key={r.id} className="prow" href={`/patients/${r.id}`}>
            <div>
              <div className="name">{r.name}</div>
              <div className="muted small">{r.code} · {r.age} {r.sex === 'F' ? 'female' : 'male'} · referred by {r.referrer}</div>
            </div>
            <div className="hide-sm small">
              {STATE_LABELS[r.state]}
              <div className="muted">{r.day === null ? 'Not started' : r.day < 1 ? `Starts in ${1 - r.day} days` : r.day > PROGRAMME_DAYS ? `Finished, day ${r.day}` : `Day ${r.day} of ${PROGRAMME_DAYS}`}</div>
            </div>
            <div className="score" aria-label={`Score ${r.score ?? 'not yet'}`}>{r.score ?? '–'}</div>
            <div className="hide-sm"><StatusChip status={r.status} />{r.open_alerts > 0 && <div className="small" style={{ color: '#8A2B18', marginTop: 4 }}>{r.open_alerts} red flag alert{r.open_alerts > 1 ? 's' : ''} open</div>}</div>
            <div className="hide-sm muted small">{r.last_plate ? `Last plate ${r.last_plate}` : 'No plates yet'}{r.unreviewed > 0 && <div>{r.unreviewed} waiting for review</div>}</div>
          </Link>
        ))}
        {!shown.length && <div className="empty">{rows.length ? 'No patients match that search.' : 'No patients yet. Add the first patient at their walk-in.'}</div>}
      </div>
      {canAdd && <AddPatient open={open} onClose={() => setOpen(false)} consentText={consentText} consentVersion={consentVersion} />}
    </>
  );
}

function AddPatient({ open, onClose, consentText, consentVersion }: { open: boolean; onClose: () => void; consentText: string[]; consentVersion: string }) {
  const [state, action] = useActionState(addPatientAction, null);
  const router = useRouter(); const toast = useToast();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (state?.ok && state.id) { toast('Patient added'); onClose(); router.push(`/patients/${state.id}/measures`); } }, [state]);
  return (
    <Dialog open={open} onClose={onClose} title="Add patient">
      <p className="muted" style={{ margin: 0 }}>Ask the patient each question and enter their answers. Measures come next.</p>
      <form action={action} className="form">
        <label className="full">Full name<input name="name" required maxLength={80} autoComplete="off" /></label>
        <label>Sex<select name="sex" required defaultValue=""><option value="" disabled>Choose</option><option value="F">Female</option><option value="M">Male</option></select></label>
        <label>Age<input name="age" type="number" inputMode="numeric" min={18} max={110} /><span className="hint">Or fill in the birth date below.</span></label>
        <p className="muted small full" style={{ margin: 0 }}>Optional. Fill in if you have it, or leave empty.</p>
        <label>Date of birth<input name="dob" type="date" /></label>
        <label>Referred by<input name="referrer" placeholder="RM Clinic" maxLength={80} /></label>
        <label className="full">Family history of diabetes
          <select name="family_history" defaultValue=""><option value="">Not asked</option><option value="none">Neither parent</option><option value="one">One parent</option><option value="both">Both parents</option></select>
        </label>
        <fieldset className="full">
          <legend>Safety questions. Tick any that apply.</legend>
          <p className="muted small" style={{ margin: '0 0 6px' }}>Any tick marks the patient “not suitable” until a doctor and the clinical lead clear them.</p>
          <div className="form one" style={{ margin: 0 }}>
            {TRIAGE_QUESTIONS.map(([k, label]) => <label key={k} className="check"><input type="checkbox" name="triage" value={k} />{label}</label>)}
          </div>
        </fieldset>
        <div className="full">
          <div className="field">Consent text, version {consentVersion}</div>
          <div className="consent" tabIndex={0} aria-label="Consent text">{consentText.map((p, i) => <p key={i}>{p}</p>)}</div>
        </div>
        <label className="check full"><input type="checkbox" name="consent" required /> I read this to the patient, and they gave their consent to join and to share their data with the care team.</label>
        <input type="hidden" name="consent_version" value={consentVersion} />
        {state && !state.ok && <p className="err full" role="alert">{state.error}</p>}
        <div className="actions full"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><Submit>Add patient</Submit></div>
      </form>
    </Dialog>
  );
}
