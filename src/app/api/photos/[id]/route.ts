import { getDb } from '@/lib/db';
import { getSession } from '@/lib/auth/session';
import { getPhoto } from '@/lib/data/plates';
import { ctxOf } from '@/lib/server';

// Photos are never public: each request needs a signed-in session with access to patients.
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getSession();
  if (!s) return new Response('Not found', { status: 404 });
  try {
    const bytes = await getPhoto(await getDb(), ctxOf(s), (await params).id);
    return new Response(Buffer.from(bytes), { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
