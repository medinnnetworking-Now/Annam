import Link from 'next/link';
import { patientView } from '@/lib/view';
import { can } from '@/lib/auth/roles';
import { listReports } from '@/lib/data/reports';
import { NEXT_STEPS } from '@/lib/workflow';
import { ReportView } from '@/components/ReportView';
import { ApproveForm, DraftButton, PrintReport } from './ReportActions';

export default async function Report({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await patientView(id);
  const reports = await listReports(v.db, v.ctx, id);
  const canDraft = can(v.s.role, 'report.create') && v.b.visits.length > 0 && v.b.patient.state !== 'withdrawn';
  const r = reports.find(x => String(x.version) === sp.v) ?? reports[0];
  if (!r) {
    return (
      <div className="empty">
        <p>{v.b.visits.length ? 'No report yet. Draft one from the latest data; the doctor reviews and approves it.' : 'The report needs at least a baseline visit.'}</p>
        {canDraft && <DraftButton patientId={id} label="Create report draft" />}
      </div>
    );
  }
  const approval = r.locked
    ? <><p><b>{r.next_step}</b></p><div className="signbox"><b>Approved by {r.approved_by_doctor}</b> on {r.approved_at!.slice(0, 10)}. Recorded by {r.recorded_by}. This version is locked.</div></>
    : can(v.s.role, 'report.approve')
      ? <ApproveForm patientId={id} reportId={r.id} steps={[...NEXT_STEPS]} />
      : <p className="muted">To be decided by the doctor. Clinic staff record the doctor’s decision and approval.</p>;
  return (
    <>
      <div className="toolbar noprint">
        <PrintReport reportId={r.id} />
        {canDraft && !r.locked && <DraftButton patientId={id} label="Refresh draft with latest data" secondary />}
        {canDraft && r.locked && <DraftButton patientId={id} label="Create a new draft" secondary />}
        {r.locked && <Link className="btn ghost" href={`/patients/${id}/report/summary?v=${r.version}`}>Patient summary</Link>}
        {reports.length > 1 && (
          <span className="small muted">Versions: {reports.map(x => <Link key={x.id} href={`?v=${x.version}`} aria-current={x.id === r.id ? 'page' : undefined} style={{ marginRight: 8 }}>{x.version}{x.locked ? ' (approved)' : ' (draft)'}</Link>)}</span>
        )}
      </div>
      {!r.locked && <p className="notice">Draft version {r.version}, made {r.created_at.slice(0, 10)} by {r.created_by}. Refresh it after new data, then the doctor reviews and approves it.</p>}
      <ReportView c={r.content} approval={approval} />
    </>
  );
}
