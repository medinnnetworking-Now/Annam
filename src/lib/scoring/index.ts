// Annam scoring and risk. Pure functions, no I/O. Spec: docs/SCORING.md
import * as C from './config';

export { SCORE_VERSION } from './config';

export type Sex = 'M' | 'F';
export type IdrsActivity = 'vigorous' | 'moderate' | 'mild' | 'sedentary';
export type FamilyHistory = 'none' | 'one' | 'both';
export type Tobacco = keyof typeof C.TOBACCO_POINTS;

export const MEASURE_KEYS = [
  'weight', 'height', 'waist', 'hip', 'sbp', 'dbp', 'fpg', 'ppg', 'hba1c',
  'tc', 'ldl', 'hdl', 'tg', 'ast', 'alt', 'plt', 'creat'
] as const;
export type MeasureKey = (typeof MEASURE_KEYS)[number];

export const LIFESTYLE_KEYS = [
  'activityMinutes', 'sleepHours', 'tobacco', 'secondhandSmoke', 'idrsActivity',
  'onBpMeds', 'onLipidMeds', 'hasDiabetes'
] as const;
export type LifestyleKey = (typeof LIFESTYLE_KEYS)[number];

export interface Lifestyle {
  activityMinutes?: number | null; // moderate or vigorous, per week
  sleepHours?: number | null; // average per night
  tobacco?: Tobacco | null; // smoked or smokeless
  secondhandSmoke?: boolean | null; // lives with someone who smokes indoors
  idrsActivity?: IdrsActivity | null;
  onBpMeds?: boolean | null;
  onLipidMeds?: boolean | null;
  hasDiabetes?: boolean | null; // diagnosed by a doctor
}

export type Visit = { id?: string; date: string; label?: string } & Partial<Record<MeasureKey, number | null>> & Lifestyle;

export type Effective = Partial<Record<MeasureKey, number | null>> & Lifestyle;
export interface EffectiveResult { values: Effective; carried: Partial<Record<MeasureKey | LifestyleKey, string>> }

export interface PatientCore { dob: string; sex: Sex; family: FamilyHistory }
export interface PlateForScore { date: string; score: number | null; reviewed: boolean }

const DAY = 86_400_000;
export const toTime = (s: string) => new Date(s.slice(0, 10) + 'T00:00:00Z').getTime();
export const has = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSet = (v: unknown) => v !== null && v !== undefined && !(typeof v === 'number' && !Number.isFinite(v));
const round1 = (x: number) => Math.round(x * 10) / 10;
const round2 = (x: number) => Math.round(x * 100) / 100;

/** Whole years between date of birth and a date. */
export function ageOn(dob: string, on: string): number {
  const b = new Date(dob.slice(0, 10) + 'T00:00:00Z'), d = new Date(on.slice(0, 10) + 'T00:00:00Z');
  let a = d.getUTCFullYear() - b.getUTCFullYear();
  if (d.getUTCMonth() < b.getUTCMonth() || (d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() < b.getUTCDate())) a--;
  return a;
}

function windowFor(key: MeasureKey | LifestyleKey): number | null {
  if (key === 'height') return C.CARRY_FORWARD_DAYS.height;
  if (['weight', 'waist', 'hip', 'sbp', 'dbp'].includes(key)) return C.CARRY_FORWARD_DAYS.body;
  if ((LIFESTYLE_KEYS as readonly string[]).includes(key)) return C.CARRY_FORWARD_DAYS.lifestyle;
  return C.CARRY_FORWARD_DAYS.labs;
}

/**
 * The values that apply at a visit: its own values, plus earlier values carried forward within
 * each field's window (docs/SCORING.md, "Carrying values forward"). `carried` names the source date.
 */
export function effectiveAt(visits: Visit[], visitDate: string): EffectiveResult {
  const end = toTime(visitDate);
  // Newest first; for two visits on the same day, the one recorded later wins.
  const sorted = visits.map((v, i) => ({ v, i })).filter(x => toTime(x.v.date) <= end)
    .sort((a, b) => toTime(b.v.date) - toTime(a.v.date) || b.i - a.i).map(x => x.v);
  const values: Effective = {}; const carried: EffectiveResult['carried'] = {};
  for (const key of [...MEASURE_KEYS, ...LIFESTYLE_KEYS]) {
    const win = windowFor(key);
    for (const v of sorted) {
      const x = (v as unknown as Record<string, unknown>)[key];
      if (!isSet(x)) continue;
      const age = (end - toTime(v.date)) / DAY;
      if (age === 0 || (win !== null && age <= win)) {
        (values as Record<string, unknown>)[key] = x;
        if (age > 0) carried[key] = v.date;
      }
      break;
    }
  }
  return { values, carried };
}

export function bmi(v: { weight?: number | null; height?: number | null }): number | null {
  if (!has(v.weight) || !has(v.height) || v.height <= 0 || v.weight <= 0) return null;
  return round1(v.weight / Math.pow(v.height / 100, 2));
}

export const nonHdl = (v: Effective): number | null => (has(v.tc) && has(v.hdl) ? v.tc - v.hdl : null);

// ---------------- Health score: Life's Essential 8, South Asian BMI ----------------

export type ComponentKey = 'diet' | 'activity' | 'nicotine' | 'sleep' | 'bmi' | 'lipids' | 'glucose' | 'bp';
export interface Component { key: ComponentKey; name: string; points: number | null; detail: string; group: 'Behaviour' | 'Health factor' }

const COMPONENT_NAMES: Record<ComponentKey, [string, Component['group']]> = {
  diet: ['Diet quality', 'Behaviour'], activity: ['Physical activity', 'Behaviour'], nicotine: ['Tobacco exposure', 'Behaviour'],
  sleep: ['Sleep', 'Behaviour'], bmi: ['Body mass index', 'Health factor'], lipids: ['Blood lipids', 'Health factor'],
  glucose: ['Blood glucose', 'Health factor'], bp: ['Blood pressure', 'Health factor']
};
const comp = (key: ComponentKey, points: number | null, detail: string): Component =>
  ({ key, name: COMPONENT_NAMES[key][0], group: COMPONENT_NAMES[key][1], points: points === null ? null : Math.max(0, Math.min(100, points)), detail });

const upperBand = (x: number, bands: [number, number][]) => { for (const [lim, p] of bands) if (x < lim) return p; return bands[bands.length - 1]![1]; };

export function dietComponent(avgPlate: number | null): Component {
  if (avgPlate === null) return comp('diet', null, 'Needs reviewed plates in the 7 days up to the visit.');
  return comp('diet', Math.round(avgPlate * 10), `Average plate score ${round1(avgPlate)} of 10 over the last 7 days.`);
}

export function activityComponent(minutes: number | null | undefined): Component {
  if (!has(minutes) || minutes < 0) return comp('activity', null, 'Ask about minutes of moderate or vigorous activity a week.');
  const p = C.ACTIVITY_BANDS.find(([min]) => minutes >= min)?.[1] ?? 0;
  return comp('activity', p, `${minutes} minutes a week. The target is 150 or more.`);
}

export function nicotineComponent(t: Tobacco | null | undefined, secondhand: boolean | null | undefined): Component {
  if (!t) return comp('nicotine', null, 'Ask about smoking and smokeless tobacco.');
  let p: number = C.TOBACCO_POINTS[t];
  if (t !== 'current' && secondhand) p -= C.SECONDHAND_SMOKE_PENALTY;
  const label = { never: 'Never used tobacco', quit_5y_plus: 'Quit 5 or more years ago', quit_1_5y: 'Quit 1 to 5 years ago', quit_under_1y: 'Quit less than a year ago', current: 'Uses tobacco now' }[t];
  return comp('nicotine', p, label + (t !== 'current' && secondhand ? ', lives with someone who smokes indoors.' : '.'));
}

export function sleepComponent(hours: number | null | undefined): Component {
  if (!has(hours) || hours < 0 || hours > 24) return comp('sleep', null, 'Ask about average hours of sleep a night.');
  const p = C.SLEEP_BANDS.find(([from, to]) => hours >= from && hours < to)?.[2] ?? 0;
  return comp('sleep', p, `${hours} hours a night. The target is 7 to 9.`);
}

export function bmiComponent(v: Effective): Component {
  const b = bmi(v);
  if (b === null) return comp('bmi', null, 'Needs weight and height.');
  const p = upperBand(b, C.BMI_BANDS);
  const under = b < C.BMI_UNDERWEIGHT ? ' Underweight: discuss with the doctor.' : '';
  return comp('bmi', p, `BMI ${b}, using the WHO cut-offs for Asian populations (23, 27.5, 32.5, 37.5).${under}`);
}

export function lipidComponent(v: Effective): Component {
  const nh = nonHdl(v);
  if (nh === null) return comp('lipids', null, 'Needs total cholesterol and HDL.');
  let p = upperBand(nh, C.NON_HDL_BANDS);
  if (v.onLipidMeds) p -= C.LIPID_TREATED_PENALTY;
  return comp('lipids', p, `Non-HDL cholesterol ${round1(nh)} mg/dL${v.onLipidMeds ? ', on cholesterol medicine' : ''}.`);
}

export function hasDiabetes(v: Effective): boolean {
  return !!v.hasDiabetes || (has(v.fpg) && v.fpg >= C.GLUCOSE_DIABETES.fpgFrom) || (has(v.hba1c) && v.hba1c >= C.GLUCOSE_DIABETES.hba1cFrom);
}

export function glucoseComponent(v: Effective): Component {
  if (!has(v.fpg) && !has(v.hba1c)) return comp('glucose', null, 'Needs fasting glucose or HbA1c.');
  if (hasDiabetes(v)) {
    if (!has(v.hba1c)) return comp('glucose', null, 'Diabetes range: needs HbA1c to score.');
    return comp('glucose', upperBand(v.hba1c, C.GLUCOSE_DIABETES_BANDS), `Diabetes range, HbA1c ${v.hba1c}%.`);
  }
  const pre = (has(v.fpg) && v.fpg >= C.GLUCOSE_NORMAL.fpgBelow) || (has(v.hba1c) && v.hba1c >= C.GLUCOSE_NORMAL.hba1cBelow);
  return pre
    ? comp('glucose', C.GLUCOSE_NO_DIABETES_POINTS.prediabetes, 'Prediabetes range.')
    : comp('glucose', C.GLUCOSE_NO_DIABETES_POINTS.normal, 'Normal range.');
}

export function bpComponent(v: Effective): Component {
  if (!has(v.sbp) || !has(v.dbp)) return comp('bp', null, 'Needs both systolic and diastolic pressure.');
  const sbp = v.sbp, dbp = v.dbp;
  let p = C.BP_BANDS.find(b => sbp >= b.sbpFrom || dbp >= b.dbpFrom)!.points as number;
  if (v.onBpMeds) p -= C.BP_TREATED_PENALTY;
  return comp('bp', p, `${sbp}/${dbp} mmHg${v.onBpMeds ? ', on blood pressure medicine' : ''}.`);
}

export function dietAverage(plates: PlateForScore[], upTo: string): number | null {
  const end = toTime(upTo), start = end - (C.DIET_WINDOW_DAYS - 1) * DAY;
  const ps = plates.filter(p => p.reviewed && has(p.score) && toTime(p.date) >= start && toTime(p.date) <= end);
  if (!ps.length) return null;
  return ps.reduce((a, p) => a + (p.score as number), 0) / ps.length;
}

export type ScoreCategory = 'High' | 'Moderate' | 'Low';
export interface ScoreResult { score: number | null; category: ScoreCategory | null; measured: number; complete: boolean; components: Component[]; version: string }

export function scoreCategory(score: number | null): ScoreCategory | null {
  if (score === null) return null;
  return score >= C.SCORE_CATEGORIES.high ? 'High' : score >= C.SCORE_CATEGORIES.moderate ? 'Moderate' : 'Low';
}

export function components(v: Effective, avgPlate: number | null): Component[] {
  return [
    dietComponent(avgPlate), activityComponent(v.activityMinutes), nicotineComponent(v.tobacco, v.secondhandSmoke),
    sleepComponent(v.sleepHours), bmiComponent(v), lipidComponent(v), glucoseComponent(v), bpComponent(v)
  ];
}

const meanOf = (cs: Component[]) => cs.reduce((a, c) => a + (c.points as number), 0) / cs.length;

/** The health score: the unweighted mean of the components measured, shown once at least four are measured. */
export function healthScore(v: Effective, avgPlate: number | null): ScoreResult {
  const cs = components(v, avgPlate);
  const got = cs.filter(c => c.points !== null);
  const score = got.length >= C.MIN_COMPONENTS_FOR_SCORE ? Math.round(meanOf(got)) : null;
  return { score, category: scoreCategory(score), measured: got.length, complete: got.length === cs.length, components: cs, version: C.SCORE_VERSION };
}

/**
 * Change between two results, using only components measured both times, so a part that was missing
 * at one visit cannot move the score. null when fewer than four components are shared.
 */
export function comparableChange(before: Component[], after: Component[]): { change: number; shared: ComponentKey[] } | null {
  const shared = after.filter(a => a.points !== null && before.find(b => b.key === a.key)?.points != null).map(a => a.key);
  if (shared.length < C.MIN_COMPONENTS_FOR_SCORE) return null;
  const pick = (cs: Component[]) => cs.filter(c => shared.includes(c.key));
  return { change: Math.round(meanOf(pick(after)) - meanOf(pick(before))), shared };
}

// ---------------- Plate suggestion ----------------

export interface PlateTags { veg: boolean; protein: boolean; grain: boolean; fruit: boolean; dairy: boolean }
export interface PlateFlags { oil: boolean; sweet: boolean; upf: boolean }

export function suggestPlateScore(t: PlateTags, f: PlateFlags): number {
  let s = 0;
  for (const k of Object.keys(C.PLATE_POINTS) as (keyof PlateTags)[]) if (t[k]) s += C.PLATE_POINTS[k];
  for (const k of Object.keys(C.PLATE_PENALTIES) as (keyof PlateFlags)[]) if (f[k]) s -= C.PLATE_PENALTIES[k];
  return Math.max(0, Math.min(10, Math.round(s)));
}

// ---------------- Risk tools ----------------

export type RiskCategory = 'Low' | 'Moderate' | 'Indeterminate' | 'High' | 'Increased';

export function idrs(age: number, sex: Sex, v: Effective, family: FamilyHistory): { score: number; category: RiskCategory } | null {
  if (!has(v.waist) || !v.idrsActivity) return null;
  const a = upperBand(age, C.IDRS.age);
  const w = upperBand(v.waist, sex === 'F' ? C.IDRS.waistF : C.IDRS.waistM);
  const score = a + w + C.IDRS.activity[v.idrsActivity] + C.IDRS.family[family];
  return { score, category: score >= C.IDRS.high ? 'High' : score >= C.IDRS.moderate ? 'Moderate' : 'Low' };
}

export function fib4(age: number, v: Effective): { score: number; category: RiskCategory; caution: boolean } | null {
  if (!has(v.ast) || !has(v.alt) || !has(v.plt) || v.alt <= 0 || v.plt <= 0 || v.ast < 0 || age <= 0) return null;
  const score = round2((age * v.ast) / (v.plt * Math.sqrt(v.alt)));
  return { score, category: score < C.FIB4.low ? 'Low' : score <= C.FIB4.high ? 'Indeterminate' : 'High', caution: age < C.FIB4.cautionUnder || age > C.FIB4.cautionOver };
}

export function whtr(v: Effective): { ratio: number; category: RiskCategory } | null {
  if (!has(v.waist) || !has(v.height) || v.height <= 0) return null;
  const ratio = round2(v.waist / v.height);
  return { ratio, category: ratio >= C.WHTR.high ? 'High' : ratio >= C.WHTR.increased ? 'Increased' : 'Low' };
}

/** CKD-EPI 2021 creatinine equation, without race. */
export function egfr(age: number, sex: Sex, v: Effective): { value: number; stage: string } | null {
  if (!has(v.creat) || v.creat <= 0 || age < 18) return null;
  const k = sex === 'F' ? 0.7 : 0.9, a = sex === 'F' ? -0.241 : -0.302;
  const r = v.creat / k;
  const value = Math.round(142 * Math.pow(Math.min(r, 1), a) * Math.pow(Math.max(r, 1), -1.2) * Math.pow(0.9938, age) * (sex === 'F' ? 1.012 : 1));
  return { value, stage: C.EGFR_STAGES.find(([min]) => value >= min)![1] };
}

export interface MetSynResult { present: boolean | null; met: string[]; missing: string[] }
/** Harmonised metabolic syndrome criteria with South Asian waist cut-offs. */
export function metabolicSyndrome(sex: Sex, v: Effective): MetSynResult {
  const M = C.MET_SYN; const met: string[] = [], missing: string[] = [];
  const check = (name: string, known: boolean, yes: boolean) => { if (!known) missing.push(name); else if (yes) met.push(name); };
  check('Waist', has(v.waist), has(v.waist) && v.waist >= (sex === 'F' ? M.waistF : M.waistM));
  check('Triglycerides', has(v.tg), has(v.tg) && v.tg >= M.tg);
  check('HDL', has(v.hdl), has(v.hdl) && v.hdl < (sex === 'F' ? M.hdlF : M.hdlM));
  check('Blood pressure', (has(v.sbp) && has(v.dbp)) || !!v.onBpMeds, !!v.onBpMeds || (has(v.sbp) && v.sbp >= M.sbp) || (has(v.dbp) && v.dbp >= M.dbp));
  check('Glucose', has(v.fpg) || !!v.hasDiabetes, !!v.hasDiabetes || (has(v.fpg) && v.fpg >= M.fpg));
  const present = met.length >= M.needed ? true : met.length + missing.length < M.needed ? false : null;
  return { present, met, missing };
}

// ---------------- Red flags and status ----------------

export function redFlags(age: number, sex: Sex, v: Effective): string[] {
  const R = C.RED_FLAGS; const f: string[] = [];
  if ((has(v.sbp) && v.sbp >= R.sbpFrom) || (has(v.dbp) && v.dbp >= R.dbpFrom)) f.push(`Blood pressure ${R.sbpFrom}/${R.dbpFrom} or higher`);
  if (has(v.fpg) && v.fpg >= R.fpgFrom) f.push(`Fasting glucose ${R.fpgFrom} mg/dL or higher`);
  if (has(v.fpg) && v.fpg < R.fpgBelow) f.push(`Fasting glucose below ${R.fpgBelow} mg/dL`);
  const f4 = fib4(age, v); if (f4 && f4.score > R.fib4Above) f.push(`FIB-4 above ${R.fib4Above}`);
  const e = egfr(age, sex, v); if (e && e.value < R.egfrBelow) f.push(`eGFR below ${R.egfrBelow}`);
  if (has(v.tg) && v.tg >= R.tgFrom) f.push(`Triglycerides ${R.tgFrom} mg/dL or higher`);
  return f;
}

export type Status = 'On track' | 'Needs attention' | 'See your doctor' | 'Not enough data';
export function status(flags: string[], score: number | null, changeSincePrevious: number | null): { status: Status; reason: string } {
  if (flags.length) return { status: 'See your doctor', reason: flags.join('. ') + '.' };
  if (score === null) return { status: 'Not enough data', reason: `Record at least ${C.MIN_COMPONENTS_FOR_SCORE} of the 8 score measures.` };
  if (score < C.SCORE_CATEGORIES.moderate) return { status: 'Needs attention', reason: `Score is below ${C.SCORE_CATEGORIES.moderate}.` };
  if (changeSincePrevious !== null && changeSincePrevious < -C.SCORE_DROP_ATTENTION) return { status: 'Needs attention', reason: `Score fell ${-changeSincePrevious} points since the last visit.` };
  return { status: 'On track', reason: changeSincePrevious === null ? 'No red flags, and the score is 50 or more.' : 'No red flags, and the score is steady or improving.' };
}

// ---------------- Whole assessment at a visit ----------------

export interface Assessment {
  visitDate: string; age: number; effective: EffectiveResult; bmi: number | null; result: ScoreResult;
  idrs: ReturnType<typeof idrs>; fib4: ReturnType<typeof fib4>; whtr: ReturnType<typeof whtr>; egfr: ReturnType<typeof egfr>;
  metSyn: MetSynResult; flags: string[];
}

export function assess(pt: PatientCore, visits: Visit[], visitDate: string, plates: PlateForScore[]): Assessment {
  const effective = effectiveAt(visits, visitDate); const v = effective.values; const age = ageOn(pt.dob, visitDate);
  return {
    visitDate, age, effective, bmi: bmi(v), result: healthScore(v, dietAverage(plates, visitDate)),
    idrs: idrs(age, pt.sex, v, pt.family), fib4: fib4(age, v), whtr: whtr(v), egfr: egfr(age, pt.sex, v),
    metSyn: metabolicSyndrome(pt.sex, v), flags: redFlags(age, pt.sex, v)
  };
}
