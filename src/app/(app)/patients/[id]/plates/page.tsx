import { patientView } from '@/lib/view';
import { can } from '@/lib/auth/roles';
import { ACCEPTS_PLATES } from '@/lib/workflow';
import { weekOf } from '@/lib/programme';
import { PlatesClient } from './PlatesClient';

export default async function Plates({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ day?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const v = await patientView(id);
  const last = v.b.plates.length ? v.b.plates[v.b.plates.length - 1]!.eaten_on : v.today;
  const day = sp.day && /^\d{4}-\d{2}-\d{2}$/.test(sp.day) ? sp.day : last;
  const plates = v.b.plates.filter(p => p.eaten_on === day);
  const start = v.b.patient.start_date;
  return (
    <PlatesClient
      patientId={id} day={day} today={v.today} min={v.b.visits[0]?.visit_date ?? start ?? undefined}
      week={start && day >= start ? weekOf(start, day) : null}
      plates={plates} canUpload={can(v.s.role, 'plate.upload') && ACCEPTS_PLATES.includes(v.b.patient.state)}
      canReview={can(v.s.role, 'plate.review')} role={v.s.role}
      notOpenReason={ACCEPTS_PLATES.includes(v.b.patient.state) ? null : 'Plates can be added once the baseline is recorded, until the report is approved.'}
    />
  );
}
