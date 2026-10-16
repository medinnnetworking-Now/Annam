'use client';
import { useActionState } from 'react';
import { signInAction } from './actions';
import { Submit } from '@/components/ui';

export function LoginForm() {
  const [state, action] = useActionState(signInAction, null);
  return (
    <form action={action} className="form one" noValidate>
      <label>Username<input name="username" autoComplete="username" autoCapitalize="none" spellCheck={false} required /></label>
      <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
      <label>Your name
        <input name="staff" autoComplete="name" required maxLength={60} />
        <span className="hint">The login is shared by your team. Your name goes on everything you record.</span>
      </label>
      <label>Admin code <span className="hint">Only for the admin account: the 6-digit code from your authenticator app.</span>
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} />
      </label>
      {state?.error && <p className="err" role="alert">{state.error}</p>}
      <div className="actions"><Submit pendingText="Signing in…">Sign in</Submit></div>
    </form>
  );
}
