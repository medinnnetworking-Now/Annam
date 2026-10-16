import type { ReportContent } from '@/lib/data/reports';

const LOWER_BETTER = new Set(['bmi', 'weight', 'waist', 'hip', 'sbp', 'dbp', 'fpg', 'ppg', 'hba1c', 'tc', 'ldl', 'tg', 'ast', 'alt']);
const HIGHER_BETTER = new Set(['hdl']);

export const DISCLAIMER = 'Annam supports the care team and does not diagnose. The doctor decides on medication and treatment. The score follows the American Heart Association’s Life’s Essential 8 with WHO Asian BMI cut-offs; its use here is a draft under review by the clinical lead. Cardiovascular risk is shown only once a chart validated for South Asia is chosen.';

export function ReportView({ c, approval }: { c: ReportContent; approval: React.ReactNode }) {
  const two = c.to !== null;
  return (
    <article className="report">
      <div className="rhead">
        <div>
          <div className="ml" lang="ml">അന്നം</div>
          <b>Progress report</b>
          <div className="muted small">{c.from.label}, {c.from.date}{c.to ? ` to ${c.to.label}, ${c.to.date}` : ''}</div>
        </div>
        <div style={{ textAlign: 'right' }} className="small">
          <b>{c.patient.name}</b><br />{c.patient.code} · {c.patient.age} {c.patient.sex === 'F' ? 'female' : 'male'}<br />Referred by {c.patient.referrer}<br />
          {c.patient.programme}{c.patient.start_date ? `, from ${c.patient.start_date}` : ''}
          {c.patient.is_sample && <><br /><span className="sample-mark">Sample data</span></>}
        </div>
      </div>
      <div className="grid3" style={{ marginBottom: 6 }}>
        <div><div className="muted small">Health score</div><b style={{ fontSize: 24 }}>{c.score.baseline ?? '–'}{two ? ` → ${c.score.latest ?? '–'}` : ''}</b>
          <div className="small muted">{c.score.category ?? ''}{c.score.change !== null ? `, ${c.score.change >= 0 ? '+' : ''}${c.score.change} on comparable measures` : ''}</div></div>
        <div><div className="muted small">Diabetes risk (IDRS)</div><b style={{ fontSize: 18 }}>{c.risk.idrs ? `${c.risk.idrs.category}, ${c.risk.idrs.score}` : 'Needs data'}</b></div>
        <div><div className="muted small">Metabolic syndrome</div><b style={{ fontSize: 18 }}>{c.risk.met_syn === null ? 'Needs data' : c.risk.met_syn ? `Present (${c.risk.met_syn_met.length} of 5)` : 'Not present'}</b></div>
      </div>
      <h3>Score parts</h3>
      <div className="tablewrap"><table>
        <thead><tr><th scope="col">Part, of 100</th><th scope="col" className="num">Baseline</th>{two && <th scope="col" className="num">Latest</th>}</tr></thead>
        <tbody>{c.components.map(x => <tr key={x.name}><th scope="row">{x.name}</th><td className="num">{x.baseline ?? '–'}</td>{two && <td className="num">{x.points ?? '–'}</td>}</tr>)}</tbody>
      </table></div>
      <h3>Measures</h3>
      <div className="tablewrap"><table>
        <thead><tr><th scope="col">Measure</th><th scope="col" className="num">{c.from.label}</th>{two && <><th scope="col" className="num">{c.to!.label}</th><th scope="col" className="num">Change</th></>}</tr></thead>
        <tbody>{c.measures.map(m => {
          const d = m.baseline !== null && m.latest !== null ? Math.round((m.latest - m.baseline) * 10) / 10 : null;
          const good = d === null || d === 0 ? null : LOWER_BETTER.has(m.key) ? d < 0 : HIGHER_BETTER.has(m.key) ? d > 0 : null;
          return <tr key={m.key}><th scope="row">{m.label} <span className="muted">{m.unit}</span></th><td className="num">{m.baseline ?? ''}</td>
            {two && <><td className="num">{m.latest ?? ''}</td><td className="num">{d === null ? '' : d === 0 ? 'No change' : <span className={good === null ? '' : good ? 'better' : 'worse'}>{d > 0 ? '+' : ''}{d}{good === null ? '' : good ? ' (better)' : ' (worse)'}</span>}</td></>}</tr>;
        })}</tbody>
      </table></div>
      <p className="muted small">HbA1c reflects about three months of glucose. A change is expected at 12 weeks, not at week 3.</p>
      <h3>Other risk</h3>
      <p>FIB-4: {c.risk.fib4 ? `${c.risk.fib4.category}, ${c.risk.fib4.score}${c.risk.fib4.caution ? ' (interpret with care at this age)' : ''}` : 'needs AST, ALT and platelets'}. Waist-to-height ratio: {c.risk.whtr ? `${c.risk.whtr.ratio}, ${c.risk.whtr.category.toLowerCase()}` : 'needs waist and height'}. eGFR: {c.risk.egfr ? `${c.risk.egfr.value} (${c.risk.egfr.stage})` : 'needs creatinine'}. Cardiovascular risk: not calculated.</p>
      <h3>Adherence</h3>
      <p>{c.adherence ? `Plates logged on ${c.adherence.daysLogged} of ${c.adherence.daysElapsed} days. ${c.adherence.platesReviewed} plates reviewed${c.average_plate !== null ? `, average score ${c.average_plate} of 10` : ''}. Check-ins attended: ${c.adherence.checkinsAttended} of ${c.adherence.weeksCompleted} completed weeks.` : 'The programme has not started.'}</p>
      {c.review && <><h3>Nutritionist summary</h3><p>Week {c.review.week}: {c.review.text}{c.review.goals ? ` Goals: ${c.review.goals}` : ''}</p></>}
      <h3>Red flags</h3>
      <p>{c.red_flags.length ? `${c.red_flags.join('. ')}.` : 'None at the latest visit.'}{c.alerts.length ? ` Alerts raised during the programme: ${c.alerts.map(a => `${a.flags.join(', ')} (${a.raised.slice(0, 10)}${a.doctor_informed ? `, ${a.doctor_informed} told` : ''})`).join('; ')}.` : ''}</p>
      <h3>Next step</h3>
      {approval}
      <p className="disclaimer">{DISCLAIMER} Generated {c.generated_on}, score version {c.score_version}.</p>
    </article>
  );
}
