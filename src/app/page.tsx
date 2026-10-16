import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { HOME } from '@/lib/auth/roles';

export default async function Home() {
  const s = await getSession();
  redirect(s ? HOME[s.role] : '/login');
}
