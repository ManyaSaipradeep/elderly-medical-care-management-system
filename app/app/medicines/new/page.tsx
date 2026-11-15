import { requireMember } from '@/lib/session';
import { MedForm } from '@/components/MedForm';
import { msg } from '@/lib/errors';
export default async function NewMed({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { circle } = await requireMember();
  const sp = await searchParams;
  return <><a className="back" href="/app/medicines">Medicines</a><h1 className="h1">Add a medicine</h1><MedForm error={msg(sp.e)} personName={circle.person_name} /></>;
}
