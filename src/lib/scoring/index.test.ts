import { describe, expect, it } from 'vitest';
import {
  activityComponent, ageOn, assess, bmi, bmiComponent, bpComponent, comparableChange, dietAverage, effectiveAt, egfr, fib4,
  glucoseComponent, healthScore, idrs, lipidComponent, metabolicSyndrome, nicotineComponent, redFlags, scoreCategory,
  sleepComponent, status, suggestPlateScore, whtr, type Effective, type Visit
} from './index';
import { SCORE_VERSION } from './config';

const A: Effective = {
  weight: 78, height: 168, waist: 98, hip: 101, sbp: 142, dbp: 90, fpg: 138, ppg: 196, hba1c: 7.1, tc: 212, ldl: 132, hdl: 38, tg: 210,
  ast: 38, alt: 52, plt: 240, creat: 0.9, activityMinutes: 60, sleepHours: 6.5, tobacco: 'never', secondhandSmoke: false,
  idrsActivity: 'mild', onBpMeds: false, onLipidMeds: false, hasDiabetes: false
};
const pts = (c: { points: number | null }) => c.points;

describe('Life’s Essential 8 components', () => {
  it.each([[150, 100], [300, 100], [149, 90], [120, 90], [119, 80], [90, 80], [60, 60], [59, 40], [30, 40], [29, 20], [1, 20], [0, 0]])(
    'activity %i minutes → %i', (m, p) => expect(pts(activityComponent(m))).toBe(p));
  it('activity missing or negative → not measured', () => { expect(pts(activityComponent(null))).toBeNull(); expect(pts(activityComponent(-5))).toBeNull(); });

  it.each([[7, 100], [8.99, 100], [9, 90], [9.9, 90], [10, 40], [12, 40], [6.5, 70], [6, 70], [5.9, 40], [5, 40], [4.5, 20], [4, 20], [3.9, 0], [0, 0]])(
    'sleep %f hours → %i', (h, p) => expect(pts(sleepComponent(h))).toBe(p));
  it('sleep outside 0 to 24 → not measured', () => expect(pts(sleepComponent(25))).toBeNull());

  it('tobacco', () => {
    expect(pts(nicotineComponent('never', false))).toBe(100);
    expect(pts(nicotineComponent('never', true))).toBe(80);
    expect(pts(nicotineComponent('quit_5y_plus', false))).toBe(75);
    expect(pts(nicotineComponent('quit_1_5y', false))).toBe(50);
    expect(pts(nicotineComponent('quit_under_1y', true))).toBe(5);
    expect(pts(nicotineComponent('current', true))).toBe(0);
    expect(pts(nicotineComponent(null, false))).toBeNull();
  });

  it('BMI uses the WHO Asian cut-offs', () => {
    expect(bmi({ weight: 78, height: 168 })).toBe(27.6);
    expect(pts(bmiComponent({ weight: 78, height: 168 }))).toBe(30);
    expect(pts(bmiComponent({ weight: 60, height: 165 }))).toBe(100); // 22.0
    expect(pts(bmiComponent({ weight: 62.6, height: 165 }))).toBe(70); // 23.0
    expect(pts(bmiComponent({ weight: 74.8, height: 165 }))).toBe(30); // 27.475 rounds to 27.5
    expect(pts(bmiComponent({ weight: 100, height: 165 }))).toBe(15); // 36.7
    expect(pts(bmiComponent({ weight: 110, height: 165 }))).toBe(0); // 40.4
    expect(bmiComponent({ weight: 45, height: 165 }).detail).toContain('Underweight');
    expect(pts(bmiComponent({ weight: 70 }))).toBeNull();
    expect(bmi({ weight: 70, height: 0 })).toBeNull();
  });

  it('lipids use non-HDL cholesterol, minus 20 when treated', () => {
    expect(pts(lipidComponent({ tc: 212, hdl: 38 }))).toBe(40);
    expect(pts(lipidComponent({ tc: 212, hdl: 38, onLipidMeds: true }))).toBe(20);
    expect(pts(lipidComponent({ tc: 179, hdl: 50 }))).toBe(100);
    expect(pts(lipidComponent({ tc: 180, hdl: 50 }))).toBe(60);
    expect(pts(lipidComponent({ tc: 270, hdl: 40 }))).toBe(0);
    expect(pts(lipidComponent({ tc: 200, hdl: 40, onLipidMeds: true }))).toBe(20);
    expect(pts(lipidComponent({ tc: 200 }))).toBeNull();
  });

  it('glucose follows diabetes status', () => {
    expect(pts(glucoseComponent({ fpg: 90, hba1c: 5.2 }))).toBe(100);
    expect(pts(glucoseComponent({ fpg: 110 }))).toBe(60);
    expect(pts(glucoseComponent({ fpg: 95, hba1c: 5.8 }))).toBe(60);
    expect(pts(glucoseComponent({ fpg: 138, hba1c: 7.1 }))).toBe(30);
    expect(pts(glucoseComponent({ hasDiabetes: true, hba1c: 6.8 }))).toBe(40);
    expect(pts(glucoseComponent({ hba1c: 10.2 }))).toBe(0);
    expect(pts(glucoseComponent({ hba1c: 9.0 }))).toBe(10);
    expect(pts(glucoseComponent({ fpg: 130 }))).toBeNull(); // diabetes range without HbA1c
    expect(pts(glucoseComponent({}))).toBeNull();
  });

  it('blood pressure takes the worse of the two values, minus 20 when treated', () => {
    expect(pts(bpComponent({ sbp: 118, dbp: 78 }))).toBe(100);
    expect(pts(bpComponent({ sbp: 125, dbp: 79 }))).toBe(75);
    expect(pts(bpComponent({ sbp: 125, dbp: 80 }))).toBe(50);
    expect(pts(bpComponent({ sbp: 135, dbp: 70 }))).toBe(50);
    expect(pts(bpComponent({ sbp: 142, dbp: 90 }))).toBe(25);
    expect(pts(bpComponent({ sbp: 150, dbp: 100 }))).toBe(0);
    expect(pts(bpComponent({ sbp: 160, dbp: 90 }))).toBe(0);
    expect(pts(bpComponent({ sbp: 118, dbp: 78, onBpMeds: true }))).toBe(80);
    expect(pts(bpComponent({ sbp: 165, dbp: 101, onBpMeds: true }))).toBe(0);
    expect(pts(bpComponent({ sbp: 120 }))).toBeNull();
  });
});

describe('health score', () => {
  it('Sample patient A at baseline: 7 of 8 measured, mean 50.7 → 51, Moderate', () => {
    const r = healthScore(A, null);
    expect(r.components.map(pts)).toEqual([null, 60, 100, 70, 30, 40, 30, 25]);
    expect(r.measured).toBe(7);
    expect(r.score).toBe(51);
    expect(r.category).toBe('Moderate');
    expect(r.complete).toBe(false);
    expect(r.version).toBe(SCORE_VERSION);
  });
  it('diet adds the average plate score × 10', () => {
    const r = healthScore(A, 7.5);
    expect(r.components[0]!.points).toBe(75);
    expect(r.score).toBe(Math.round((355 + 75) / 8));
    expect(r.complete).toBe(true);
  });
  it('fewer than four components → no score', () => {
    const r = healthScore({ weight: 70, height: 175, activityMinutes: 150, sleepHours: 8 }, null);
    expect(r.measured).toBe(3);
    expect(r.score).toBeNull();
    expect(r.category).toBeNull();
  });
  it('categories at the boundaries', () => {
    expect(scoreCategory(80)).toBe('High'); expect(scoreCategory(79)).toBe('Moderate');
    expect(scoreCategory(50)).toBe('Moderate'); expect(scoreCategory(49)).toBe('Low'); expect(scoreCategory(null)).toBeNull();
  });
  it('change uses only the components measured both times', () => {
    const before = healthScore(A, null).components;
    const after = healthScore({ ...A, activityMinutes: 150 }, 9).components; // diet appears; activity 60 → 100
    const c = comparableChange(before, after)!;
    expect(c.shared).not.toContain('diet');
    expect(c.change).toBe(Math.round(40 / 7));
    expect(comparableChange(healthScore({ weight: 70, height: 175 }, null).components, after)).toBeNull();
  });
});

describe('carrying values forward', () => {
  const visits: Visit[] = [
    { date: '2026-09-01', weight: 71, height: 155, hba1c: 6.6, sbp: 148, dbp: 92, activityMinutes: 30, tobacco: 'never' },
    { date: '2026-09-22', weight: 69.4, sbp: 136, dbp: 86 }
  ];
  it('labs within 120 days and height always; body measures never; lifestyle within 30 days', () => {
    const e = effectiveAt(visits, '2026-09-22');
    expect(e.values.hba1c).toBe(6.6); expect(e.carried.hba1c).toBe('2026-09-01');
    expect(e.values.height).toBe(155); expect(e.values.weight).toBe(69.4); expect(e.carried.weight).toBeUndefined();
    expect(e.values.activityMinutes).toBe(30);
    const later = effectiveAt([...visits, { date: '2027-01-15', weight: 68 }], '2027-01-15');
    expect(later.values.hba1c).toBeUndefined(); expect(later.values.activityMinutes).toBeUndefined(); expect(later.values.height).toBe(155);
    expect(later.values.sbp).toBeUndefined();
  });
  it('two visits on one day: the later one wins', () => {
    const e = effectiveAt([{ date: '2026-10-01', weight: 72, sbp: 138, dbp: 88 }, { date: '2026-10-01', weight: 70.5, sbp: 164, dbp: 92 }], '2026-10-01');
    expect(e.values.weight).toBe(70.5); expect(e.values.sbp).toBe(164); expect(e.carried).toEqual({});
  });
  it('ignores visits after the date', () => expect(effectiveAt(visits, '2026-09-10').values.weight).toBeUndefined());
});

describe('diet window', () => {
  const plates = [
    { date: '2026-10-01', score: 4, reviewed: true }, { date: '2026-10-07', score: 8, reviewed: true },
    { date: '2026-10-08', score: 10, reviewed: true }, { date: '2026-10-05', score: 2, reviewed: false }
  ];
  it('averages reviewed plates in the 7 days up to the visit', () => expect(dietAverage(plates, '2026-10-07')).toBe(6));
  it('no plates → null', () => expect(dietAverage(plates, '2026-09-01')).toBeNull());
});

describe('risk tools', () => {
  it('IDRS high', () => expect(idrs(47, 'M', { waist: 98, idrsActivity: 'mild' }, 'one')).toEqual({ score: 60, category: 'High' }));
  it('IDRS maximum', () => expect(idrs(52, 'F', { waist: 94, idrsActivity: 'sedentary' }, 'both')).toEqual({ score: 100, category: 'High' }));
  it('IDRS low', () => expect(idrs(30, 'M', { waist: 85, idrsActivity: 'vigorous' }, 'none')).toEqual({ score: 0, category: 'Low' }));
  it('IDRS moderate at 30 and 50', () => {
    expect(idrs(35, 'M', { waist: 85, idrsActivity: 'moderate' }, 'none')!.category).toBe('Moderate');
    expect(idrs(50, 'F', { waist: 79, idrsActivity: 'mild' }, 'none')!.score).toBe(50);
  });
  it('IDRS needs waist and activity', () => expect(idrs(47, 'M', { waist: 98 }, 'one')).toBeNull());
  it('FIB-4 low', () => expect(fib4(47, { ast: 38, alt: 52, plt: 240 })).toEqual({ score: 1.03, category: 'Low', caution: false }));
  it('FIB-4 high', () => expect(fib4(60, { ast: 80, alt: 25, plt: 100 })).toEqual({ score: 9.6, category: 'High', caution: false }));
  it('FIB-4 caution under 35 and invalid input', () => {
    expect(fib4(30, { ast: 30, alt: 30, plt: 200 })!.caution).toBe(true);
    expect(fib4(47, { ast: 38, alt: 0, plt: 240 })).toBeNull();
    expect(fib4(47, { ast: 38, alt: 52 })).toBeNull();
  });
  it('waist-to-height ratio', () => {
    expect(whtr({ waist: 98, height: 168 })).toEqual({ ratio: 0.58, category: 'Increased' });
    expect(whtr({ waist: 80, height: 170 })).toEqual({ ratio: 0.47, category: 'Low' });
    expect(whtr({ waist: 110, height: 170 })!.category).toBe('High');
  });
  it('eGFR, CKD-EPI 2021', () => {
    expect(egfr(47, 'M', { creat: 0.9 })).toEqual({ value: 106, stage: 'G1' });
    expect(egfr(52, 'F', { creat: 0.8 })).toEqual({ value: 89, stage: 'G2' });
    expect(egfr(70, 'M', { creat: 3 })!.value).toBeLessThan(30);
    expect(egfr(47, 'M', {})).toBeNull();
  });
  it('metabolic syndrome', () => {
    expect(metabolicSyndrome('M', A)).toEqual({ present: true, met: ['Waist', 'Triglycerides', 'HDL', 'Blood pressure', 'Glucose'], missing: [] });
    expect(metabolicSyndrome('F', { waist: 70, tg: 100, hdl: 60, sbp: 110, dbp: 70, fpg: 90 }).present).toBe(false);
    expect(metabolicSyndrome('F', { waist: 85, tg: 160 }).present).toBeNull();
    expect(metabolicSyndrome('F', { waist: 70, tg: 100, hdl: 60 }).present).toBe(false); // 0 met + 2 missing < 3
  });
});

describe('red flags and status', () => {
  it('flags', () => {
    expect(redFlags(50, 'M', { sbp: 162, dbp: 94 })).toEqual(['Blood pressure 160/100 or higher']);
    expect(redFlags(50, 'M', { sbp: 150, dbp: 100 })).toHaveLength(1);
    expect(redFlags(50, 'M', { fpg: 250 })).toEqual(['Fasting glucose 250 mg/dL or higher']);
    expect(redFlags(50, 'M', { fpg: 65 })).toEqual(['Fasting glucose below 70 mg/dL']);
    expect(redFlags(60, 'M', { ast: 80, alt: 25, plt: 100 })).toEqual(['FIB-4 above 2.67']);
    expect(redFlags(70, 'M', { creat: 3 })).toEqual(['eGFR below 30']);
    expect(redFlags(50, 'M', { tg: 1000 })).toEqual(['Triglycerides 1000 mg/dL or higher']);
    expect(redFlags(47, 'M', A)).toEqual([]);
  });
  it('status order', () => {
    expect(status(['X'], 90, 0).status).toBe('See your doctor');
    expect(status([], null, null).status).toBe('Not enough data');
    expect(status([], 49, null).status).toBe('Needs attention');
    expect(status([], 70, -6).status).toBe('Needs attention');
    expect(status([], 70, -5).status).toBe('On track');
    expect(status([], 50, null)).toEqual({ status: 'On track', reason: 'No red flags, and the score is 50 or more.' });
  });
});

describe('plate suggestion and age', () => {
  it('veg, protein, grain, oil flag → 7.5 → 8', () => expect(suggestPlateScore({ veg: true, protein: true, grain: true, fruit: false, dairy: false }, { oil: true, sweet: false, upf: false })).toBe(8));
  it('clamps at 0 and 10', () => {
    expect(suggestPlateScore({ veg: false, protein: false, grain: false, fruit: false, dairy: true }, { oil: true, sweet: true, upf: true })).toBe(0);
    expect(suggestPlateScore({ veg: true, protein: true, grain: true, fruit: true, dairy: true }, { oil: false, sweet: false, upf: false })).toBe(10);
  });
  it('age in whole years', () => {
    expect(ageOn('1979-10-17', '2026-10-16')).toBe(46);
    expect(ageOn('1979-10-16', '2026-10-16')).toBe(47);
  });
  it('assess puts it together', () => {
    const a = assess({ dob: '1979-01-01', sex: 'M', family: 'one' }, [{ date: '2026-10-01', ...A } as Visit], '2026-10-01', []);
    expect(a.age).toBe(47); expect(a.result.score).toBe(51); expect(a.idrs!.score).toBe(60); expect(a.flags).toEqual([]); expect(a.bmi).toBe(27.6);
  });
});
