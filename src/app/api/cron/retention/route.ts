import { timingSafeEqual } from 'node:crypto';
import { getDb } from '@/lib/db';
import { runRetention } from '@/lib/data/admin';

// Daily retention job (Vercel Cron). Needs CRON_SECRET; does nothing until ANNAM_RETENTION_DAYS is set with legal advice.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get('authorization') ?? '';
  const want = `Bearer ${secret}`;
  if (!secret || got.length !== want.length || !timingSafeEqual(Buffer.from(got), Buffer.from(want))) return new Response('Not found', { status: 404 });
  const days = process.env.ANNAM_RETENTION_DAYS ? Number(process.env.ANNAM_RETENTION_DAYS) : null;
  const r = await runRetention(await getDb(), days);
  return Response.json(r);
}
