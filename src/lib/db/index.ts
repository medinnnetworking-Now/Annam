// Database access. Postgres in production (DATABASE_URL, Supabase Mumbai), embedded PGlite in
// development and tests. Every write goes through tx(), which names the actor for the audit log.
import 'server-only';
import '../env';
import { MIGRATIONS } from './migrations';

export interface Q {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** Run several statements without parameters (migrations). */
  exec(sql: string): Promise<void>;
}
export interface Actor { account: string; staff: string }
export interface Db extends Q {
  tx<T>(actor: Actor, fn: (q: Q) => Promise<T>, opts?: { retention?: boolean }): Promise<T>;
  close(): Promise<void>;
}

const DATE_OIDS = [1082]; // date -> 'YYYY-MM-DD'
const TIME_OIDS = [1083]; // time -> 'HH:MM:SS'
const TS_OIDS = [1114, 1184]; // timestamps -> ISO strings
const toIso = (v: string) => new Date(v.includes('T') ? v : v.replace(' ', 'T').replace(/([+-]\d\d)$/, '$1:00')).toISOString();

async function setActor(q: Q, actor: Actor, retention: boolean) {
  await q.query(`select set_config('annam.account', $1, true), set_config('annam.staff', $2, true), set_config('annam.retention', $3, true)`, [actor.account, actor.staff, retention ? 'on' : 'off']);
}

async function pglite(dataDir: string): Promise<Db> {
  const { PGlite } = await import('@electric-sql/pglite');
  const parsers: Record<number, (v: string) => unknown> = {};
  for (const o of DATE_OIDS) parsers[o] = v => v;
  for (const o of TIME_OIDS) parsers[o] = v => v;
  for (const o of TS_OIDS) parsers[o] = toIso;
  if (dataDir !== 'memory://') { const fs = await import('node:fs'); fs.mkdirSync(dataDir, { recursive: true }); }
  const pg = new PGlite(dataDir, { parsers });
  await pg.waitReady;
  const wrap = (x: { query: typeof pg.query; exec: typeof pg.exec }): Q => ({
    query: async <T,>(sql: string, params?: unknown[]) => (await x.query<T>(sql, params as unknown[])).rows,
    exec: async (sql: string) => { await x.exec(sql); }
  });
  let chain: Promise<unknown> = Promise.resolve();
  return {
    ...wrap(pg),
    // PGlite runs one connection; queue transactions so they never interleave.
    tx: (actor, fn, opts) => {
      const run = chain.then(() => pg.transaction(async t => { const q = wrap(t); await setActor(q, actor, !!opts?.retention); return fn(q); }));
      chain = run.catch(() => undefined);
      return run;
    },
    close: () => pg.close()
  };
}

const isLocal = (url: string) => /@(localhost|127\.0\.0\.1)[:/]/.test(url);

/**
 * Drop SSL options from the connection string (Supabase and Neon add sslmode=require; the pg driver reads that as
 * full certificate verification, which fails on their pooled hosts). TLS is still on: see the ssl setting below.
 */
export function cleanUrl(url: string): string {
  const u = new URL(url);
  for (const k of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'supa', 'pgbouncer']) u.searchParams.delete(k);
  return u.toString();
}

async function postgres(url: string): Promise<Db> {
  const pgmod = await import('pg');
  const { Pool, types } = pgmod.default ?? pgmod;
  for (const o of DATE_OIDS) types.setTypeParser(o, v => v);
  for (const o of TIME_OIDS) types.setTypeParser(o, v => v);
  for (const o of TS_OIDS) types.setTypeParser(o, v => toIso(v));
  types.setTypeParser(20, v => Number(v)); // count(*) fits in a JS number
  const pool = new Pool({ connectionString: cleanUrl(url), max: 5, ssl: isLocal(url) ? undefined : { rejectUnauthorized: false } });
  const q: Q = { query: async <T,>(sql: string, params?: unknown[]) => (await pool.query(sql, params)).rows as T[], exec: async sql => { await pool.query(sql); } };
  return {
    ...q,
    tx: async (actor, fn, opts) => {
      const c = await pool.connect();
      try {
        await c.query('begin');
        const cq: Q = { query: async <T,>(sql: string, params?: unknown[]) => (await c.query(sql, params)).rows as T[], exec: async sql => { await c.query(sql); } };
        await setActor(cq, actor, !!opts?.retention);
        const r = await fn(cq);
        await c.query('commit');
        return r;
      } catch (e) { await c.query('rollback'); throw e; } finally { c.release(); }
    },
    close: () => pool.end()
  };
}

export const SYSTEM: Actor = { account: 'system', staff: 'System' };

export async function migrate(db: Db) {
  await db.query('create table if not exists schema_migrations (id text primary key, applied_at timestamptz not null default now())');
  const done = new Set((await db.query<{ id: string }>('select id from schema_migrations')).map(r => r.id));
  for (const m of MIGRATIONS) {
    if (done.has(m.id)) continue;
    await db.tx(SYSTEM, async q => { await q.exec(m.sql); await q.query('insert into schema_migrations (id) values ($1)', [m.id]); });
  }
}

/** Open a database without the start-up seeding. Used by tests and scripts. */
/** Where the embedded database lives. Serverless hosts (Vercel) only allow writes under /tmp. */
export function defaultTarget(): string {
  // DATABASE_URL, or POSTGRES_URL as set by Vercel's one-click Neon and Supabase integrations.
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (url) return url;
  if (process.env.ANNAM_PGLITE_DIR) return process.env.ANNAM_PGLITE_DIR;
  return process.env.VERCEL ? '/tmp/annam-db' : '.data/pglite';
}

export async function openDb(target = defaultTarget()): Promise<Db> {
  const db = /^postgres(ql)?:\/\//.test(target) ? await postgres(target) : await pglite(target);
  await migrate(db);
  return db;
}

const g = globalThis as unknown as { __annamDb?: Promise<Db> };

/** The app's shared database: migrated, with the three staff accounts and (in development) sample patients. */
export function getDb(): Promise<Db> {
  if (!g.__annamDb) {
    g.__annamDb = (async () => {
      const db = await openDb();
      const { ensureAccounts } = await import('../auth/accounts');
      await ensureAccounts(db);
      if (process.env.ANNAM_SEED_SAMPLES === 'true' || (process.env.NODE_ENV !== 'production' && process.env.ANNAM_SEED_SAMPLES !== 'false')) {
        const { seedSamples } = await import('./seed');
        await seedSamples(db);
      }
      return db;
    })();
    g.__annamDb.catch(() => { g.__annamDb = undefined; });
  }
  return g.__annamDb;
}
