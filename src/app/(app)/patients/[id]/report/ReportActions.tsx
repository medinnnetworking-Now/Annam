'use client';
import { useActionState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { approveReportAction, logPrintAction, saveDraftAction } from '../../../../actions';
import { PrintButton, Submit, useToast } from '@/components/ui';

export function DraftButton({ patientId, label, secondary }: { patientId: string; label: string; secondary?: boolean }) {
  const [pending, start] = useTransition();
  const toast = useToast(); const router = useRouter();
  return <button type="button" className={secondary ? 'btn secondary' : 'btn'} disabled={pending} onClick={() => start(async () => {
    const r = await saveDraftAction(patientId); toast(r.ok ? 'Report draft saved' : r.error); router.push('?'); router.refresh();
  })}>{pending ? 'Saving…' : label}</button>;
}

export function PrintReport({ reportId, kind = 'report' }: { reportId: string; kind?: 'report' | 'summary' }) {
  return <PrintButton onPrint={() => { void logPrintAction(reportId, kind); }} />;
}

export function ApproveForm({ patientId, reportId, steps }: { patientId: string; reportId: string; steps: string[] }) {
  const [state, action] = useActionState(approveReportAction.bind(null, patientId, reportId), null);
  const toast = useToast();
  useEffect(() => { if (state?.ok) toast('Report approved'); }, [state, toast]);
  return (
    <form action={action} className="form noprint" style={{ margin: 0 }}>
      <label className="full">Next step chosen by the doctor
        <select name="next_step" required defaultValue=""><option value="" disabled>Choose the next step</option>{steps.map(s => <option key={s}>{s}</option>)}</select>
      </label>
      <label className="full">Doctor’s name<input name="doctor" required maxLength={80} /></label>
      <label className="check full"><input type="checkbox" name="confirm" required /> The doctor reviewed this report and approved it, with the next step above.</label>
      {state && !state.ok && <p className="err full" role="alert">{state.error}</p>}
      <div className="actions full"><Submit>Approve report</Submit></div>
    </form>
  );
}
