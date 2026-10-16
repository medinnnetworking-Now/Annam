'use client';
import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FIELDS, FIELD_GROUPS, IDRS_ACTIVITY_OPTIONS, TOBACCO_OPTIONS, VISIT_LABELS } from '@/lib/measures';
import { recordVisitAction } from '../../../../actions';
import { Dialog, useToast } from '@/components/ui';
import type { ActionResult } from '@/lib/server';

export function VisitButton({ patientId, first, today }: { patientId: string; first: boolean; today: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button className="btn" type="button" onClick={() => setOpen(true)}>{first ? 'Record baseline' : 'Record a visit'}</button>
      {open && <VisitDialog patientId={patientId} first={first} today={today} onClose={() => setOpen(false)} />}
    </>
  );
}

const YesNo = ({ name, label }: { name: string; label: string }) => (
  <label>{label}<select name={name} defaultValue=""><option value="">Not asked</option><option value="no">No</option><option value="yes">Yes</option></select></label>
);

function VisitDialog({ patientId, first, today, onClose }: { patientId: string; first: boolean; today: string; onClose: () => void }) {
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter(); const toast = useToast();
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const r = await recordVisitAction(patientId, null, fd);
      setResult(r);
      if (r.ok) { toast('Visit recorded'); onClose(); router.refresh(); }
    });
  };
  const warnings = result && !result.ok ? result.warnings : undefined;
  return (
    <Dialog open onClose={onClose} title={first ? 'Record baseline' : 'Record a visit'}>
      <p className="muted" style={{ margin: 0 }}>Leave a field empty if it was not measured or asked. Units are shown on each field.</p>
      <form onSubmit={submit} noValidate>
        <div className="form three">
          <label>Visit<select name="label" defaultValue={first ? 'Baseline' : 'Week 3 check-in'}>{VISIT_LABELS.filter(l => first ? l === 'Baseline' : l !== 'Baseline').map(l => <option key={l}>{l}</option>)}</select></label>
          <label>Date<input type="date" name="visit_date" defaultValue={today} max={today} required /></label>
        </div>
        {FIELD_GROUPS.map(g => (
          <fieldset key={g} style={{ marginBottom: 12 }}>
            <legend>{g}</legend>
            <div className="form three" style={{ margin: 0 }}>
              {FIELDS.filter(f => f.group === g).map(f => (
                <label key={f.key}>{f.label} ({f.unit})<input name={f.key} type="number" step={f.step ?? '1'} min="0" inputMode="decimal" /></label>
              ))}
            </div>
          </fieldset>
        ))}
        <fieldset style={{ marginBottom: 12 }}>
          <legend>Ask the patient</legend>
          <div className="form" style={{ margin: 0 }}>
            <label>Minutes of brisk walking or exercise in a usual week<input name="activity_minutes" type="number" min="0" max="3000" inputMode="numeric" /><span className="hint">Moderate or vigorous only.</span></label>
            <label>Hours of sleep on a usual night<input name="sleep_hours" type="number" min="0" max="24" step="0.5" inputMode="decimal" /></label>
            <label>Tobacco, smoked or chewed<select name="tobacco" defaultValue=""><option value="">Not asked</option>{TOBACCO_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <YesNo name="secondhand_smoke" label="Lives with someone who smokes indoors" />
            <label className="full">Work and exercise, for the diabetes risk score<select name="idrs_activity" defaultValue=""><option value="">Not asked</option>{IDRS_ACTIVITY_OPTIONS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
            <YesNo name="has_diabetes" label="A doctor has said they have diabetes" />
            <YesNo name="on_bp_meds" label="Takes blood pressure medicine" />
            <YesNo name="on_lipid_meds" label="Takes cholesterol medicine" />
          </div>
          <p className="muted small" style={{ margin: '6px 0 0' }}>Record only whether medicines are taken. Annam never gives medication advice.</p>
        </fieldset>
        {warnings && (
          <div className="notice" role="alert">
            <b>Check these values.</b>
            <ul style={{ margin: '6px 0' }}>{warnings.map(w => <li key={w}>{w}</li>)}</ul>
            <label className="check" style={{ display: 'flex', gap: 8 }}><input type="checkbox" name="confirmed" /> I checked these values and they are correct.</label>
          </div>
        )}
        {result && !result.ok && !warnings && <p className="err" role="alert">{result.error}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Record visit'}</button></div>
      </form>
    </Dialog>
  );
}
