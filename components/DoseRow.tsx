import { Thumb, Icon } from './ui';
import { doseAction } from '@/app/app/actions';
import { fmtTime } from '@/lib/time';
import type { DoseWithMed } from '@/lib/domain';

export function DoseRow({ d, back = '/app' }: { d: DoseWithMed; back?: string }) {
  const late = d.status === 'pending' && new Date(d.due_at).getTime() < Date.now();
  const chip = d.status === 'taken' ? <span className="chip c-ok"><Icon name="check" size={14} color="#13532A" stroke={3} />Taken{d.acted_by ? ` by ${d.acted_by}` : ''}{d.acted_at ? `, ${fmtTime(d.acted_at)}` : ''}</span>
    : d.status === 'skipped' ? <span className="chip c-skip">– Skipped{d.reason ? `: “${d.reason}”` : ''}</span>
    : d.status === 'missed' ? <span className="chip c-wait">× Missed</span>
    : late ? <span className="chip c-wait">! Waiting since {fmtTime(d.due_at)}</span>
    : <span className="chip c-later">Due {fmtTime(d.due_at)}</span>;
  return (
    <div className="dose">
      <Thumb id={d.med.pill_photo_id} alt={d.med.name} />
      <div className="txt">
        <b style={{ fontSize: 17 }}>{d.med.name}</b>
        <span className="small">Take {d.qty}{d.med.importance === 'important' ? ' · important' : ''}</span>
        {chip}
      </div>
      {d.status === 'pending' || d.status === 'missed' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <form action={doseAction}><input type="hidden" name="ids" value={d.id} /><input type="hidden" name="act" value="give" /><input type="hidden" name="back" value={back} /><button className="btn go sm" style={{ minWidth: 92 }}>Given</button></form>
          <details>
            <summary className="btn out sm" style={{ listStyle: 'none', minWidth: 92 }}>Skipped</summary>
            <form action={doseAction} className="card" style={{ position: 'absolute', right: 16, zIndex: 3, width: 260, boxShadow: '0 4px 16px rgba(0,0,0,.15)' }}>
              <input type="hidden" name="ids" value={d.id} /><input type="hidden" name="act" value="skip" /><input type="hidden" name="back" value={back} />
              <p className="lbl" style={{ margin: 0 }}>Why was it skipped?</p>
              <div className="pick">
                {['Felt unwell', 'Ran out of tablets', 'Did not want it', 'Doctor said to pause'].map((r, i) => (
                  <label key={r}><input type="radio" name="reason" value={r} defaultChecked={i === 0} /><span><b>{r}</b></span></label>
                ))}
              </div>
              <button className="btn go sm">Save</button>
            </form>
          </details>
        </div>
      ) : d.acted_at && Date.now() - new Date(d.acted_at).getTime() < 15 * 60000 ? (
        <form action={doseAction}><input type="hidden" name="ids" value={d.id} /><input type="hidden" name="act" value="undo" /><input type="hidden" name="back" value={back} /><button className="btn out sm">Undo</button></form>
      ) : null}
    </div>
  );
}
