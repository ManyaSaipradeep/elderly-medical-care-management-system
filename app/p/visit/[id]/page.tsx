import { currentPerson } from '@/lib/session';
import { one } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import { VisitSheetBody, type Visit } from '@/components/VisitSheetBody';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';

/** Read-only visit sheet for the care recipient's own phone. */
export default async function PersonVisit({ params }: { params: Promise<{ id: string }> }) {
  const c = await currentPerson();
  if (!c) redirect('/p');
  const { id } = await params;
  const v = /^[0-9a-f-]{36}$/.test(id) ? await one<Visit>('select id, doctor, location, at, notes from appointments where id = $1 and circle_id = $2', [id, c.id]) : null;
  if (!v) notFound();
  return (
    <main className="person-sheet" style={{ maxWidth: 960, margin: '0 auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="row noprint" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <a className="btn out" href="/p?tab=visits">Back to my visits</a>
        <PrintButton />
      </div>
      <VisitSheetBody circleId={c.id} personName={c.person_name} v={v} notes={
        v.notes ? <p className="body" style={{ whiteSpace: 'pre-wrap' }}>{v.notes}</p> : <p className="small">Your family has not added questions yet.</p>} />
    </main>
  );
}
