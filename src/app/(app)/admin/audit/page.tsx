import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { page } from '@/lib/server';
import { can } from '@/lib/auth/roles';
import { auditLog } from '@/lib/data/admin';

export const metadata: Metadata = { title: 'Audit log' };

export default async function Audit({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { s, ctx, db } = await page();
  if (!can(s.role, 'audit.view')) notFound();
  const sp = await searchParams;
  const f = { from: sp.from || undefined, to: sp.to || undefined, account: sp.account || undefined, patient: sp.patient || undefined };
  const rows = await auditLog(db, ctx, { ...f, limit: 300 }, 'view');
  const qs = new URLSearchParams(Object.entries(f).filter(([, v]) => v) as [string, string][]).toString();
  const input = { minHeight: 44, border: '1px solid var(--color-line)', borderRadius: 8, padding: '6px 8px', background: '#fff' };
  return (
    <>
      <h1>Audit log</h1>
      <p className="lede">Who did what, and when. It records actions and record ids, never names of patients or clinical values. Viewing and exporting it are logged too.</p>
      <form className="toolbar" method="get">
        <label className="small muted">From <input type="date" name="from" defaultValue={f.from} style={input} /></label>
        <label className="small muted">To <input type="date" name="to" defaultValue={f.to} style={input} /></label>
        <label className="small muted">Account <select name="account" defaultValue={f.account ?? ''} style={input}><option value="">All</option><option value="rmclinic">rmclinic</option><option value="nutritionist">nutritionist</option><option value="admin">admin</option><option value="system">system</option></select></label>
        <label className="small muted">Patient id <input name="patient" defaultValue={f.patient} style={input} size={14} /></label>
        <button className="btn secondary" type="submit">Filter</button>
        <a className="btn ghost" href={`/api/admin/audit${qs ? `?${qs}` : ''}`}>Export CSV</a>
      </form>
      <div className="tablewrap" tabIndex={0} role="region" aria-label="Audit events">
        <table>
          <thead><tr><th scope="col">When (IST)</th><th scope="col">Account</th><th scope="col">Person</th><th scope="col">Action</th><th scope="col">Record</th><th scope="col">Patient id</th><th scope="col">Details</th></tr></thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td>{new Date(r.at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td><td>{r.account ?? '–'}</td><td>{r.staff_name ?? '–'}</td>
                <td>{r.action}</td><td>{r.table_name ?? ''}</td><td className="muted">{r.patient_id?.slice(0, 8) ?? ''}</td>
                <td className="wrap small muted">{Object.keys(r.meta).length ? JSON.stringify(r.meta) : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!rows.length && <div className="empty" style={{ marginTop: 12 }}>No events match these filters.</div>}
    </>
  );
}
