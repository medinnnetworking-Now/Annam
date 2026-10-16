// Sessions: a random token in an httpOnly cookie, stored only as a SHA-256 hash in the database.
import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { getDb, type Actor, type Db } from '../db';
import { can, LOCK_MINUTES, MAX_FAILED_SIGN_INS, SESSION_HOURS, type Permission, type Role } from './roles';
import { verifyPassword } from './password';
import { verifyTotp } from './totp';

export const COOKIE = 'annam_session';
const sha = (t: string) => createHash('sha256').update(t).digest('hex');

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
  let ok = verifyPassword(password, a.password_hash);
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
  const token = randomBytes(32).toString('base64url');
  const hours = SESSION_HOURS[a.role];
  await db.query(`insert into sessions (id, username, staff_name, expires_at) values ($1, $2, $3, now() + make_interval(hours => $4::int))`, [sha(token), a.username, staffName, hours]);
  await audit(db, a.username, staffName, 'sign_in');
  (await cookies()).set(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: hours * 3600 });
  return { ok: true, role: a.role };
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const db = await getDb();
  const rows = await db.query<{ id: string; username: string; role: Role; display_name: string; staff_name: string; expires_at: string }>(
    `select s.id, s.username, a.role, a.display_name, s.staff_name, s.expires_at from sessions s join accounts a using (username)
      where s.id = $1 and s.revoked_at is null and s.expires_at > now()`, [sha(token)]);
  const r = rows[0];
  return r ? { id: r.id, username: r.username, role: r.role, displayName: r.display_name, staffName: r.staff_name, expiresAt: r.expires_at } : null;
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
    const r = await db.query<{ username: string; staff_name: string }>('update sessions set revoked_at = now() where id = $1 returning username, staff_name', [sha(token)]);
    if (r[0]) await audit(db, r[0].username, r[0].staff_name, 'sign_out');
  }
  jar.delete(COOKIE);
}
