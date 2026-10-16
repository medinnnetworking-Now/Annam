// Who is calling a data function, and the checks every function makes first.
import type { Actor } from '../db';
import { can, type Permission, type Role } from '../auth/roles';

export interface Ctx { role: Role; actor: Actor }

export class Forbidden extends Error { constructor(p: string) { super(`Not allowed: ${p}`); this.name = 'Forbidden'; } }
export class NotFound extends Error { constructor(what = 'Not found') { super(what); this.name = 'NotFound'; } }
/** A problem the person can fix; the message is shown to them. */
export class UserError extends Error { constructor(msg: string) { super(msg); this.name = 'UserError'; } }

export function check(ctx: Ctx, p: Permission) { if (!can(ctx.role, p)) throw new Forbidden(p); }

/** Translate database guard errors into messages for people. */
export function friendly(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('consent is missing or withdrawn')) throw new UserError('This patient has no current consent, so new data cannot be added.');
  if (msg.includes('approved reports cannot be changed')) throw new UserError('This report is approved and locked. Create a new draft instead.');
  throw e;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
