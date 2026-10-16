// Synthetic sample patients for development and demos. Every name says "Sample"; is_sample = true.
// Never run against production (ANNAM_SEED_SAMPLES is off there by default).
import type { Db } from './index';
import { addDays, todayIST } from '../programme';
import { suggestPlateScore } from '../scoring';
import { refreshSnapshots } from '../data/patients';
import { CONSENT_VERSION } from '../../content/consent';

const SEED = { account: 'system', staff: 'Sample data' };

interface SampleVisit { label: string; offset: number; m: Record<string, number>; life: Record<string, unknown> }
interface Sample {
  name: string; dobYears: number; sex: 'M' | 'F'; family: 'none' | 'one' | 'both'; state: string; startOffset: number | null;
  triage?: string[]; visits: SampleVisit[]; plateDays: number; quality: number; checkins: number[]; reviews: Record<number, [string, string]>;
  withdrawn?: boolean; clearedBy?: string;
}

const life = (activity: number, sleep: number, tobacco: string, idrs: string, extra: Record<string, unknown> = {}) =>
  ({ activity_minutes: activity, sleep_hours: sleep, tobacco, secondhand_smoke: false, idrs_activity: idrs, on_bp_meds: false, on_lipid_meds: false, has_diabetes: false, ...extra });

const SAMPLES: Sample[] = [
  {
    name: 'Sample patient A', dobYears: 47, sex: 'M', family: 'one', state: 'active', startOffset: -9, clearedBy: 'Dr Sample Doctor',
    visits: [{ label: 'Baseline', offset: -9, m: { weight: 78, height: 168, waist: 98, hip: 101, sbp: 142, dbp: 90, fpg: 138, ppg: 196, hba1c: 7.1, tc: 212, ldl: 132, hdl: 38, tg: 210, ast: 38, alt: 52, plt: 240, creat: 0.9 }, life: life(60, 6.5, 'never', 'mild') }],
    plateDays: 9, quality: 0.62, checkins: [1], reviews: { 1: ['Good start. Breakfast still carries sweet tea, and dinners are oil-heavy.', 'Swap sweet tea for plain tea. Add a pulse at dinner.'] }
  },
  {
    name: 'Sample patient B', dobYears: 52, sex: 'F', family: 'both', state: 'checkin_recorded', startOffset: -24, clearedBy: 'Dr Sample Doctor',
    visits: [
      { label: 'Baseline', offset: -24, m: { weight: 71, height: 155, waist: 94, hip: 104, sbp: 148, dbp: 92, fpg: 126, ppg: 188, hba1c: 6.6, tc: 220, ldl: 140, hdl: 44, tg: 188, ast: 30, alt: 41, plt: 260, creat: 0.8 }, life: life(30, 6, 'quit_1_5y', 'sedentary', { on_bp_meds: true }) },
      { label: 'Week 3 check-in', offset: -3, m: { weight: 69.4, waist: 91, hip: 102, sbp: 136, dbp: 86, fpg: 112, ppg: 162, tg: 154 }, life: life(140, 7, 'quit_1_5y', 'mild', { on_bp_meds: true }) }
    ],
    plateDays: 21, quality: 0.72, checkins: [1, 2, 3],
    reviews: { 1: ['Logging well. Rice portions large at lunch.', 'Half the rice, add thoran.'], 2: ['Portions better. Walk is irregular.', 'Walk 20 minutes after dinner.'], 3: ['Consistent week. Ready for the 12-week programme.', 'Keep the plate pattern. Reduce oil in curries.'] }
  },
  {
    name: 'Sample patient C', dobYears: 38, sex: 'M', family: 'none', state: 'baseline_recorded', startOffset: null,
    visits: [{ label: 'Baseline', offset: -1, m: { weight: 84, height: 175, waist: 96, hip: 100, sbp: 128, dbp: 84, fpg: 104, ppg: 150, hba1c: 5.9, tc: 198, ldl: 124, hdl: 41, tg: 172, ast: 26, alt: 39, plt: 230, creat: 1.0 }, life: life(120, 7.5, 'current', 'moderate') }],
    plateDays: 0, quality: 0, checkins: [], reviews: {}
  },
  {
    name: 'Sample patient D', dobYears: 61, sex: 'F', family: 'one', state: 'active', startOffset: -16, clearedBy: 'Dr Sample Doctor',
    visits: [{ label: 'Baseline', offset: -16, m: { weight: 64, height: 152, waist: 88, sbp: 164, dbp: 96, fpg: 98, hba1c: 5.6, tc: 190, hdl: 52, tg: 140, creat: 0.9 }, life: life(90, 8, 'never', 'moderate', { on_bp_meds: true }) }],
    plateDays: 14, quality: 0.5, checkins: [1, 2], reviews: { 1: ['Regular logging. Snacks are fried most evenings.', 'Swap one fried snack for fruit.'] }
  },
  {
    name: 'Sample patient E', dobYears: 44, sex: 'M', family: 'both', state: 'not_suitable', startOffset: null, triage: ['insulin_or_su'],
    visits: [{ label: 'Baseline', offset: -2, m: { weight: 90, height: 172, waist: 104, sbp: 132, dbp: 84, fpg: 182, hba1c: 8.4 }, life: life(20, 6, 'never', 'sedentary', { has_diabetes: true }) }],
    plateDays: 0, quality: 0, checkins: [], reviews: {}
  },
  {
    name: 'Sample patient F', dobYears: 35, sex: 'F', family: 'none', state: 'withdrawn', startOffset: -12, withdrawn: true, clearedBy: 'Dr Sample Doctor',
    visits: [{ label: 'Baseline', offset: -12, m: { weight: 66, height: 160, waist: 84, sbp: 118, dbp: 76, fpg: 96 }, life: life(150, 7, 'never', 'moderate') }],
    plateDays: 4, quality: 0.6, checkins: [], reviews: {}
  }
];

export async function seedSamples(db: Db) {
  const [{ n }] = await db.query<{ n: number }>('select count(*)::int as n from patients where is_sample') as [{ n: number }];
  if (n > 0) return;
  const today = todayIST();
  for (const s of SAMPLES) {
    const id = await db.tx(SEED, async q => {
      const dob = addDays(today, -Math.round(s.dobYears * 365.25 + 40));
      const start = s.startOffset === null ? null : addDays(today, s.startOffset);
      const [{ id }] = await q.query<{ id: string }>(
        `insert into patients (code, name, dob, sex, referrer, family_history, triage, state, start_date, cleared_by_doctor, is_sample)
         values ('AN-' || lpad(nextval('patient_code_seq')::text, 4, '0'), $1, $2, $3, 'Dr Sample Referrer, RM Clinic', $4, $5, $6, $7, $8, true) returning id`,
        [s.name, dob, s.sex, s.family, JSON.stringify(s.triage ?? []), s.withdrawn ? 'active' : s.state, start, s.clearedBy ?? null]) as [{ id: string }];
      await q.query('insert into consents (patient_id, version, recorded_by, recorded_at) values ($1, $2, $3, $4)', [id, CONSENT_VERSION, 'Sample data', addDays(today, s.visits[0]!.offset - 1)]);
      for (const v of s.visits) {
        const cols = [...Object.keys(v.m), ...Object.keys(v.life)];
        const vals = [...Object.values(v.m), ...Object.values(v.life)];
        await q.query(`insert into visits (patient_id, label, visit_date, entered_by, ${cols.join(', ')}) values ($1, $2, $3, 'Sample data', ${cols.map((_, i) => `$${i + 4}`).join(', ')})`,
          [id, v.label, addDays(today, v.offset), ...vals]);
      }
      if (start) {
        const meals = [['Breakfast', '08:15:00'], ['Lunch', '13:10:00'], ['Dinner', '20:20:00']] as const;
        for (let d = 0; d < s.plateDays; d++) {
          const date = addDays(start, d);
          for (const [k, [meal, time]] of meals.entries()) {
            if ((d + k) % 7 === 6) continue;
            const good = ((d * 3 + k * 5) % 10) / 10 < s.quality;
            const tags = { veg: good || k === 1, protein: good || k === 2, grain: true, fruit: k === 0 && good, dairy: k === 0 };
            const flags = { oil: !good && k !== 0, sweet: !good && k === 0, upf: false };
            const reviewed = d < s.plateDays - 1 || k < 2; // the latest dinner waits for review
            await q.query(
              `insert into plates (patient_id, eaten_on, eaten_at, meal, tags, flags, score, comment, uploaded_by, reviewed_by, reviewed_at)
               values ($1, $2, $3, $4, $5, $6, $7, $8, 'Sample data', $9, $10)`,
              [id, date, time, meal, JSON.stringify(reviewed ? tags : {}), JSON.stringify(reviewed ? flags : {}), reviewed ? suggestPlateScore(tags, flags) : null,
                reviewed && !good ? (flags.oil ? 'Less oil next time.' : 'Swap the sweet tea.') : null, reviewed ? 'Sample data' : null, reviewed ? new Date().toISOString() : null]);
          }
        }
        for (const w of new Set([...s.checkins, ...Object.keys(s.reviews).map(Number)])) {
          const r = s.reviews[w];
          await q.query('insert into weekly_reviews (patient_id, week, review, goals, checkin_attended, author) values ($1, $2, $3, $4, $5, $6)',
            [id, w, r?.[0] ?? null, r?.[1] ?? null, s.checkins.includes(w), 'Sample data']);
        }
      }
      await refreshSnapshots(q, id);
      if (s.withdrawn) {
        await q.query('update consents set withdrawn_at = now(), withdrawn_by = $2 where patient_id = $1', [id, 'Sample data']);
        await q.query(`update patients set state = 'withdrawn' where id = $1`, [id]);
      }
      return id;
    });
    void id;
  }
}
