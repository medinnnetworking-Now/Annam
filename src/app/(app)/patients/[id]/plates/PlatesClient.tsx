'use client';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlateRow } from '@/lib/data/patients';
import { MEALS, PLATE_FLAGS, PLATE_TAGS } from '@/lib/measures';
import { suggestPlateScore, type PlateFlags, type PlateTags } from '@/lib/scoring';
import { PlateGraphic, plateLabel } from '@/components/PlateGraphic';
import { Dialog, useToast } from '@/components/ui';
import { deletePlateAction, reviewPlateAction, uploadPlateAction } from '../../../../actions';
import type { Role } from '@/lib/auth/roles';

interface Props {
  patientId: string; day: string; today: string; min?: string; week: number | null; plates: PlateRow[];
  canUpload: boolean; canReview: boolean; role: Role; notOpenReason: string | null;
}

export function PlatesClient(p: Props) {
  const router = useRouter();
  const [upload, setUpload] = useState(false);
  const [review, setReview] = useState<PlateRow | null>(null);
  return (
    <>
      <div className="daybar">
        <label className="muted" htmlFor="day">Day</label>
        <input type="date" id="day" value={p.day} min={p.min} max={p.today} onChange={e => e.target.value && router.push(`?day=${e.target.value}`)} />
        {p.week !== null && <span className="muted small">Programme week {p.week}</span>}
        <span style={{ flex: 1 }} />
        {p.canUpload && <button className="btn" type="button" onClick={() => setUpload(true)}>Upload plate</button>}
      </div>
      {p.notOpenReason && <p className="notice">{p.notOpenReason}</p>}
      {p.plates.length ? (
        <div className="plates">
          {p.plates.map(pl => <PlateCard key={pl.id} plate={pl} {...p} onReview={() => setReview(pl)} />)}
        </div>
      ) : <div className="empty">No plates for this day.{p.canUpload ? ' Upload a photo of each meal to start the log.' : ''}</div>}
      {upload && <UploadDialog patientId={p.patientId} day={p.day} today={p.today} onClose={() => setUpload(false)} />}
      {review && <ReviewDialog patientId={p.patientId} plate={review} onClose={() => setReview(null)} />}
    </>
  );
}

function PlateCard({ plate: pl, patientId, canReview, role, onReview }: Props & { plate: PlateRow; onReview: () => void }) {
  const reviewed = pl.reviewed_at !== null;
  const [pending, start] = useTransition();
  const toast = useToast(); const router = useRouter();
  const canDelete = role === 'nutritionist' || (role === 'clinic' && !reviewed);
  const del = () => {
    if (!confirm('Delete this plate? This cannot be undone.')) return;
    start(async () => { const r = await deletePlateAction(patientId, pl.id); toast(r.ok ? 'Plate deleted' : r.error); router.refresh(); });
  };
  return (
    <article className="plate" aria-label={`${pl.meal} at ${pl.eaten_at.slice(0, 5)}`}>
      <div className="top"><b>{pl.meal}</b><span className="muted">{pl.eaten_at.slice(0, 5)}</span></div>
      <div className="pic">
        {pl.has_photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/api/photos/${pl.id}`} alt={`Photo of ${pl.meal.toLowerCase()}`} loading="lazy" />
          : <PlateGraphic tags={pl.tags} size={120} label={plateLabel(pl.tags, `${pl.meal} plate`)} />}
      </div>
      <div className="tags">
        {PLATE_TAGS.filter(([k]) => pl.tags[k]).map(([k, l]) => <span key={k} className="chip ok">{l}</span>)}
        {PLATE_FLAGS.filter(([k]) => pl.flags[k]).map(([k, l]) => <span key={k} className="chip warn">{l}</span>)}
      </div>
      <div className="sc"><span className="muted">{reviewed ? 'Plate score' : 'Waiting for review'}</span><b>{reviewed ? `${pl.score} of 10` : ''}</b></div>
      {pl.comment && <div className="small">{pl.comment}</div>}
      <div className="muted small">Uploaded by {pl.uploaded_by}{pl.reviewed_by ? `, reviewed by ${pl.reviewed_by}` : ''}</div>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        {canReview && <button className="btn ghost small" type="button" onClick={onReview}>{reviewed ? 'Edit review' : 'Review plate'}</button>}
        {canDelete && <button className="btn ghost small" type="button" onClick={del} disabled={pending}>Delete plate</button>}
      </div>
    </article>
  );
}

/** Resize to at most 720 px and JPEG quality 0.7 on the device. Drawing to a canvas drops all metadata, including location. */
async function resize(file: File): Promise<string> {
  const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  const k = Math.min(1, 720 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close();
  return c.toDataURL('image/jpeg', 0.7).split(',')[1]!;
}

function UploadDialog({ patientId, day, today, onClose }: { patientId: string; day: string; today: string; onClose: () => void }) {
  const [photo, setPhoto] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast(); const router = useRouter();
  const hour = new Date().getHours();
  const meal = hour < 11 ? 'Breakfast' : hour < 16 ? 'Lunch' : hour < 19 ? 'Snack' : 'Dinner';
  return (
    <Dialog open onClose={onClose} title="Upload plate">
      <form onSubmit={e => {
        e.preventDefault(); const f = new FormData(e.currentTarget);
        start(async () => {
          const r = await uploadPlateAction(patientId, { meal: String(f.get('meal')), eaten_on: String(f.get('eaten_on')), eaten_at: String(f.get('eaten_at')), photo: photo ?? undefined });
          if (!r.ok) { setErr(r.error); return; }
          toast('Plate uploaded'); onClose(); router.push(`?day=${f.get('eaten_on')}`); router.refresh();
        });
      }}>
        <div className="form three">
          <label>Meal<select name="meal" defaultValue={meal}>{MEALS.map(m => <option key={m}>{m}</option>)}</select></label>
          <label>Date<input type="date" name="eaten_on" defaultValue={day > today ? today : day} max={today} required /></label>
          <label>Time<input type="time" name="eaten_at" defaultValue={new Date().toTimeString().slice(0, 5)} required /></label>
          <label className="full">Photo<input type="file" accept="image/*" capture="environment" onChange={async e => {
            const file = e.target.files?.[0]; if (!file) return;
            setBusy(true); setErr(null);
            try { setPhoto(await resize(file)); } catch { setErr('That file could not be read as an image. Try a JPEG or PNG.'); setPhoto(null); } finally { setBusy(false); }
          }} /><span className="hint">Use the camera. Keep faces out of the photo. It is resized on this device before upload.</span></label>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={`data:image/jpeg;base64,${photo}`} alt="Preview of the plate photo" style={{ maxWidth: 200, borderRadius: 10 }} />}
        <p className="muted small">The nutritionist reviews and scores each plate.</p>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" type="submit" disabled={pending || busy}>{pending ? 'Uploading…' : 'Upload plate'}</button></div>
      </form>
    </Dialog>
  );
}

function ReviewDialog({ patientId, plate, onClose }: { patientId: string; plate: PlateRow; onClose: () => void }) {
  const init = <T extends string>(keys: readonly (readonly [T, string])[], src: Record<string, boolean>) => Object.fromEntries(keys.map(([k]) => [k, !!src[k]])) as Record<T, boolean>;
  const [tags, setTags] = useState<PlateTags>(init(PLATE_TAGS, plate.tags));
  const [flags, setFlags] = useState<PlateFlags>(init(PLATE_FLAGS, plate.flags));
  const [touched, setTouched] = useState(plate.reviewed_at !== null);
  const [score, setScore] = useState<number>(plate.score ?? suggestPlateScore(tags, flags));
  const [comment, setComment] = useState(plate.comment ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast(); const router = useRouter();
  const suggestion = suggestPlateScore(tags, flags);
  const shown = touched ? score : suggestion;
  return (
    <Dialog open onClose={onClose} title="Review plate">
      <p className="muted" style={{ margin: 0 }}>{plate.meal}, {plate.eaten_on} at {plate.eaten_at.slice(0, 5)}</p>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {plate.has_photo && <img src={`/api/photos/${plate.id}`} alt={`Photo of ${plate.meal.toLowerCase()}`} style={{ width: '100%', maxHeight: 280, objectFit: 'contain', borderRadius: 10, background: 'var(--color-rice)', marginTop: 10 }} />}
      <form onSubmit={e => {
        e.preventDefault();
        start(async () => {
          const r = await reviewPlateAction(patientId, plate.id, { tags, flags, score: shown, comment });
          if (!r.ok) { setErr(r.error); return; }
          toast('Review saved'); onClose(); router.refresh();
        });
      }}>
        <fieldset style={{ marginTop: 12 }}>
          <legend>What is on the plate</legend>
          <div className="platepick">
            <PlateGraphic tags={tags} size={150} label={plateLabel(tags, 'Plate preview')} />
            <div className="toggles">{PLATE_TAGS.map(([k, l]) => <label key={k}><input type="checkbox" checked={tags[k]} onChange={e => setTags({ ...tags, [k]: e.target.checked })} /> {l}</label>)}</div>
          </div>
        </fieldset>
        <fieldset style={{ marginTop: 12 }}>
          <legend>Flags</legend>
          <div className="toggles">{PLATE_FLAGS.map(([k, l]) => <label key={k}><input type="checkbox" checked={flags[k]} onChange={e => setFlags({ ...flags, [k]: e.target.checked })} /> {l}</label>)}</div>
        </fieldset>
        <div className="form">
          <label>Plate score, 0 to 10<input type="range" min={0} max={10} step={1} value={shown} onChange={e => { setTouched(true); setScore(+e.target.value); }} /></label>
          <div className="field">Score<output style={{ fontSize: 24, fontWeight: 700, color: 'var(--color-leaf-deep)' }} aria-live="polite">{shown}</output>
            <span className="hint">Suggested from the tags: {suggestion}. {touched ? 'You set the score.' : 'Move the slider to set your own.'}</span></div>
          <label className="full">Comment for the patient<textarea maxLength={300} value={comment} onChange={e => setComment(e.target.value)} /><span className="hint">Plain words. No medication advice.</span></label>
        </div>
        {err && <p className="err" role="alert">{err}</p>}
        <div className="actions"><button type="button" className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save review'}</button></div>
      </form>
    </Dialog>
  );
}
