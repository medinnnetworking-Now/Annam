import Link from 'next/link';
import { requireSession } from '@/lib/auth/session';
import { can } from '@/lib/auth/roles';
import { Wordmark } from '@/components/Wordmark';
import { NavLink } from '@/components/ui';
import { signOutAction } from '../login/actions';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const s = await requireSession();
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="top">
        <Link className="brand" href="/" aria-label="Annam home"><Wordmark /></Link>
        <nav className="links" aria-label="Main">
          {can(s.role, 'patient.view') && <NavLink href="/patients">Patients</NavLink>}
          {can(s.role, 'patient.view') && <NavLink href="/queue">Work queue</NavLink>}
          {can(s.role, 'cohort.view') && <NavLink href="/cohort">Cohort</NavLink>}
          {can(s.role, 'audit.view') && <NavLink href="/admin/audit">Audit log</NavLink>}
          <NavLink href="/about">About</NavLink>
          <form action={signOutAction}><button type="submit">Sign out</button></form>
        </nav>
        <div className="who" style={{ width: '100%', textAlign: 'right' }}>{s.displayName} · {s.staffName}</div>
      </header>
      <main id="main" tabIndex={-1}>
        {process.env.ANNAM_DEMO === 'true' && <p className="notice"><b>Demo.</b> Sample patients only. Data resets when the server restarts. Never enter real patient information here.</p>}
        {children}
      </main>
    </>
  );
}
