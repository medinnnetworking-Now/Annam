// Annam score configuration. Every number that drives a score, band or flag lives here.
// Spec and sources: docs/SCORING.md. Changing anything here means bumping SCORE_VERSION.
// Status: draft, to be signed off by the clinical lead.

export const SCORE_VERSION = '2026.10-le8-sa.1';

/** Components needed before a total score is shown at all. */
export const MIN_COMPONENTS_FOR_SCORE = 4;

/** Category cut-offs, from AHA Life's Essential 8 (Lloyd-Jones 2022). */
export const SCORE_CATEGORIES = { high: 80, moderate: 50 } as const;

/** A fall of more than this many points, on the components measured both times, means "Needs attention". */
export const SCORE_DROP_ATTENTION = 5;

/**
 * How far back a value may be carried forward to a later visit, in days.
 * null = never carried (must be measured at that visit). Infinity = always carried (adult height).
 */
export const CARRY_FORWARD_DAYS = {
  body: null, // weight, waist, hip, blood pressure: measured at the visit
  height: Infinity,
  labs: 120, // HbA1c, lipids, liver, platelets, creatinine, glucose
  lifestyle: 30 // activity, sleep, tobacco, medicines, diabetes history
} as const;

/** Diet component: plates reviewed in this many days up to and including the visit date. */
export const DIET_WINDOW_DAYS = 7;

/** Programme length in days. */
export const PROGRAMME_DAYS = 21;

// ---- Life's Essential 8 bands (points out of 100). Lower bound inclusive. ----

/** Moderate or vigorous activity, minutes per week. */
export const ACTIVITY_BANDS: [minMinutes: number, points: number][] = [
  [150, 100], [120, 90], [90, 80], [60, 60], [30, 40], [1, 20], [0, 0]
];

/** Average sleep, hours per night: [from, toExclusive, points]. */
export const SLEEP_BANDS: [from: number, to: number, points: number][] = [
  [7, 9, 100], [9, 10, 90], [6, 7, 70], [5, 6, 40], [10, Infinity, 40], [4, 5, 20], [0, 4, 0]
];

export const TOBACCO_POINTS = {
  never: 100,
  quit_5y_plus: 75,
  quit_1_5y: 50,
  quit_under_1y: 25,
  current: 0
} as const;
export const SECONDHAND_SMOKE_PENALTY = 20;

/**
 * BMI bands. LE8 uses 25 / 30 / 35 / 40. Annam uses the WHO public health action points for Asian
 * populations (WHO Expert Consultation, Lancet 2004): 23 / 27.5 / 32.5 / 37.5.
 */
export const BMI_BANDS: [maxExclusive: number, points: number][] = [
  [23, 100], [27.5, 70], [32.5, 30], [37.5, 15], [Infinity, 0]
];
export const BMI_UNDERWEIGHT = 18.5;

/** Non-HDL cholesterol, mg/dL. */
export const NON_HDL_BANDS: [maxExclusive: number, points: number][] = [
  [130, 100], [160, 60], [190, 40], [220, 20], [Infinity, 0]
];
export const LIPID_TREATED_PENALTY = 20;

/** Glucose, people without diabetes. ADA 2025 categories. */
export const GLUCOSE_NORMAL = { fpgBelow: 100, hba1cBelow: 5.7 } as const;
export const GLUCOSE_DIABETES = { fpgFrom: 126, hba1cFrom: 6.5 } as const;
export const GLUCOSE_NO_DIABETES_POINTS = { normal: 100, prediabetes: 60 } as const;
/** HbA1c bands for people with diabetes. */
export const GLUCOSE_DIABETES_BANDS: [maxExclusive: number, points: number][] = [
  [7, 40], [8, 30], [9, 20], [10, 10], [Infinity, 0]
];

/** Blood pressure, mmHg. A reading falls in the worst band either value reaches. */
export const BP_BANDS = [
  { sbpFrom: 160, dbpFrom: 100, points: 0 },
  { sbpFrom: 140, dbpFrom: 90, points: 25 },
  { sbpFrom: 130, dbpFrom: 80, points: 50 },
  { sbpFrom: 120, dbpFrom: Infinity, points: 75 },
  { sbpFrom: 0, dbpFrom: 0, points: 100 }
] as const;
export const BP_TREATED_PENALTY = 20;

// ---- Risk tools ----

/** Indian Diabetes Risk Score (Mohan et al., JAPI 2005). */
export const IDRS = {
  age: [[35, 0], [50, 20], [Infinity, 30]] as [number, number][],
  waistF: [[80, 0], [90, 10], [Infinity, 20]] as [number, number][],
  waistM: [[90, 0], [100, 10], [Infinity, 20]] as [number, number][],
  activity: { vigorous: 0, moderate: 10, mild: 20, sedentary: 30 },
  family: { none: 0, one: 10, both: 20 },
  high: 60,
  moderate: 30
};

/** FIB-4 (Sterling et al., Hepatology 2006). */
export const FIB4 = { low: 1.3, high: 2.67, cautionUnder: 35, cautionOver: 65 } as const;

/** Waist-to-height ratio (NICE NG246, 2022/2025). */
export const WHTR = { increased: 0.5, high: 0.6 } as const;

/** Metabolic syndrome, harmonised definition (Alberti et al., Circulation 2009), South Asian waist. */
export const MET_SYN = {
  waistM: 90, waistF: 80, tg: 150, hdlM: 40, hdlF: 50, sbp: 130, dbp: 85, fpg: 100, needed: 3
} as const;

/** KDIGO 2024 eGFR categories, mL/min/1.73m². */
export const EGFR_STAGES: [minInclusive: number, stage: string][] = [
  [90, 'G1'], [60, 'G2'], [45, 'G3a'], [30, 'G3b'], [15, 'G4'], [0, 'G5']
];

// ---- Red flags: alert the doctor the same day. Draft, to confirm with the clinical lead. ----
export const RED_FLAGS = {
  sbpFrom: 160,
  dbpFrom: 100,
  fpgFrom: 250,
  fpgBelow: 70, // ADA level 1 hypoglycaemia
  fib4Above: 2.67,
  egfrBelow: 30, // KDIGO G4 or worse
  tgFrom: 1000 // Endocrine Society: very severe, pancreatitis risk
} as const;

// ---- Plate score suggestion (unchanged from the kit). The nutritionist sets the final score. ----
export const PLATE_POINTS = { veg: 4, protein: 3, grain: 2, fruit: 1, dairy: 0 } as const;
export const PLATE_PENALTIES = { oil: 1.5, sweet: 1.5, upf: 2 } as const;
