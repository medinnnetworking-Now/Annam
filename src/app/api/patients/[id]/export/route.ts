import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { exportPatient } from '@/lib/data/patients';
import { ctxOf } from '@/lib/server';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new Response('Not found', { status: 404 });
  try {
    const data = await exportPatient(await getDb(), ctxOf(s), (await params).id);
    const json = JSON.stringify(data, (_k, v) => (v instanceof Uint8Array ? undefined : v), 2);
    return new Response(json, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="annam-${data.patient.code}.json"`, 'Cache-Control': 'private, no-store' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
