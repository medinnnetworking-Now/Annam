import { defaultTarget, getDb } from '@/lib/db';
import { signInConfigured } from '@/lib/auth/session';
import { ACCOUNTS } from '@/lib/auth/roles';

// Setup check for the admin. Shows which settings exist (never their values) and whether the database works.
export const dynamic = 'force-dynamic';

export async function GET() {
  const target = defaultTarget();
  const kind = /^postgres(ql)?:\/\//.test(target) ? 'postgres (DATABASE_URL)' : 'embedded demo database (resets)';
  let database: { ok: boolean; problem?: string } = { ok: true };
  try {
    const db = await getDb();
    await db.query('select 1');
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : 'unknown error';
    database = { ok: false, problem: msg.replace(/postgres(ql)?:\/\/\S+/g, '[connection string]').slice(0, 300) };
  }
  const has = (k: string) => (process.env[k] ? 'set' : 'missing');
  const config = signInConfigured();
  const body = {
    ok: database.ok && config.ok,
    database: { kind, ...database },
    settings: {
      ...Object.fromEntries(ACCOUNTS.map(a => [a.env, process.env[a.env]?.startsWith('scrypt$') ? 'set' : process.env[a.env] ? 'set but not a valid hash' : 'missing'])),
      ANNAM_ADMIN_TOTP_SECRET: has('ANNAM_ADMIN_TOTP_SECRET'),
      CRON_SECRET: has('CRON_SECRET'),
      DATABASE_URL: has('DATABASE_URL'),
      ANNAM_DEMO: process.env.ANNAM_DEMO ?? 'missing',
      ANNAM_SEED_SAMPLES: process.env.ANNAM_SEED_SAMPLES ?? 'missing'
    },
    region: process.env.VERCEL_REGION ?? 'local',
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'local'
  };
  return Response.json(body, { status: body.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
