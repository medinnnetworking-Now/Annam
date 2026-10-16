'use client';
import { useActionState, useEffect, useState } from 'react';
import { acknowledgeAlertAction, changeStateAction, withdrawConsentAction } from '../../../actions';
import { Dialog, Submit, useToast } from '@/components/ui';
import { TRIAGE_QUESTIONS, type EnrolState } from '@/lib/workflow';
import type { ActionResult } from '@/lib/server';

interface Props {
  patientId: string; state: EnrolState; stateLabel: string; moves: { to: EnrolState; label: string }[]; needsLead: boolean; hasStart: boolean; today: string;
  canChange: boolean; canWithdraw: boolean; canExport: boolean; canAck: boolean; alerts: { id: string; flags: string[]; at: string }[];
  consent: { version: string; by: string; at: string } | null; triage: string[]; clearedBy: string | null; clearedLead: string | null;
}

function useDone(state: ActionResult | null, then?: () => void) {
  const toast = useToast();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (state?.ok) { if (state.message) toast(state.message); then?.(); } }, [state]);
}

export function Enrolment(p: Props) {
  const [move, setMove] = useState<EnrolState | null>(null);
  const [withdraw, setWithdraw] = useState(false);
  const triageText = p.triage.map(t => TRIAGE_QUESTIONS.find(q => q[0] === t)?.[1] ?? t);
  return (
    <section className="panel" aria-labelledby="h-enrol">
      <h2 id="h-enrol">Enrolment</h2>
      <p style={{ margin: '0 0 6px' }}>State: <b>{p.stateLabel}</b>{p.clearedBy && <span className="muted"> · cleared by {p.clearedBy}{p.clearedLead ? ` and ${p.clearedLead}` : ''}</span>}</p>
      <p className="muted small" style={{ margin: '0 0 6px' }}>{p.consent ? `Consent version ${p.consent.version}, recorded by ${p.consent.by} on ${p.consent.at.slice(0, 10)}.` : 'No current consent.'}</p>
      {triageText.length > 0 && <p className="small" style={{ margin: '0 0 6px' }}>Flagged at triage: {triageText.join('; ')}.</p>}
      {p.alerts.map(a => <AlertAck key={a.id} patientId={p.patientId} alert={a} canAck={p.canAck} />)}
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        {p.canChange && p.moves.map(m => <button key={m.to} type="button" className={m.to === 'not_suitable' || m.to === 'paused' ? 'btn ghost' : 'btn secondary'} onClick={() => setMove(m.to)}>{m.to === 'cleared' ? 'Record doctor clearance' : m.to === 'active' ? 'Start programme' : `Mark ${m.label.toLowerCase()}`}</button>)}
        {p.canExport && <a className="btn ghost" href={`/api/patients/${p.patientId}/export`}>Export patient data</a>}
        {p.canWithdraw && <button type="button" className="btn danger" onClick={() => setWithdraw(true)}>Withdraw consent</button>}
      </div>
      {move && <MoveDialog {...p} to={move} onClose={() => setMove(null)} />}
      {withdraw && <WithdrawDialog patientId={p.patientId} onClose={() => setWithdraw(false)} />}
    </section>
  );
}

function MoveDialog({ patientId, to, needsLead, hasStart, today, onClose }: Props & { to: EnrolState; onClose: () => void }) {
  const [state, action] = useActionState(changeStateAction.bind(null, patientId), null);
  useDone(state, onClose);
  const title = to === 'cleared' ? 'Record doctor clearance' : to === 'active' ? 'Start the programme' : to === 'paused' ? 'Pause the programme' : to === 'not_suitable' ? 'Mark not suitable' : 'Change state';
  return (
    <Dialog open onClose={onClose} title={title}>
      <form action={action} className="form one">
        <input type="hidden" name="to" value={to} />
        {to === 'cleared' && <>
          <p className="muted" style={{ margin: 0 }}>The doctor sets the safety limits at the consult. Record who cleared the patient to join.</p>
          <label>Doctor’s name<input name="doctor" required maxLength={80} /></label>
          {needsLead && <label>Clinical lead’s name<input name="lead" required maxLength={80} /><span className="hint">Needed because the patient was flagged at triage.</span></label>}
        </>}
        {to === 'active' && !hasStart && <label>Programme start date<input type="date" name="start" defaultValue={today} required /><span className="hint">Day 1 of the 21 days. Weeks follow this date.</span></label>}
        {(to === 'paused' || to === 'not_suitable') && <label>Reason<input name="reason" required maxLength={200} /><span className="hint">Short, and without clinical values.</span></label>}
        {state && !state.ok && <p className="err" role="alert">{state.error}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><Submit>{title}</Submit></div>
      </form>
    </Dialog>
  );
}

function WithdrawDialog({ patientId, onClose }: { patientId: string; onClose: () => void }) {
  const [state, action] = useActionState(withdrawConsentAction.bind(null, patientId), null);
  useDone(state, onClose);
  return (
    <Dialog open onClose={onClose} title="Withdraw consent">
      <p>New data stops straight away. The record becomes read-only and is deleted under the retention policy. Offer the patient a copy of their data first.</p>
      <form action={action} className="form one">
        <label className="check"><input type="checkbox" name="confirm" required /> The patient asked to withdraw their consent.</label>
        {state && !state.ok && <p className="err" role="alert">{state.error}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><Submit className="btn danger">Withdraw consent</Submit></div>
      </form>
    </Dialog>
  );
}

function AlertAck({ patientId, alert, canAck }: { patientId: string; alert: { id: string; flags: string[]; at: string }; canAck: boolean }) {
  const [state, action] = useActionState(acknowledgeAlertAction.bind(null, patientId, alert.id), null);
  useDone(state);
  return (
    <div className="notice alert" style={{ margin: '8px 0' }}>
      <b>Red flag raised {alert.at.slice(0, 10)}:</b> {alert.flags.join('. ')}.
      {canAck ? (
        <form action={action} className="form" style={{ margin: '8px 0 0' }}>
          <label>Doctor told<input name="doctor" required maxLength={80} /></label>
          <div style={{ display: 'flex', alignItems: 'flex-end' }}><Submit className="btn secondary">Acknowledge alert</Submit></div>
          {state && !state.ok && <p className="err full" role="alert">{state.error}</p>}
        </form>
      ) : <p className="small" style={{ margin: '4px 0 0' }}>Clinic staff tell the doctor and acknowledge this alert.</p>}
    </div>
  );
}
