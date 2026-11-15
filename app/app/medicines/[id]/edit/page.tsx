import { requireMember } from '@/lib/session';
import { one } from '@/lib/db';
import { MedForm } from '@/components/MedForm';
import { msg } from '@/lib/errors';
import { notFound } from 'next/navigation';
import type { Med } from '@/lib/domain';
export default async function EditMed({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle } = await requireMember();
  const { id } = await params; const sp = await searchParams;
  const med = /^[0-9a-f-]{36}$/.test(id) ? await one<Med>('select * from medications where id = $1 and circle_id = $2 and active', [id, circle.id]) : null;
  if (!med) notFound();
  return <><a className="back" href={`/app/medicines/${id}`}>{med.name}</a><h1 className="h1">Edit {med.name}</h1><MedForm med={med} error={msg(sp.e)} personName={circle.person_name} /></>;
}
