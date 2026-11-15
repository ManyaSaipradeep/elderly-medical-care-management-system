import { requireMember } from '@/lib/session';
import { one } from '@/lib/db';
import { notFound } from 'next/navigation';
import { VisitSheetBody, type Visit } from '@/components/VisitSheetBody';
import { PrintButton } from '@/components/PrintButton';
import { saveVisitNotes, deleteVisit } from '../../actions';

export default async function VisitSheet({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle } = await requireMember();
  const { id } = await params; const sp = await searchParams;
  const v = /^[0-9a-f-]{36}$/.test(id) ? await one<Visit>('select * from appointments where id = $1 and circle_id = $2', [id, circle.id]) : null;
  if (!v) notFound();
  return (
    <>
      <div className="row noprint" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <a className="back" href="/app/visits">Visits</a>
        <PrintButton />
      </div>
      {sp.saved && <div className="note n-ok noprint" role="status">Notes saved.</div>}
      <VisitSheetBody circleId={circle.id} personName={circle.person_name} v={v} notes={
        <form action={saveVisitNotes}>
          <input type="hidden" name="id" value={v.id} />
          <label className="sr" htmlFor="notes">Questions</label>
          <textarea id="notes" name="notes" className="in" rows={5} maxLength={2000} defaultValue={v.notes ?? ''} />
          <button className="btn out sm noprint" style={{ alignSelf: 'flex-start' }}>Save questions</button>
        </form>} />
      <form action={deleteVisit} className="noprint"><input type="hidden" name="id" value={v.id} /><button className="link" style={{ color: '#B3261E', alignSelf: 'flex-start' }}>Remove this visit</button></form>
    </>
  );
}
