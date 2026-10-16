// Patient-facing summary. Every string the patient reads lives here, ready for a Malayalam version.
// Copy rules: plain words; never "reverse", "cure", "longevity", "biological age" or "remission".
import type { ReportContent } from '../lib/data/reports';

export const SUMMARY_STRINGS = {
  title: 'Your Annam summary',
  improvedHeading: 'What went well',
  goalsHeading: 'Your goals',
  nextHeading: 'What happens next',
  noChange: 'Your measures were taken once so far. Your next visit will show how things are changing.',
  scoreUp: (n: number) => `Your health score went up by ${n} points.`,
  scoreSame: 'Your health score stayed about the same.',
  scoreDown: (n: number) => `Your health score went down by ${n} points. Your care team will help you with this.`,
  logged: (d: number, of: number) => `You shared your meals on ${d} of ${of} days.`,
  measure: { weight: (d: number) => `Your weight went down by ${d} kg.`, waist: (d: number) => `Your waist went down by ${d} cm.`, sbp: () => 'Your blood pressure came down.', fpg: () => 'Your fasting sugar came down.', tg: () => 'Your triglycerides (a blood fat) came down.' } as Record<string, (d: number) => string>,
  noGoals: 'Keep the balanced plate: half vegetables, a quarter protein and pulses, a quarter grains and millets.',
  next: {
    '12-week programme': 'Your doctor suggests the 12-week programme, to keep building these habits with your nutritionist.',
    'Condition track': 'Your doctor suggests a programme focused on your condition, with closer support from a dietitian.',
    'Maintenance': 'Your doctor suggests a maintenance plan: keep your new habits, with lighter check-ins.',
    'Back to the referring doctor': 'Please see your referring doctor, who will talk with you about your next steps.'
  } as Record<string, string>,
  footer: 'This summary supports your care. It does not diagnose. Do not change any medicine without talking to your doctor.'
};

export function summaryFor(c: ReportContent, nextStep: string) {
  const S = SUMMARY_STRINGS;
  const went: string[] = [];
  if (c.to) {
    for (const m of c.measures) {
      const f = S.measure[m.key];
      if (f && m.baseline !== null && m.latest !== null && m.latest < m.baseline) went.push(f(Math.round((m.baseline - m.latest) * 10) / 10));
    }
    if (c.score.change !== null) went.unshift(c.score.change > 0 ? S.scoreUp(c.score.change) : c.score.change < 0 ? S.scoreDown(-c.score.change) : S.scoreSame);
  } else went.push(S.noChange);
  if (c.adherence) went.push(S.logged(c.adherence.daysLogged, c.adherence.daysElapsed));
  const goals = c.review?.goals ? c.review.goals.split(/(?<=\.)\s+/).slice(0, 2) : [S.noGoals];
  return {
    title: S.title,
    sections: [
      { heading: S.improvedHeading, lines: went },
      { heading: S.goalsHeading, lines: goals },
      { heading: S.nextHeading, lines: [S.next[nextStep] ?? nextStep] }
    ],
    footer: S.footer
  };
}
