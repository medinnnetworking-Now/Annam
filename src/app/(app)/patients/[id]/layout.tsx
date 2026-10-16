import { patientView } from '@/lib/view';
import { STATE_LABELS } from '@/lib/workflow';
import { PROGRAMME_DAYS } from '@/lib/scoring/config';
import { StatusChip } from '@/components/ScoreRing';
import { Tabs } from '@/components/ui';

export default async function PatientLayout({ children, params }: { children: React.ReactNode; params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await patientView(id);
  const p = v.b.patient;
  const dayText = v.day === null ? 'Programme not started' : v.day < 1 ? `Programme starts ${p.start_date}` : v.day > PROGRAMME_DAYS ? `Programme finished (day ${v.day})` : `Day ${v.day} of ${PROGRAMME_DAYS}`;
  return (
    <>
      <div className="phead">
        <div>
          <h1>{p.name}{p.is_sample && <span className="chip flag" style={{ marginLeft: 10, verticalAlign: 'middle' }}>Sample</span>}</h1>
          <div className="meta">{p.code} · {v.latest?.a.age ?? ''} {p.sex === 'F' ? 'female' : 'male'} · referred by {p.referrer} · {STATE_LABELS[p.state]} · {dayText}</div>
        </div>
        <StatusChip status={v.status?.status ?? null} reason={v.status?.reason} />
      </div>
      {v.openAlerts.length > 0 && (
        <p className="notice alert" role="alert"><b>Red flag: tell the doctor today.</b> {v.openAlerts[0]!.flags.join('. ')}. Acknowledge it on the Overview once the doctor has been told.</p>
      )}
      {p.state === 'withdrawn' && <p className="notice">Consent withdrawn. The record is read-only, and it is deleted under the retention policy.</p>}
      <Tabs base={`/patients/${id}`} tabs={[['', 'Overview'], ['measures', 'Measures'], ['plates', 'Plates'], ['weekly', 'Weekly audit'], ['report', 'Report']]} />
      {children}
    </>
  );
}
