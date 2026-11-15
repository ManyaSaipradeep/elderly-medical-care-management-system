import { requireMember } from '@/lib/session';
import { one, q } from '@/lib/db';
import { notFound } from 'next/navigation';
import { daysLeft, FOOD_LABEL, grid14, type Med } from '@/lib/domain';
import { fmtHHMM, fmtDateTime } from '@/lib/time';
import { Photo, importanceChip } from '@/components/ui';
import { Grid14 } from '@/components/Grid14';
import { refill, stopMedicine } from '../../actions';

export default async function MedDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string>> }) {
  const { circle } = await requireMember();
  const { id } = await params; const sp = await searchParams;
  const m = /^[0-9a-f-]{36}$/.test(id) ? await one<Med>('select * from medications where id = $1 and circle_id = $2', [id, circle.id]) : null;
  if (!m) notFound();
  const [grid, changes] = await Promise.all([grid14(circle.id, [m]), q<{ actor: string; summary: string; ack: string | null; created_at: string }>(`select actor, summary, ack, created_at from change_notices where circle_id = $1 and summary like $2 order by created_at desc limit 5`, [circle.id, `${m.name}%`])]);
  const d = daysLeft(m);
  return (
    <>
      <a className="back" href="/app/medicines">Medicines</a>
      {sp.saved && <div className="note n-ok" role="status">Saved. {circle.person_name} will see a notice about it.</div>}
      <div className="between" style={{ flexWrap: 'wrap' }}>
        <div><h1 className="h1">{m.name}</h1><p className="lead">{m.purpose || 'No purpose added'} · {importanceChip(m.importance)}</p></div>
        {m.active && <a className="btn out" href={`/app/medicines/${m.id}/edit`}>Edit schedule or details</a>}
      </div>
      {!m.active && <div className="note n-info">Stopped: {m.stopped_reason}</div>}
      <div className="cols two">
        <div className="card"><div className="grid2" style={{ height: 170 }}><Photo id={m.pill_photo_id} kind="pill" alt={`${m.name} tablet`} /><Photo id={m.strip_photo_id} kind="strip" alt={`${m.name} strip`} /></div></div>
        <div className="card">
          <p className="h2">When</p>
          <div className="grid3" style={{ textAlign: 'center' }}>
            {([['Morning', m.n_morning, m.t_morning], ['Afternoon', m.n_afternoon, m.t_afternoon], ['Night', m.n_night, m.t_night]] as const).map(([l, n, t]) => (
              <div key={l}><p className="small">{l}</p><b style={{ fontSize: 22 }}>{n}</b><p className="small">{n ? fmtHHMM(t) : '—'}</p></div>
            ))}
          </div>
          <p className="small">{FOOD_LABEL[m.food]}</p>
        </div>
      </div>
      {m.active && (
        <div className="cols two" style={{ alignItems: 'start' }}>
          <div className="card">
            <p className="h2">Stock</p>
            <p className="body"><b>{m.stock}</b> at home{d !== null ? <> · about <b>{d} days</b></> : ''}</p>
            <p className="lbl" style={{ margin: 0 }}>Add a new strip or box</p>
            <div className="grid3">
              {[10, 15, 30].map((n) => <form key={n} action={refill}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="add" value={n} /><button className="btn out sm" style={{ width: '100%' }}>+{n}</button></form>)}
            </div>
            <form action={refill} className="stock-custom">
              <input type="hidden" name="id" value={m.id} />
              <label className="lbl" htmlFor="add">Or type a different number</label>
              <div className="stock-row">
                <input id="add" name="add" type="number" inputMode="numeric" min={1} max={1000} required className="in" placeholder="Tablets added" />
                <button className="btn out sm">Add</button>
              </div>
            </form>
          </div>
          <div className="card">
            <p className="h2">Stop this medicine</p>
            <p className="small">Only if the doctor said so. It leaves {circle.person_name}&apos;s screen; history stays on visit sheets.</p>
            <details>
              <summary className="btn danger sm" style={{ listStyle: 'none', display: 'inline-flex' }}>Stop medicine</summary>
              <form action={stopMedicine} style={{ marginTop: 8 }}>
                <input type="hidden" name="id" value={m.id} />
                <label className="lbl" htmlFor="reason">Why (shown to {circle.person_name} and the circle)</label>
                <input id="reason" name="reason" className="in" required maxLength={200} placeholder="For example, the doctor stopped it" />
                <button className="btn alert sm" style={{ marginTop: 8 }}>Yes, stop it</button>
              </form>
            </details>
          </div>
        </div>
      )}
      <div className="card"><p className="h2">Last 14 days</p><Grid14 data={grid} /></div>
      <div className="card">
        <p className="h2">Changes</p>
        {changes.length ? changes.map((c, i) => <p key={i} className="body">{fmtDateTime(c.created_at)}: {c.actor} — {c.summary}. {c.ack === 'ok' ? `${circle.person_name} said OK.` : c.ack === 'question' ? `${circle.person_name} has a question.` : `Not yet seen by ${circle.person_name}.`}</p>) : <p className="small">No changes yet.</p>}
      </div>
    </>
  );
}
