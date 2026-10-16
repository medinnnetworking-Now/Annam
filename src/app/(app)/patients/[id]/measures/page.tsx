import { patientView } from '@/lib/view';
import { can } from '@/lib/auth/roles';
import { FIELDS, IDRS_ACTIVITY_OPTIONS, TOBACCO_OPTIONS } from '@/lib/measures';
import { bmi } from '@/lib/scoring';
import { ACCEPTS_DATA } from '@/lib/workflow';
import { VisitButton } from './VisitDialog';

const yn = (b: boolean | null) => (b === null ? '' : b ? 'Yes' : 'No');

export default async function Measures({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await patientView(id);
  const vs = v.assessments;
  const canRecord = can(v.s.role, 'visit.create') && ACCEPTS_DATA.includes(v.b.patient.state);
  const hasBaseline = v.b.visits.some(x => x.label === 'Baseline');
  const lifestyle: [string, (r: (typeof vs)[number]['visit']) => string][] = [
    ['Activity, minutes a week', r => r.activity_minutes?.toString() ?? ''],
    ['Sleep, hours a night', r => r.sleep_hours?.toString() ?? ''],
    ['Tobacco', r => TOBACCO_OPTIONS.find(o => o[0] === r.tobacco)?.[1] ?? ''],
    ['Lives with an indoor smoker', r => yn(r.secondhand_smoke)],
    ['Activity type (IDRS)', r => IDRS_ACTIVITY_OPTIONS.find(o => o[0] === r.idrs_activity)?.[1] ?? ''],
    ['Diagnosed diabetes', r => yn(r.has_diabetes)],
    ['Blood pressure medicine', r => yn(r.on_bp_meds)],
    ['Cholesterol medicine', r => yn(r.on_lipid_meds)]
  ];
  return (
    <>
      <div className="toolbar" style={{ justifyContent: 'space-between' }}>
        <p className="muted" style={{ margin: 0, maxWidth: '62ch' }}>Measures, labs and the patient’s answers, by visit. The score and risk recalculate from the latest visit.</p>
        {canRecord && <VisitButton patientId={id} first={!hasBaseline} today={v.today} />}
      </div>
      {vs.length ? (
        <div className="tablewrap" tabIndex={0} role="region" aria-label="Measures by visit">
          <table>
            <thead><tr><th scope="col">Measure</th>{vs.map(x => <th key={x.visit.id} scope="col" className="num">{x.visit.label}<br /><span className="muted" style={{ fontWeight: 400 }}>{x.visit.visit_date}</span></th>)}</tr></thead>
            <tbody>
              <tr><th scope="row">BMI <span className="muted">kg/m²</span></th>{vs.map(x => <td key={x.visit.id} className="num">{bmi(x.a.effective.values) ?? ''}</td>)}</tr>
              {FIELDS.map(f => (
                <tr key={f.key}><th scope="row">{f.label} <span className="muted">{f.unit}</span></th>
                  {vs.map(x => <td key={x.visit.id} className="num">{(x.visit[f.key] as number | null) ?? (x.a.effective.carried[f.key] ? <span className="muted" title={`Carried forward from ${x.a.effective.carried[f.key]}`}>({x.a.effective.values[f.key] as number})</span> : '')}</td>)}
                </tr>
              ))}
              {lifestyle.map(([label, fn]) => <tr key={label}><th scope="row">{label}</th>{vs.map(x => <td key={x.visit.id} className="num">{fn(x.visit)}</td>)}</tr>)}
              <tr><th scope="row">Health score</th>{vs.map(x => <td key={x.visit.id} className="num"><b>{x.a.result.score ?? '–'}</b></td>)}</tr>
              <tr><th scope="row">Entered by</th>{vs.map(x => <td key={x.visit.id} className="num muted">{x.visit.entered_by}</td>)}</tr>
            </tbody>
          </table>
        </div>
      ) : <div className="empty">No visits recorded yet.{canRecord ? ' Record the baseline to start.' : ''}</div>}
      <p className="muted small">Values in brackets are carried forward from an earlier visit. HbA1c reflects about three months of glucose, so expect it to change at 12 weeks rather than at week 3.</p>
    </>
  );
}
