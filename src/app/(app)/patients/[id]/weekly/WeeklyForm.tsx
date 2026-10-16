'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { weeklyReviewAction } from '../../../../actions';
import { useToast } from '@/components/ui';

export function WeeklyForm({ patientId, week, review, goals, attended }: { patientId: string; week: number; review: string; goals: string; attended: boolean }) {
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast(); const router = useRouter();
  return (
    <form className="form one" style={{ margin: 0 }} onSubmit={e => {
      e.preventDefault(); const fd = new FormData(e.currentTarget);
      start(async () => { const r = await weeklyReviewAction(patientId, week, null, fd); if (!r.ok) { setErr(r.error); return; } setErr(null); toast('Review saved'); router.refresh(); });
    }}>
      <label>Review<textarea name="review" maxLength={1000} defaultValue={review} /></label>
      <label>Goals for next week<textarea name="goals" maxLength={500} defaultValue={goals} /></label>
      <label className="check"><input type="checkbox" name="attended" defaultChecked={attended} /> Attended this week’s check-in session</label>
      {err && <p className="err" role="alert">{err}</p>}
      <div className="actions"><button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save review'}</button></div>
    </form>
  );
}
