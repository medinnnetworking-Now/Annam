import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { auditLog } from '@/lib/data/admin';
import { ctxOf } from '@/lib/server';

const cell = (v: unknown) => { const s = v === null || v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v); return /[",\n]/.test(s) || /^[=+\-@]/.test(s) ? `"${s.replace(/^([=+\-@])/, "'$1").replace(/"/g, '""')}"` : s; };

export async function GET(req: Request) {
  const s = await getSession();
  if (!s) return new Response('Not found', { status: 404 });
  const u = new URL(req.url).searchParams;
  try {
    const rows = await auditLog(await getDb(), ctxOf(s), { from: u.get('from') ?? undefined, to: u.get('to') ?? undefined, account: u.get('account') ?? undefined, patient: u.get('patient') ?? undefined, limit: 5000 }, 'export');
    const head = ['id', 'at', 'account', 'staff_name', 'action', 'table_name', 'row_id', 'patient_id', 'meta'];
    const csv = [head.join(','), ...rows.map(r => head.map(h => cell((r as unknown as Record<string, unknown>)[h])).join(','))].join('\n');
    return new Response(csv, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="annam-audit.csv"', 'Cache-Control': 'private, no-store' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
