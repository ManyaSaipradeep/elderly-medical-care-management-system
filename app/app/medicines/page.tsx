import { requireMember } from '@/lib/session';
import { q } from '@/lib/db';
import { daysLeft, pattern, FOOD_LABEL, type Med } from '@/lib/domain';
import { Thumb, Icon, importanceChip } from '@/components/ui';

export default async function Medicines() {
  const { circle } = await requireMember();
  const meds = await q<Med>('select * from medications where circle_id = $1 order by active desc, importance, name', [circle.id]);
  const active = meds.filter((m) => m.active), stopped = meds.filter((m) => !m.active);
  return (
    <>
      <div className="between"><h1 className="h1">Medicines</h1><a className="btn go sm" href="/app/medicines/new"><Icon name="plus" size={20} color="#FFFFFF" stroke={2.6} />Add medicine</a></div>
      {!active.length && <div className="card"><p className="body">No medicines yet. Add the first one with a photo of the pill and its strip.</p></div>}
      <div className="cols two">
        {active.map((m) => {
          const d = daysLeft(m);
          return (
            <a key={m.id} className="dose" href={`/app/medicines/${m.id}`} style={{ textDecoration: 'none' }}>
              <Thumb id={m.pill_photo_id} alt={m.name} />
              <div className="txt"><b style={{ fontSize: 17 }}>{m.name}</b><span className="small">{pattern(m)} · {FOOD_LABEL[m.food].toLowerCase()}{m.purpose ? ` · ${m.purpose}` : ''}</span>{importanceChip(m.importance)}</div>
              <span className={`chip ${d !== null && d <= 5 ? 'c-wait' : 'c-later'}`}>{m.stock} left{d !== null ? `, ${d} days` : ''}</span>
            </a>
          );
        })}
      </div>
      {stopped.length > 0 && <>
        <p className="sect">Stopped</p>
        {stopped.map((m) => <div key={m.id} className="card" style={{ borderStyle: 'dashed' }}><b>{m.name}</b><span className="small">{m.stopped_reason}</span></div>)}
      </>}
    </>
  );
}
