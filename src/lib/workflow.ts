// Enrolment states and the transitions staff may make. Spec: docs/WORKFLOW.md
export const STATES = [
  'referred', 'consented', 'baseline_recorded', 'cleared', 'active', 'checkin_due', 'checkin_recorded',
  'report_draft', 'report_approved', 'next_step', 'not_suitable', 'withdrawn', 'paused'
] as const;
export type EnrolState = (typeof STATES)[number];

export const STATE_LABELS: Record<EnrolState, string> = {
  referred: 'Referred', consented: 'Consented', baseline_recorded: 'Baseline recorded', cleared: 'Cleared by doctor',
  active: 'In programme', checkin_due: 'Check-in due', checkin_recorded: 'Check-in recorded', report_draft: 'Report draft',
  report_approved: 'Report approved', next_step: 'Next step chosen', not_suitable: 'Not suitable', withdrawn: 'Withdrawn', paused: 'Paused'
};

/** Moves staff choose by hand. Other moves happen automatically (see AUTO below). */
export const MANUAL: Partial<Record<EnrolState, EnrolState[]>> = {
  consented: ['not_suitable', 'paused'],
  baseline_recorded: ['cleared', 'not_suitable', 'paused'],
  not_suitable: ['cleared'],
  cleared: ['active', 'paused'],
  active: ['paused'],
  checkin_due: ['paused'],
  paused: ['active']
};

/**
 * Automatic moves, made by the system when the matching event is saved:
 * consent recorded -> consented; first visit -> baseline_recorded (or not_suitable when triage flags);
 * day 19 or later -> checkin_due; week 3 visit -> checkin_recorded; report draft -> report_draft;
 * approval -> report_approved; next step recorded with approval -> next_step; consent withdrawn -> withdrawn.
 */
export const CHECKIN_DUE_FROM_DAY = 19;

/** States in which new clinical data may be entered. */
export const ACCEPTS_DATA: EnrolState[] = ['consented', 'baseline_recorded', 'cleared', 'active', 'checkin_due', 'checkin_recorded', 'report_draft', 'report_approved', 'next_step', 'not_suitable'];

/** States in which plates may be uploaded: from the baseline (a typical day's plates) to the report. */
export const ACCEPTS_PLATES: EnrolState[] = ['baseline_recorded', 'cleared', 'active', 'checkin_due', 'checkin_recorded', 'report_draft'];

export function canMove(from: EnrolState, to: EnrolState): boolean {
  return (MANUAL[from] ?? []).includes(to);
}

/** Moving to cleared from not_suitable needs both the doctor and the clinical lead (docs/WORKFLOW.md). */
export function clearanceNeeds(from: EnrolState, triageFlags: string[]): { doctor: true; clinicalLead: boolean } {
  return { doctor: true, clinicalLead: from === 'not_suitable' || triageFlags.length > 0 };
}

export const TRIAGE_QUESTIONS = [
  ['insulin_or_su', 'Takes insulin, or a medicine that can cause low blood sugar (for example a sulfonylurea)'],
  ['kidney', 'Has kidney disease'],
  ['pregnant', 'Is pregnant or breastfeeding'],
  ['eating_disorder', 'Has or had an eating disorder'],
  ['recent_admission', 'Was admitted to hospital in the last 3 months']
] as const;
export type TriageKey = (typeof TRIAGE_QUESTIONS)[number][0];

export const NEXT_STEPS = ['12-week programme', 'Condition track', 'Maintenance', 'Back to the referring doctor'] as const;
export type NextStep = (typeof NEXT_STEPS)[number];
