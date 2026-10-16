import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession, signInConfigured } from '@/lib/auth/session';
import { HOME } from '@/lib/auth/roles';
import { Mark } from '@/components/Wordmark';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = { title: 'Sign in' };

export default async function Login({ searchParams }: { searchParams: Promise<{ ended?: string; signed_out?: string }> }) {
  const config = signInConfigured();
  let s = null, dbDown = false;
  try { s = await getSession(); } catch { dbDown = true; }
  if (s) redirect(HOME[s.role]);
  const sp = await searchParams;
  return (
    <main id="main" className="login">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
        <Mark size={48} />
        <div><div className="ml" lang="ml" style={{ fontSize: 30, lineHeight: 1, color: 'var(--color-leaf-deep)' }}>അന്നം</div><div className="muted">Annam</div></div>
      </div>
      <div className="panel">
        <h1 style={{ fontSize: 26 }}>Sign in</h1>
        {process.env.ANNAM_DEMO === 'true' && <p className="notice"><b>Demo.</b> Sample patients only; data resets. Never enter real patient information.</p>}
        {!config.ok && <p className="notice alert" role="alert"><b>This server is not set up yet.</b> These settings are missing in Vercel (Settings → Environment Variables): {config.missing.join(', ')}. Add them, then redeploy. Details at /api/health.</p>}
        {config.ok && dbDown && <p className="notice alert" role="alert"><b>The server cannot reach its database.</b> Sign-in will not work until this is fixed. Details at /api/health.</p>}
        {sp.ended && <p className="notice" role="status">Your session ended. Sign in again to carry on.</p>}
        {sp.signed_out && <p className="notice" role="status">You are signed out.</p>}
        <LoginForm />
      </div>
      <p className="muted small" style={{ marginTop: 14 }}>For RM Clinic staff, the Good Food Guru nutritionist and the Annam admin. Accounts are set by the admin; there is no sign-up.</p>
    </main>
  );
}
