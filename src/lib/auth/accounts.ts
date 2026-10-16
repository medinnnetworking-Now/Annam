// The three fixed staff accounts. Password hashes come from environment variables; in development
// only, missing hashes fall back to the documented development passwords. Production refuses them.
import { ACCOUNTS } from './roles';
import { hashPassword } from './password';
import type { Db } from '../db';

export const DISABLED = '!disabled';

export function passwordHashFor(a: (typeof ACCOUNTS)[number]): string {
  const fromEnv = process.env[a.env];
  if (fromEnv && fromEnv.startsWith('scrypt$')) return fromEnv;
  if (process.env.NODE_ENV === 'production') return DISABLED;
  return hashPassword(a.devPassword);
}

export async function ensureAccounts(db: Db) {
  for (const a of ACCOUNTS) {
    const existing = await db.query<{ password_hash: string }>('select password_hash from accounts where username = $1', [a.username]);
    const fromEnv = process.env[a.env];
    // Keep the stored development hash between restarts so it is not re-salted each boot.
    if (existing.length && !(fromEnv && fromEnv !== existing[0]!.password_hash) && process.env.NODE_ENV !== 'production') continue;
    const hash = passwordHashFor(a);
    await db.query(
      `insert into accounts (username, role, display_name, password_hash) values ($1, $2, $3, $4)
       on conflict (username) do update set role = excluded.role, display_name = excluded.display_name,
         password_hash = excluded.password_hash, updated_at = now()`,
      [a.username, a.role, a.displayName, hash]
    );
  }
}
