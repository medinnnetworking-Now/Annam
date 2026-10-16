// Admin: cohort aggregates (no names, no group under 5), the audit log, and the retention job.
import type { Db } from '../db';
import { SYSTEM } from '../db';
import { check, type Ctx } from './context';

export const MIN_GROUP = 5;

export interface Cohort {
  suppressed: boolean; enrolled: number; active: number; completed: number; withdrawn: number;
  avgScoreChange: number | null; avgDaysLogged: number | null; checkinShare: number | null; withScoreChange: number;
}

export async function cohort(db: Db, ctx: Ctx, from: string | null, to: string | null, includeSamples = false): Promise<Cohort> {
  check(ctx, 'cohort.view');
  const [r] = await db.query<Omit<Cohort, 'suppressed'>>(`
    with p as (
      select * from patients where (not is_sample or $3::boolean)
        and ($1::date is null or created_at::date >= $1::date) and ($2::date is null or created_at::date <= $2::date)
    ), latest as (
      select distinct on (s.patient_id) s.patient_id, s.change_since_baseline from score_snapshots s join visits v on v.id = s.visit_id
       where s.patient_id in (select id from p) order by s.patient_id, v.visit_date desc, v.created_at desc
    ), logged as (
      select p.id, count(distinct pl.eaten_on) filter (where pl.eaten_on between p.start_date and p.start_date + 20) as days
        from p left join plates pl on pl.patient_id = p.id where p.start_date is not null group by p.id
    ), checkins as (
      select count(*) filter (where checkin_attended)::float8 / nullif(count(*), 0) as share from weekly_reviews where patient_id in (select id from p)
    )
    select (select count(*)::int from p) as enrolled,
      (select count(*)::int from p where state in ('active','checkin_due','checkin_recorded','report_draft')) as active,
      (select count(*)::int from p where state in ('report_approved','next_step')) as completed,
      (select count(*)::int from p where state = 'withdrawn') as withdrawn,
      (select round(avg(change_since_baseline)::numeric, 1)::float8 from latest where change_since_baseline is not null) as "avgScoreChange",
      (select count(*)::int from latest where change_since_baseline is not null) as "withScoreChange",
      (select round(avg(days)::numeric, 1)::float8 from logged) as "avgDaysLogged",
      (select share from checkins) as "checkinShare"`, [from, to, includeSamples]);
  const row = r!;
  if (row.enrolled < MIN_GROUP) return { suppressed: true, enrolled: 0, active: 0, completed: 0, withdrawn: 0, avgScoreChange: null, avgDaysLogged: null, checkinShare: null, withScoreChange: 0 };
  return { ...row, suppressed: false, avgScoreChange: row.withScoreChange >= MIN_GROUP ? row.avgScoreChange : null };
}

export interface AuditRow { id: number; at: string; account: string | null; staff_name: string | null; action: string; table_name: string | null; row_id: string | null; patient_id: string | null; meta: Record<string, unknown> }

export async function auditLog(db: Db, ctx: Ctx, f: { from?: string; to?: string; account?: string; patient?: string; limit?: number }, purpose: 'view' | 'export'): Promise<AuditRow[]> {
  check(ctx, 'audit.view');
  const rows = await db.query<AuditRow>(`
    select id, at, account, staff_name, action, table_name, row_id, patient_id, meta from audit_events
     where ($1::date is null or at >= $1::date) and ($2::date is null or at < $2::date + 1)
       and ($3::text is null or account = $3) and ($4::text is null or patient_id::text = $4)
     order by id desc limit $5`,
    [f.from || null, f.to || null, f.account || null, f.patient || null, Math.min(f.limit ?? 200, 5000)]);
  await db.query(`insert into audit_events (account, staff_name, action, meta) values ($1, $2, $3, $4)`,
    [ctx.actor.account, ctx.actor.staff, purpose === 'view' ? 'audit_view' : 'audit_export', JSON.stringify({ filters: { from: f.from ?? null, to: f.to ?? null, account: f.account ?? null, patient: f.patient ?? null } })]);
  return rows;
}

/**
 * Retention: delete patients whose consent was withdrawn, or whose last report was approved, more than
 * `days` ago. Does nothing until the period is set with legal advice (ANNAM_RETENTION_DAYS).
 * The audit log keeps the ids of deleted rows, never names or values.
 */
export async function runRetention(db: Db, days: number | null, now = new Date()): Promise<{ deleted: number; skipped: boolean }> {
  if (days === null || !Number.isFinite(days) || days <= 0) return { deleted: 0, skipped: true };
  const cutoff = new Date(now.getTime() - days * 86_400_000).toISOString();
  return db.tx(SYSTEM, async q => {
    const rows = await q.query<{ id: string }>(`
      select p.id from patients p
       where (exists (select 1 from consents c where c.patient_id = p.id and c.withdrawn_at < $1)
              and not exists (select 1 from consents c where c.patient_id = p.id and c.withdrawn_at is null))
          or (p.state in ('report_approved', 'next_step') and (select max(approved_at) from reports r where r.patient_id = p.id) < $1)`, [cutoff]);
    for (const r of rows) await q.query('delete from patients where id = $1', [r.id]);
    await q.query(`insert into audit_events (account, staff_name, action, meta) values ('system', 'System', 'retention_run', $1)`, [JSON.stringify({ days, deleted: rows.length })]);
    return { deleted: rows.length, skipped: false };
  }, { retention: true });
}
