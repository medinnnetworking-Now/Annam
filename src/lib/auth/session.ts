// Sessions: a signed token in an httpOnly cookie. The signature lets any server instance check it,
// so a sign-in holds even when requests land on different servers. The database keeps a row per session
// (by SHA-256 of the token) for the audit trail and for sign-out.
import 'server-only';
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getDb, type Actor, type Db } from '../db';
import { ACCOUNTS, can, LOCK_MINUTES, MAX_FAILED_SIGN_INS, SESSION_HOURS, type Permission, type Role } from './roles';
import { verifyPassword } from './password';
import { verifyTotp } from './totp';

export const COOKIE = 'annam_session';
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

/** Signing key: ANNAM_SESSION_SECRET, or one derived from the server's other secrets (the same on every instance). */
function signingKey(): string {
  if (process.env.ANNAM_SESSION_SECRET) return process.env.ANNAM_SESSION_SECRET;
  const parts = [process.env.CRON_SECRET, process.env.ANNAM_ADMIN_TOTP_SECRET, ...ACCOUNTS.map(a => process.env[a.env])];
  if (process.env.NODE_ENV === 'production' && !parts.some(Boolean)) throw new Error('No session signing secret configured');
  return sha('annam-session|' + parts.map(p => p ?? '').join('|'));
}
const sign = (body: string) => createHmac('sha256', signingKey()).update(body).digest('base64url');

/** True when the server has the settings sign-in needs. Used to show a setup message instead of failing. */
export function signInConfigured(): { ok: boolean; missing: string[] } {
  const missing = ACCOUNTS.filter(a => !process.env[a.env]?.startsWith('scrypt$')).map(a => a.env);
  if (!process.env.ANNAM_ADMIN_TOTP_SECRET) missing.push('ANNAM_ADMIN_TOTP_SECRET');
  return { ok: process.env.NODE_ENV !== 'production' || missing.length === 0, missing };
}

interface TokenBody { u: string; n: string; exp: number; j: string }
function makeToken(b: TokenBody) { const body = Buffer.from(JSON.stringify(b)).toString('base64url'); return `${body}.${sign(body)}`; }
function readToken(t: string): TokenBody | null {
  const [body, sig] = t.split('.');
  if (!body || !sig) return null;
  let want: Buffer;
  try { want = Buffer.from(sign(body)); } catch { return null; } // no signing key yet: treat as signed out
  const got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  try {
    const b = JSON.parse(Buffer.from(body, 'base64url').toString()) as TokenBody;
    return typeof b.u === 'string' && typeof b.n === 'string' && b.exp > Date.now() ? b : null;
  } catch { return null; }
}

export interface Session { id: string; username: string; role: Role; displayName: string; staffName: string; expiresAt: string }
export const actorOf = (s: Session): Actor => ({ account: s.username, staff: s.staffName });

export type SignInResult = { ok: true; role: Role } | { ok: false; error: string };

async function audit(db: Db, account: string | null, staff: string | null, action: string, meta: Record<string, unknown> = {}) {
  await db.query('insert into audit_events (account, staff_name, action, meta) values ($1, $2, $3, $4)', [account, staff, action, JSON.stringify(meta)]);
}

export async function signIn(username: string, password: string, staffName: string, code: string | undefined): Promise<SignInResult> {
  const db = await getDb();
  const generic = { ok: false as const, error: 'That username and password do not match. Check both and try again.' };
  const rows = await db.query<{ username: string; role: Role; password_hash: string; failed_attempts: number; locked_until: string | null }>(
    'select username, role, password_hash, failed_attempts, locked_until from accounts where username = $1', [username.trim().toLowerCase()]);
  const a = rows[0];
  if (!a) { verifyPassword(password, '!'); await audit(db, null, null, 'sign_in_failed', { reason: 'unknown_user' }); return generic; }
  if (a.locked_until && new Date(a.locked_until) > new Date()) {
    await audit(db, a.username, null, 'sign_in_blocked');
    return { ok: false, error: `This account is locked after ${MAX_FAILED_SIGN_INS} failed attempts. Try again in ${LOCK_MINUTES} minutes.` };
  }
  let ok = verifyPassword(password.trim(), a.password_hash);
  if (ok && a.role === 'admin') {
    const secret = process.env.ANNAM_ADMIN_TOTP_SECRET;
    if (secret) ok = !!code && verifyTotp(secret, code);
    else if (process.env.NODE_ENV === 'production') {
      await audit(db, a.username, null, 'sign_in_failed', { reason: 'admin_2fa_not_configured' });
      return { ok: false, error: 'Admin sign-in needs two-factor authentication. Set ANNAM_ADMIN_TOTP_SECRET on the server.' };
    }
  }
  if (!ok) {
    const fails = a.failed_attempts + 1;
    await db.query(`update accounts set failed_attempts = $2::int, locked_until = case when $2::int >= $3::int then now() + make_interval(mins => $4::int) else locked_until end where username = $1`,
      [a.username, fails, MAX_FAILED_SIGN_INS, LOCK_MINUTES]);
    await audit(db, a.username, null, 'sign_in_failed', { reason: 'bad_credentials' });
    return a.role === 'admin' && process.env.ANNAM_ADMIN_TOTP_SECRET ? { ok: false, error: 'That username, password or code does not match. Check them and try again.' } : generic;
  }
  await db.query('update accounts set failed_attempts = 0, locked_until = null where username = $1', [a.username]);
  const hours = SESSION_HOURS[a.role];
  const token = makeToken({ u: a.username, n: staffName, exp: Date.now() + hours * 3_600_000, j: randomBytes(12).toString('base64url') });
  await db.query(`insert into sessions (id, username, staff_name, expires_at) values ($1, $2, $3, now() + make_interval(hours => $4::int))`, [sha(token), a.username, staffName, hours]);
  await audit(db, a.username, staffName, 'sign_in');
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: hours * 3600 });
  return { ok: true, role: a.role };
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 1000) return null;
  const b = readToken(token);
  const account = b && ACCOUNTS.find(a => a.username === b.u);
  if (!b || !account) return null;
  // Signed out on this database? (A row missing here only means the sign-in happened on another instance.)
  const db = await getDb();
  const [row] = await db.query<{ revoked_at: string | null }>('select revoked_at from sessions where id = $1', [sha(token)]);
  if (row?.revoked_at) return null;
  return { id: sha(token), username: account.username, role: account.role, displayName: account.displayName, staffName: b.n, expiresAt: new Date(b.exp).toISOString() };
}

/** For pages and actions: the session, or a redirect to sign-in with a note that the session ended. */
export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect((await cookies()).get(COOKIE) ? '/login?ended=1' : '/login');
  return s;
}

/** For pages: a session that holds the permission. Others get "not found", never data. */
export async function requirePermission(p: Permission): Promise<Session> {
  const s = await requireSession();
  if (!can(s.role, p)) notFound();
  return s;
}

export async function signOut() {
  const jar = await cookies(); const token = jar.get(COOKIE)?.value;
  if (token) {
    const db = await getDb();
    const b = readToken(token);
    await db.query('update sessions set revoked_at = now() where id = $1', [sha(token)]);
    if (b) {
      // Record the sign-out even when the sign-in happened on another instance, so the revocation holds here.
      await db.query(`insert into sessions (id, username, staff_name, expires_at, revoked_at) values ($1, $2, $3, $4, now()) on conflict (id) do nothing`, [sha(token), b.u, b.n, new Date(b.exp).toISOString()]);
      await audit(db, b.u, b.n, 'sign_out');
    }
  }
  jar.delete(COOKIE);
}
