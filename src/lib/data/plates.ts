// Plates: upload (photo resized on the device, metadata stripped here), review and delete.
import type { Db } from '../db';
import { plateReviewSchema, plateUploadSchema } from '../measures';
import { ACCEPTS_PLATES } from '../workflow';
import { todayIST } from '../programme';
import { isJpeg, stripJpegMetadata } from './jpeg';
import { loadBundle, refreshSnapshots } from './patients';
import { check, friendly, isUuid, NotFound, UserError, type Ctx } from './context';

export const MAX_PHOTO_BYTES = 400_000;

export async function uploadPlate(db: Db, ctx: Ctx, patientId: string, raw: unknown): Promise<string> {
  check(ctx, 'plate.upload');
  const b = await loadBundle(db, patientId); if (!b) throw new NotFound();
  if (!ACCEPTS_PLATES.includes(b.patient.state)) throw new UserError('Plates can be added once the baseline is recorded and until the report is approved.');
  const parsed = plateUploadSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]!.message);
  const v = parsed.data;
  if (v.eaten_on > todayIST()) throw new UserError('A plate cannot be dated in the future. Check the date.');
  let photo: Uint8Array | null = null;
  if (v.photo) {
    const bytes = Uint8Array.from(Buffer.from(v.photo.replace(/^data:image\/jpeg;base64,/, ''), 'base64'));
    if (!isJpeg(bytes)) throw new UserError('That photo could not be read. Take the photo again.');
    photo = stripJpegMetadata(bytes);
    if (photo.length > MAX_PHOTO_BYTES) throw new UserError('That photo is too large. Take it again; it is resized on this device before upload.');
  }
  try {
    return await db.tx(ctx.actor, async q => {
      const [r] = await q.query<{ id: string }>(
        `insert into plates (patient_id, eaten_on, eaten_at, meal, photo, photo_type, uploaded_by) values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [patientId, v.eaten_on, v.eaten_at, v.meal, photo, photo ? 'image/jpeg' : null, ctx.actor.staff]);
      return r!.id;
    });
  } catch (e) { friendly(e); }
}

async function plateOwner(db: Db, plateId: string) {
  if (!isUuid(plateId)) throw new NotFound();
  const [p] = await db.query<{ patient_id: string; reviewed_at: string | null }>('select patient_id, reviewed_at from plates where id = $1', [plateId]);
  if (!p) throw new NotFound();
  return p;
}

export async function reviewPlate(db: Db, ctx: Ctx, plateId: string, raw: unknown) {
  check(ctx, 'plate.review');
  const p = await plateOwner(db, plateId);
  const parsed = plateReviewSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]!.message);
  const v = parsed.data;
  await db.tx(ctx.actor, async q => {
    await q.query(`update plates set tags = $2, flags = $3, score = $4, comment = $5, reviewed_by = $6, reviewed_at = now() where id = $1`,
      [plateId, JSON.stringify(v.tags), JSON.stringify(v.flags), v.score, v.comment || null, ctx.actor.staff]);
    await refreshSnapshots(q, p.patient_id);
  });
}

export async function deletePlate(db: Db, ctx: Ctx, plateId: string) {
  check(ctx, 'plate.delete');
  const p = await plateOwner(db, plateId);
  if (p.reviewed_at && ctx.role !== 'nutritionist') throw new UserError('Only the nutritionist can delete a reviewed plate.');
  await db.tx(ctx.actor, async q => {
    await q.query('delete from plates where id = $1', [plateId]);
    await refreshSnapshots(q, p.patient_id);
  });
}

export async function getPhoto(db: Db, ctx: Ctx, plateId: string): Promise<Uint8Array> {
  check(ctx, 'patient.view');
  if (!isUuid(plateId)) throw new NotFound();
  const [r] = await db.query<{ photo: Uint8Array | null }>('select photo from plates where id = $1', [plateId]);
  if (!r?.photo) throw new NotFound();
  return r.photo;
}

export async function saveWeeklyReview(db: Db, ctx: Ctx, patientId: string, raw: unknown) {
  check(ctx, 'review.write');
  const { weeklyReviewSchema } = await import('../measures');
  const parsed = weeklyReviewSchema.safeParse(raw);
  if (!parsed.success) throw new UserError(parsed.error.issues[0]!.message);
  const v = parsed.data;
  const b = await loadBundle(db, patientId); if (!b) throw new NotFound();
  if (!b.patient.start_date) throw new UserError('The programme has not started yet.');
  try {
    await db.tx(ctx.actor, q => q.query(
      `insert into weekly_reviews (patient_id, week, review, goals, checkin_attended, author) values ($1, $2, $3, $4, $5, $6)
       on conflict (patient_id, week) do update set review = excluded.review, goals = excluded.goals, checkin_attended = excluded.checkin_attended, author = excluded.author, updated_at = now()`,
      [patientId, v.week, v.review || null, v.goals || null, v.checkin_attended, ctx.actor.staff]));
  } catch (e) { friendly(e); }
}
