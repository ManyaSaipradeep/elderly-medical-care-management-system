import { q } from '@/lib/db';
import { adherence, skipReasons, pattern, FOOD_LABEL, type Med } from '@/lib/domain';
import { fmtDateTime, localDate, SLOT_LABEL } from '@/lib/time';

export type Visit = { id: string; doctor: string; location: string | null; at: string; notes: string | null };

/** The printable visit sheet, shared by the circle dashboard and the care recipient's screen. */
export async function VisitSheetBody({ circleId, personName, v, notes }: { circleId: string; personName: string; v: Visit; notes: React.ReactNode }) {
  const [meds, adh, reasons, changes] = await Promise.all([
    q<Med & { since: string }>('select *, created_at as since from medications where circle_id = $1 and active order by importance, name', [circleId]),
    adherence(circleId, 30), skipReasons(circleId, 30),
    q<{ actor: string; summary: string; ack: string | null; created_at: string }>(`select actor, summary, ack, created_at from change_notices where circle_id = $1 and created_at > now() - interval '60 days' order by created_at desc limit 8`, [circleId]),
  ]);
  const per = (m: Med) => { const rs = adh.rows.filter((r) => r.med_id === m.id && r.status !== 'pending'); const t = rs.filter((r) => r.status === 'taken').length; return rs.length ? `${t} of ${rs.length} (${Math.round((t / rs.length) * 100)}%)` : 'No record yet'; };
  const skipped = reasons.filter((r) => r.status === 'skipped').length, missed = reasons.filter((r) => r.status === 'missed').length;
  return (
    <article className="card sheet-page" style={{ gap: 18, padding: 28 }}>
      <header className="between" style={{ alignItems: 'flex-start', borderBottom: '3px solid #1A1A1A', paddingBottom: 12, flexWrap: 'wrap' }}>
        <div><h1 className="h1">{personName}: doctor visit sheet</h1><p className="body">{v.doctor} · {fmtDateTime(v.at)}{v.location ? ` · ${v.location}` : ''}</p></div>
        <p className="small" style={{ textAlign: 'right' }}>Prepared {localDate()}<br />from doses confirmed at home<br />Times in IST</p>
      </header>
      <div className="grid3">
        <div className="card" style={{ padding: 12 }}><p className="small">Doses taken, last 30 days</p><b style={{ fontSize: 22 }}>{adh.total ? `${adh.taken} of ${adh.total} (${adh.pct}%)` : 'No record yet'}</b></div>
        <div className="card" style={{ padding: 12 }}><p className="small">Skipped by choice</p><b style={{ fontSize: 22 }}>{skipped}</b></div>
        <div className="card" style={{ padding: 12 }}><p className="small">Missed, not confirmed</p><b style={{ fontSize: 22 }}>{missed}</b></div>
      </div>
      <section><h2 className="h2">Current medicines</h2>
        <div className="scrollx"><table className="table"><thead><tr className="small"><th>Medicine</th><th>M-A-N</th><th>Food</th><th>Taken, 30 days</th><th>Since</th></tr></thead>
          <tbody>{meds.map((m) => <tr key={m.id}><td><b>{m.name}</b>{m.purpose ? ` · ${m.purpose}` : ''}</td><td>{pattern(m)}</td><td>{FOOD_LABEL[m.food]}</td><td>{per(m)}</td><td>{localDate(new Date(m.since))}</td></tr>)}</tbody></table></div>
        {!meds.length && <p className="small">No medicines recorded.</p>}
      </section>
      <section><h2 className="h2">Changes in the last 60 days</h2>
        {changes.length ? changes.map((c, i) => <p key={i} className="body">{fmtDateTime(c.created_at)}: {c.summary} (by {c.actor}){c.ack === 'ok' ? `. ${personName} said OK.` : c.ack === 'question' ? `. ${personName} had a question.` : ''}</p>) : <p className="small">None.</p>}
      </section>
      <section><h2 className="h2">Skipped or missed, with {personName}&apos;s own reasons</h2>
        {reasons.length ? reasons.map((r, i) => <p key={i} className="body">{fmtDateTime(r.due_at)} ({SLOT_LABEL[r.slot]}): {r.name} · {r.status}{r.reason ? ` · “${r.reason}”` : ' · not confirmed by anyone'}</p>) : <p className="small">None in the last 30 days.</p>}
      </section>
      <section><h2 className="h2">Questions for the doctor</h2>{notes}</section>
      <footer className="small">Doses recorded at home by {personName}, caretakers and family. A recorded dose is a confirmation, not proof the tablet was swallowed. Confirm all changes with the prescribing doctor.</footer>
    </article>
  );
}
