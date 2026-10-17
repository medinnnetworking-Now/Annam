// Shared by the document scripts. Every clinical number comes from the app's own settings, so the
// printed guides always match what Annam does (CLAUDE.md rule 6). Node 22 reads these .ts files directly.
import * as C from '../../src/lib/scoring/config.ts';
import { LOCK_MINUTES, MAX_FAILED_SIGN_INS, SESSION_HOURS } from '../../src/lib/auth/roles.ts';

export const esc = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const DEFAULT_SITE = 'https://annam-medinn.vercel.app';
/** The site's origin from any address (login page, trailing slash, empty): https://host only. */
export function siteOrigin(raw) {
  try { return new URL(raw || DEFAULT_SITE).origin; } catch { return DEFAULT_SITE; }
}

export const SCORE_VERSION = C.SCORE_VERSION;
export const DRAFT_NOTE = `Score version ${C.SCORE_VERSION}. All thresholds are drafts, to be signed off by the clinical lead.`;

const R = C.RED_FLAGS;
/** The raw red-flag thresholds, for inline mentions. */
export const RF = R;
export const RED_FLAGS = [
  `Blood pressure ${R.sbpFrom}/${R.dbpFrom} or higher (either number)`,
  `Fasting glucose ${R.fpgFrom} mg/dL or higher, or below ${R.fpgBelow}`,
  `FIB-4 above ${R.fib4Above}`,
  `eGFR below ${R.egfrBelow}`,
  `Triglycerides ${R.tgFrom} mg/dL or higher`
];

const { high, moderate } = C.SCORE_CATEGORIES;
export const MIN_PARTS = C.MIN_COMPONENTS_FOR_SCORE;
export const CATEGORY_TEXT = `${high}+ high, ${moderate}–${high - 1} moderate, under ${moderate} low`;
/** [status, meaning, background, text colour] in the order the app checks them. */
export const STATUS_ROWS = [
  ['See your doctor', 'Any red flag. Tell the doctor the same day.', '#F7DDD6', '#8A2B18'],
  ['Not enough data', `Fewer than ${MIN_PARTS} of the 8 score parts recorded.`, '#F1F3F1', '#5B6B62'],
  ['Needs attention', `Score under ${moderate}, or more than ${C.SCORE_DROP_ATTENTION} points lower than the last visit.`, '#FBEBD0', '#7A4E08'],
  ['On track', `No red flags, and a score of ${moderate} or more that is steady or rising.`, '#E3EEE6', '#183D2B']
];

export const LOCKOUT = `${MAX_FAILED_SIGN_INS} wrong tries lock the login for ${LOCK_MINUTES} minutes; after that the count starts again`;
export const LOCK_MINUTES_TEXT = `${LOCK_MINUTES} minutes`;
export const SESSION_TEXT = `Staff are signed out after ${SESSION_HOURS.clinic} hours, the admin after ${SESSION_HOURS.admin}`;

export const RISK = {
  idrs: `${C.IDRS.high}+ high, ${C.IDRS.moderate}–${C.IDRS.high - 1} moderate, under ${C.IDRS.moderate} low`,
  fib4: `Under ${C.FIB4.low} low, above ${C.FIB4.high} high`,
  whtr: `Under ${C.WHTR.increased} healthy; ${C.WHTR.high}+ high`,
  metSyn: `${C.MET_SYN.needed} of 5 criteria = present`
};

/** Error messages exactly as the sign-in page shows them. Keep in step with src/lib/auth/session.ts. */
export const SIGN_IN_ERRORS = [
  ['“That username and password do not match”', 'Check capital letters; copy-paste the password.'],
  ['“That username, password or code does not match” (admin)', 'Check the password, and type the 6-digit code showing now in Google Authenticator.'],
  ['“This account is locked”', `Wait ${LOCK_MINUTES} minutes, then try again.`],
  ['“Something went wrong”', 'Tap Try again. If it repeats, tell the admin what you were doing.'],
  ['Box saying “This server is not set up yet” or “cannot reach its database”', 'Server settings need attention. Tell the admin.']
];
