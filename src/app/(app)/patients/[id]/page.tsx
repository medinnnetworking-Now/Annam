import Link from 'next/link';
import { patientView } from '@/lib/view';
import { can } from '@/lib/auth/roles';
import { bmi } from '@/lib/scoring';
import { MIN_COMPONENTS_FOR_SCORE, PROGRAMME_DAYS } from '@/lib/scoring/config';
import { MANUAL, STATE_LABELS, clearanceNeeds } from '@/lib/workflow';
import { ScoreRing, Spark, StatusChip, riskClass } from '@/components/ScoreRing';
import { Enrolment } from './Enrolment';

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const v = await patientView(id);
  const p = v.b.patient;
  const L = v.latest;
  const enrolment = (
    <Enrolment
      patientId={id} state={p.state} stateLabel={STATE_LABELS[p.state]} moves={(MANUAL[p.state] ?? []).map(to => ({ to, label: STATE_LABELS[to] }))}
      needsLead={clearanceNeeds(p.state, p.triage).clinicalLead} hasStart={!!p.start_date} today={v.today}
      canChange={can(v.s.role, 'patient.state')} canWithdraw={can(v.s.role, 'consent.withdraw') && p.state !== 'withdrawn'} canExport={can(v.s.role, 'patient.export')}
      canAck={can(v.s.role, 'alert.acknowledge')} alerts={v.openAlerts.map(a => ({ id: a.id, flags: a.flags, at: a.created_at }))}
      consent={v.consent ? { version: v.consent.version, by: v.consent.recorded_by, at: v.consent.recorded_at } : null}
      triage={p.triage} clearedBy={p.cleared_by_doctor} clearedLead={p.cleared_by_lead}
    />
  );
  if (!L) {
    return (
      <div className="stack">
        <div className="empty">
          <p>No measures yet. Record the baseline measures, labs and lifestyle answers to calculate the first score.</p>
          {can(v.s.role, 'visit.create') && p.state !== 'withdrawn' && <Link className="btn" href={`/patients/${id}/measures`}>Record baseline</Link>}
        </div>
        {enrolment}
      </div>
    );
  }
  const r = L.a.result;
  const series = (k: 'weight' | 'waist' | 'sbp') => v.assessments.map(x => (x.visit[k] as number | null) ?? null);
  const groups = (['Behaviour', 'Health factor'] as const).map(g => ({ g, cs: r.components.filter(c => c.group === g) }));
  const ad = v.adherence;
  return (
    <div className="stack">
      <div className="grid2">
        <section className="panel" aria-labelledby="h-score">
          <h2 id="h-score">Health score</h2>
          <div className="scorebox">
            <ScoreRing score={r.score} change={v.assessments.length > 1 ? L.changeSinceBaseline : null} />
            <div>
              {r.category && <p style={{ margin: '0 0 10px' }}><b>{r.category}</b> <span className="muted small">(80 or more is high, 50 to 79 moderate, under 50 low)</span></p>}
              {groups.map(({ g, cs }) => (
                <div key={g} style={{ marginBottom: 8 }}>
                  <div className="muted small" style={{ fontWeight: 600, margin: '0 0 4px' }}>{g === 'Behaviour' ? 'Behaviours' : 'Health factors'}</div>
                  {cs.map(c => (
                    <div className="comp" key={c.key} title={c.detail}>
                      <div className="lab"><span>{c.name}</span><span>{c.points === null ? 'Not measured' : `${c.points} of 100`}</span></div>
                      <div className={`bar ${g === 'Behaviour' ? 't' : ''}`} role="img" aria-label={`${c.name}: ${c.points === null ? 'not measured' : `${c.points} of 100`}. ${c.detail}`}><i style={{ width: `${c.points ?? 0}%` }} /></div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
          {!r.complete && <p className="muted small" style={{ margin: '8px 0 0' }}>Based on the data recorded so far: {r.measured} of 8 measures.{r.score === null ? ` A score needs at least ${MIN_COMPONENTS_FOR_SCORE}.` : ''} Change since baseline uses only measures recorded both times.</p>}
          {Object.keys(L.a.effective.carried).length > 0 && <p className="muted small" style={{ margin: '6px 0 0' }}>Carried forward from earlier visits: {Object.entries(L.a.effective.carried).map(([k, d]) => `${k} (${d})`).join(', ')}.</p>}
          <details className="how">
            <summary>How the score works</summary>
            <ul>
              <li>Based on the American Heart Association’s Life’s Essential 8: four behaviours (diet, activity, tobacco, sleep) and four health factors (BMI, lipids, glucose, blood pressure). Each scores 0 to 100; the health score is their average.</li>
              <li>BMI uses the WHO cut-offs for Asian populations (23, 27.5, 32.5, 37.5) instead of the international 25, 30, 35, 40.</li>
              <li>Diet uses the average reviewed plate score over the 7 days before the visit, times 10.</li>
              <li>Lipids use non-HDL cholesterol. Blood pressure and lipid points drop by 20 when on medicine, as in Life’s Essential 8.</li>
              <li>Labs are carried forward up to 120 days, lifestyle answers 30 days. Weight, waist and blood pressure must be measured at the visit.</li>
              <li>Draft version {r.version}, to be signed off by the clinical lead. The score supports the care team; it does not diagnose.</li>
            </ul>
          </details>
        </section>
        <section className="panel" aria-labelledby="h-risk">
          <h2 id="h-risk">Risk</h2>
          <Risk name="Diabetes risk (IDRS)" chip={L.a.idrs ? `${L.a.idrs.category}, ${L.a.idrs.score}` : 'Needs data'} cls={riskClass(L.a.idrs?.category)}
            note={`Indian Diabetes Risk Score from age, waist, activity and family history. 60 or more is high.${v.assessments[0]!.a.idrs && v.assessments.length > 1 ? ` At baseline: ${v.assessments[0]!.a.idrs.category}, ${v.assessments[0]!.a.idrs.score}.` : ''}`} />
          <Risk name="Liver fibrosis (FIB-4)" chip={L.a.fib4 ? `${L.a.fib4.category}, ${L.a.fib4.score}` : 'Needs data'} cls={riskClass(L.a.fib4?.category)}
            note={`From age, AST, ALT and platelets. Below 1.3 is low, above 2.67 is high.${L.a.fib4?.caution ? ' Interpret with care: age under 35 or over 65.' : ''}`} />
          <Risk name="Metabolic syndrome" chip={L.a.metSyn.present === null ? 'Needs data' : L.a.metSyn.present ? `Present, ${L.a.metSyn.met.length} of 5` : `Not present, ${L.a.metSyn.met.length} of 5`} cls={L.a.metSyn.present === null ? 'flag' : L.a.metSyn.present ? 'warn' : 'ok'}
            note={`Harmonised criteria with South Asian waist cut-offs; 3 of 5 means present.${L.a.metSyn.met.length ? ` Met: ${L.a.metSyn.met.map(x => x === 'HDL' ? x : x.toLowerCase()).join(', ')}.` : ''}${L.a.metSyn.missing.length ? ` Missing: ${L.a.metSyn.missing.map(x => x === 'HDL' ? x : x.toLowerCase()).join(', ')}.` : ''}`} />
          <Risk name="Waist-to-height ratio" chip={L.a.whtr ? `${L.a.whtr.category}, ${L.a.whtr.ratio}` : 'Needs data'} cls={riskClass(L.a.whtr?.category)} note="Keep the waist under half the height (NICE). 0.5 or more is increased, 0.6 or more is high." />
          <Risk name="Kidney function (eGFR)" chip={L.a.egfr ? `${L.a.egfr.stage}, ${L.a.egfr.value}` : 'Needs data'} cls={!L.a.egfr ? 'flag' : L.a.egfr.value >= 60 ? 'ok' : L.a.egfr.value >= 30 ? 'warn' : 'alert'} note="CKD-EPI 2021 from creatinine, age and sex, in mL/min/1.73m². Stages follow KDIGO." />
          <Risk name="Cardiovascular risk" chip="Not calculated" cls="flag" note="The clinical lead chooses a chart validated for South Asia (for example the WHO 2019 South Asia chart) before this is shown." />
          <Risk name="Status" chip={<StatusChip status={v.status!.status} />} note={v.status!.reason} />
        </section>
      </div>
      <section className="panel" aria-labelledby="h-trend">
        <h2 id="h-trend">Trends</h2>
        <div className="trend">
          <div className="t"><b>Weight, kg</b><Spark values={series('weight')} colour="#2E6B47" label="Weight by visit" /></div>
          <div className="t"><b>Waist, cm</b><Spark values={series('waist')} colour="#B87A1E" label="Waist by visit" /></div>
          <div className="t"><b>Systolic pressure, mmHg</b><Spark values={series('sbp')} colour="#C2492F" label="Systolic pressure by visit" /></div>
        </div>
        <p className="muted small" style={{ margin: '8px 0 0' }}>BMI at the latest visit: {bmi(L.a.effective.values) ?? 'needs weight and height'}.</p>
      </section>
      {ad && (
        <section className="panel" aria-labelledby="h-ad">
          <h2 id="h-ad">Programme adherence</h2>
          <p style={{ margin: 0 }}>Plates logged on {ad.daysLogged} of {ad.daysElapsed} days so far (of {PROGRAMME_DAYS}). {ad.platesReviewed} of {ad.platesUploaded} plates reviewed. Check-ins attended: {ad.checkinsAttended} of {ad.weeksCompleted} completed weeks.</p>
          <p className="muted small" style={{ margin: '6px 0 0' }}>The pilot aims for plates on 15 or more of 21 days (target to confirm).</p>
        </section>
      )}
      {enrolment}
    </div>
  );
}

function Risk({ name, chip, cls, note }: { name: string; chip: React.ReactNode; cls?: string; note: string }) {
  return <div className="risk"><b>{name}</b>{typeof chip === 'string' ? <span className={`chip ${cls}`}>{chip}</span> : chip}<small>{note}</small></div>;
}
