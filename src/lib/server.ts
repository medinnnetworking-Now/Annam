// Server-side glue between pages, actions and the data layer.
import 'server-only';
import { getDb } from './db';
import { actorOf, requireSession, type Session } from './auth/session';
import { Forbidden, NotFound, UserError, type Ctx } from './data/context';

export const ctxOf = (s: Session): Ctx => ({ role: s.role, actor: actorOf(s) });

export async function page() {
  const s = await requireSession();
  return { s, ctx: ctxOf(s), db: await getDb() };
}

export type ActionResult = { ok: true; message?: string; id?: string } | { ok: false; error: string; warnings?: string[] };

/** Run an action: errors people can fix become messages; nothing clinical is logged. */
export async function act(fn: (x: Awaited<ReturnType<typeof page>>) => Promise<ActionResult>): Promise<ActionResult> {
  const x = await page();
  try {
    return await fn(x);
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof Forbidden) return { ok: false, error: 'Your account cannot do this.' };
    if (e instanceof NotFound) return { ok: false, error: 'That record was not found. Reload the page.' };
    console.error('annam action failed', e instanceof Error ? e.name : 'unknown'); // no message: it may hold values
    return { ok: false, error: 'Something went wrong while saving. Try again; if it keeps happening, tell the admin.' };
  }
}
