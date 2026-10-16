// Measure definitions, units, plausibility ranges and input validation. Shared by client and server.
import { z } from 'zod';
import type { MeasureKey } from './scoring';

export interface FieldDef { key: MeasureKey; label: string; unit: string; min: number; max: number; step?: string; group: 'Body' | 'Blood pressure' | 'Glucose' | 'Lipids' | 'Liver and kidney' }

/** Plausibility ranges: values outside need confirmation but can be saved. To confirm with the clinical lead. */
export const FIELDS: FieldDef[] = [
  { key: 'weight', label: 'Weight', unit: 'kg', min: 25, max: 250, step: '0.1', group: 'Body' },
  { key: 'height', label: 'Height', unit: 'cm', min: 120, max: 210, step: '0.1', group: 'Body' },
  { key: 'waist', label: 'Waist', unit: 'cm', min: 45, max: 180, step: '0.1', group: 'Body' },
  { key: 'hip', label: 'Hip', unit: 'cm', min: 55, max: 190, step: '0.1', group: 'Body' },
  { key: 'sbp', label: 'Systolic', unit: 'mmHg', min: 70, max: 260, group: 'Blood pressure' },
  { key: 'dbp', label: 'Diastolic', unit: 'mmHg', min: 40, max: 150, group: 'Blood pressure' },
  { key: 'fpg', label: 'Fasting glucose', unit: 'mg/dL', min: 40, max: 600, group: 'Glucose' },
  { key: 'ppg', label: 'Post-meal glucose', unit: 'mg/dL', min: 40, max: 700, group: 'Glucose' },
  { key: 'hba1c', label: 'HbA1c', unit: '%', min: 3.5, max: 18, step: '0.1', group: 'Glucose' },
  { key: 'tc', label: 'Total cholesterol', unit: 'mg/dL', min: 70, max: 500, group: 'Lipids' },
  { key: 'ldl', label: 'LDL', unit: 'mg/dL', min: 20, max: 400, group: 'Lipids' },
  { key: 'hdl', label: 'HDL', unit: 'mg/dL', min: 10, max: 150, group: 'Lipids' },
  { key: 'tg', label: 'Triglycerides', unit: 'mg/dL', min: 30, max: 3000, group: 'Lipids' },
  { key: 'ast', label: 'AST', unit: 'U/L', min: 5, max: 1000, group: 'Liver and kidney' },
  { key: 'alt', label: 'ALT', unit: 'U/L', min: 5, max: 1000, group: 'Liver and kidney' },
  { key: 'plt', label: 'Platelets', unit: '10⁹/L', min: 20, max: 1000, group: 'Liver and kidney' },
  { key: 'creat', label: 'Creatinine', unit: 'mg/dL', min: 0.2, max: 15, step: '0.01', group: 'Liver and kidney' }
];
export const FIELD_GROUPS = ['Body', 'Blood pressure', 'Glucose', 'Lipids', 'Liver and kidney'] as const;

/** Columns in the visits table for each measure key. */
export const VISIT_LABELS = ['Baseline', 'Week 3 check-in', 'Week 12 follow-up', 'Other'] as const;

export const TOBACCO_OPTIONS = [
  ['never', 'Never used tobacco'], ['quit_5y_plus', 'Quit 5 or more years ago'], ['quit_1_5y', 'Quit 1 to 5 years ago'],
  ['quit_under_1y', 'Quit less than a year ago'], ['current', 'Uses tobacco now (smoked or chewed)']
] as const;
export const IDRS_ACTIVITY_OPTIONS = [
  ['vigorous', 'Vigorous exercise or strenuous work'], ['moderate', 'Moderate exercise or work'],
  ['mild', 'Mild exercise or work'], ['sedentary', 'No exercise, sedentary work']
] as const;

const optNum = z.preprocess(v => (v === '' || v === null || v === undefined ? null : Number(v)), z.number().finite().positive().nullable());
const optBool = z.preprocess(v => (v === 'yes' || v === true ? true : v === 'no' || v === false ? false : null), z.boolean().nullable());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a date');

export const visitSchema = z.object({
  label: z.enum(VISIT_LABELS),
  visit_date: isoDate,
  ...Object.fromEntries(FIELDS.map(f => [f.key, optNum])) as Record<MeasureKey, typeof optNum>,
  activity_minutes: z.preprocess(v => (v === '' || v == null ? null : Number(v)), z.number().int().min(0).max(3000).nullable()),
  sleep_hours: z.preprocess(v => (v === '' || v == null ? null : Number(v)), z.number().min(0).max(24).nullable()),
  tobacco: z.preprocess(v => (v === '' || v == null ? null : v), z.enum(['never', 'quit_5y_plus', 'quit_1_5y', 'quit_under_1y', 'current']).nullable()),
  secondhand_smoke: optBool,
  idrs_activity: z.preprocess(v => (v === '' || v == null ? null : v), z.enum(['vigorous', 'moderate', 'mild', 'sedentary']).nullable()),
  on_bp_meds: optBool,
  on_lipid_meds: optBool,
  has_diabetes: optBool,
  confirmed: z.preprocess(v => v === 'on' || v === true || v === 'true', z.boolean())
}).superRefine((v, ctx) => {
  if (v.weight == null && v.waist == null && (v.sbp == null || v.dbp == null) && v.fpg == null)
    ctx.addIssue({ code: 'custom', message: 'Enter at least one of weight, waist, blood pressure (both values) or fasting glucose.', path: ['weight'] });
  if ((v.sbp == null) !== (v.dbp == null)) ctx.addIssue({ code: 'custom', message: 'Enter both systolic and diastolic pressure, or neither.', path: ['sbp'] });
  if (v.sbp != null && v.dbp != null && v.dbp >= v.sbp) ctx.addIssue({ code: 'custom', message: 'Diastolic pressure must be lower than systolic. Check the order.', path: ['dbp'] });
});
export type VisitInput = z.infer<typeof visitSchema>;

/** Values outside plausible ranges. Each needs confirmation before saving. */
export function plausibilityWarnings(v: Partial<Record<MeasureKey, number | null>>): string[] {
  return FIELDS.filter(f => v[f.key] != null && (v[f.key]! < f.min || v[f.key]! > f.max))
    .map(f => `${f.label} ${v[f.key]} ${f.unit} is outside the usual range of ${f.min} to ${f.max}.`);
}

export const patientSchema = z.object({
  name: z.string().trim().min(1, 'Enter the patient’s name').max(80),
  dob: isoDate,
  sex: z.enum(['M', 'F']),
  referrer: z.string().trim().min(1, 'Enter who referred the patient').max(80),
  family_history: z.enum(['none', 'one', 'both']),
  triage: z.array(z.enum(['insulin_or_su', 'kidney', 'pregnant', 'eating_disorder', 'recent_admission'])).default([]),
  consent: z.literal(true, { errorMap: () => ({ message: 'Record the patient’s consent before adding them.' }) }),
  consent_version: z.string().min(1)
}).superRefine((v, ctx) => {
  const t = new Date(v.dob + 'T00:00:00Z').getTime(), now = Date.now();
  const age = (now - t) / (365.25 * 86_400_000);
  if (!Number.isFinite(t) || age < 18 || age > 110) ctx.addIssue({ code: 'custom', message: 'The programme is for adults. Check the date of birth.', path: ['dob'] });
});
export type PatientInput = z.infer<typeof patientSchema>;

export const PLATE_TAGS = [['veg', 'Vegetables'], ['protein', 'Protein and pulses'], ['grain', 'Grains and millets'], ['fruit', 'Fruit'], ['dairy', 'Dairy']] as const;
export const PLATE_FLAGS = [['oil', 'Too much oil'], ['sweet', 'Sweet drink or dessert'], ['upf', 'Ultra-processed']] as const;
export const MEALS = ['Breakfast', 'Lunch', 'Snack', 'Dinner'] as const;

export const plateUploadSchema = z.object({
  meal: z.enum(MEALS),
  eaten_on: isoDate,
  eaten_at: z.string().regex(/^\d{2}:\d{2}$/, 'Enter a time'),
  photo: z.string().max(560_000).optional() // base64 JPEG, resized on the device
});

export const plateReviewSchema = z.object({
  tags: z.object({ veg: z.boolean(), protein: z.boolean(), grain: z.boolean(), fruit: z.boolean(), dairy: z.boolean() }),
  flags: z.object({ oil: z.boolean(), sweet: z.boolean(), upf: z.boolean() }),
  score: z.number().int().min(0).max(10),
  comment: z.string().trim().max(300)
});

export const weeklyReviewSchema = z.object({
  week: z.number().int().min(1).max(3),
  review: z.string().trim().max(1000),
  goals: z.string().trim().max(500),
  checkin_attended: z.boolean()
});
