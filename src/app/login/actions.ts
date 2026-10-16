'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { signIn, signOut } from '@/lib/auth/session';
import { HOME } from '@/lib/auth/roles';

const schema = z.object({
  username: z.string().trim().min(1, 'Enter your username').max(40),
  password: z.string().min(1, 'Enter your password').max(200),
  staff: z.string().trim().min(2, 'Enter your own name, so the record shows who did what').max(60),
  code: z.string().max(10).optional()
});

export async function signInAction(_: { error: string } | null, f: FormData): Promise<{ error: string }> {
  const p = schema.safeParse({ username: f.get('username'), password: f.get('password'), staff: f.get('staff'), code: f.get('code') || undefined });
  if (!p.success) return { error: p.error.issues[0]!.message };
  const r = await signIn(p.data.username, p.data.password, p.data.staff, p.data.code);
  if (!r.ok) return { error: r.error };
  redirect(HOME[r.role]);
}

export async function signOutAction() {
  await signOut();
  redirect('/login?signed_out=1');
}
