import Link from 'next/link';
import { patientView } from '@/lib/view';
import { listReports } from '@/lib/data/reports';
import { summaryFor } from '@/content/summary';
import { PrintReport } from '../ReportActions';

export default async function Summary({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ v?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await patientView(id);
  const reports = await listReports(v.db, v.ctx, id);
  const r = reports.find(x => String(x.version) === sp.v && x.locked) ?? reports.find(x => x.locked);
  if (!r) return <div className="empty">The patient summary is ready once the doctor approves the report.</div>;
  const s = summaryFor(r.content, r.next_step!);
  return (
    <>
      <div className="toolbar noprint"><PrintReport reportId={r.id} kind="summary" /><Link className="btn ghost" href={`/patients/${id}/report?v=${r.version}`}>Back to the report</Link></div>
      <article className="report" lang="en">
        <div className="rhead">
          <div><div className="ml" lang="ml">അന്നം</div><b>{s.title}</b></div>
          <div className="small" style={{ textAlign: 'right' }}><b>{r.content.patient.name}</b><br />{r.content.patient.code}<br />{r.approved_at!.slice(0, 10)}{r.content.patient.is_sample && <><br /><span className="sample-mark">Sample data</span></>}</div>
        </div>
        {s.sections.map(sec => <section key={sec.heading}><h3>{sec.heading}</h3>{sec.lines.map((l, i) => <p key={i}>{l}</p>)}</section>)}
        <p className="disclaimer">{s.footer}</p>
      </article>
    </>
  );
}
