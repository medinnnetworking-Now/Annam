// Programme calendar and adherence. Pure functions, no I/O.
import { PROGRAMME_DAYS } from './scoring/config';
import { toTime } from './scoring';

const DAY = 86_400_000;
export const WEEKS = Math.ceil(PROGRAMME_DAYS / 7);

/** Today's date in Asia/Kolkata as YYYY-MM-DD. */
export function todayIST(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

export function addDays(date: string, n: number): string {
  return new Date(toTime(date) + n * DAY).toISOString().slice(0, 10);
}

/** Day of the programme, 1-based. Below 1 before the start; not capped. */
export function programmeDay(start: string, on: string): number {
  return Math.floor((toTime(on) - toTime(start)) / DAY) + 1;
}

/** Programme week for a date, following the start date rather than the calendar week. */
export function weekOf(start: string, date: string): number {
  return Math.floor((toTime(date) - toTime(start)) / (7 * DAY)) + 1;
}

export interface Adherence {
  daysElapsed: number; daysLogged: number; weeksCompleted: number; checkinsAttended: number;
  platesUploaded: number; platesReviewed: number;
}

/**
 * Adherence over the programme, up to a date. Only days inside the programme window count.
 * Check-ins are counted against completed weeks, so nobody is marked down on day one.
 */
export function adherence(start: string, upTo: string, plates: { date: string; reviewed: boolean }[], checkinWeeks: number[]): Adherence {
  const day = programmeDay(start, upTo);
  const daysElapsed = Math.max(0, Math.min(PROGRAMME_DAYS, day));
  const inWindow = plates.filter(p => { const d = programmeDay(start, p.date); return d >= 1 && d <= daysElapsed; });
  const weeksCompleted = Math.min(WEEKS, Math.floor(daysElapsed / 7));
  return {
    daysElapsed,
    daysLogged: new Set(inWindow.map(p => p.date)).size,
    weeksCompleted,
    checkinsAttended: new Set(checkinWeeks.filter(w => w >= 1 && w <= WEEKS)).size,
    platesUploaded: inWindow.length,
    platesReviewed: inWindow.filter(p => p.reviewed).length
  };
}
