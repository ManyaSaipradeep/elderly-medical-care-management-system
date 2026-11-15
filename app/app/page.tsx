import { requireMember } from '@/lib/session';
import { q, one } from '@/lib/db';
import { todayDoses, grid14, skipReasons, daysLeft, type Med } from '@/lib/domain';
import { fmtTime, fmtDateTime, SLOT_LABEL, SLOTS } from '@/lib/time';
import { Icon } from '@/components/ui';
import { Grid14 } from '@/components/Grid14';
import { DoseRow } from '@/components/DoseRow';
import { runRemindersNow } from './actions';

export default async function Today({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const { member, circle } = await requireMember();
  const fam = member.role === 'family';
  const who = circle.call_name || circle.person_name;
  const doses = await todayDoses(circle.id);
  const meds = await q<Med>('select * from medications where circle_id = $1 and active order by importance, name', [circle.id]);
  const [grid, reasons, visit, pending, activity] = await Promise.all([
    grid14(circle.id, meds),
    skipReasons(circle.id, 14),
    one<{ id: string; doctor: string; at: string; location: string | null }>('select id, doctor, at, location from appointments where circle_id = $1 and at > now() order by at limit 1', [circle.id]),
    fam ? q<{ id: string; name: string; role: string }>(`select id, name, role from members where circle_id = $1 and status = 'pending' and created_at > now() - interval '7 days'`, [circle.id]) : Promise.resolve([]),
    q<{ actor: string; action: string; at: string }>('select actor, action, at from activity where circle_id = $1 order by at desc limit 6', [circle.id]),
  ]);
  const low = meds.filter((m) => { const d = daysLeft(m); return d !== null && d <= 5; });
  const now = Date.now();
  const due = doses.filter((d) => new Date(d.due_at).getTime() <= now + 60 * 60000);
  const confirmed = due.filter((d) => d.status === 'taken').length;
  const waiting = due.filter((d) => d.status === 'pending' && new Date(d.due_at).getTime() < now);
  return (
    <>
      {sp.denied && <div className="note n-warn">Only family organisers can open that page.</div>}
      {sp.ran && <div className="note n-ok" role="status">Reminders checked. Any emails due were sent (see Outbox if email is not set up).</div>}
      {pending.map((p) => (
        <div key={p.id} className="note n-warn"><div className="between" style={{ flexWrap: 'wrap' }}><span><b>{p.name}</b> asked to join as {p.role}.</span><a className="btn out sm" href="/app/people">Review</a></div></div>
      ))}
      {!meds.length && (
        <div className="card" style={{ gap: 12 }}>
          <p className="h1">Let&apos;s set up {who}&apos;s medicines</p>
          <div className="cols two">
            <a className="card" href="/app/medicines/new" style={{ textDecoration: 'none' }}><b style={{ fontSize: 18 }}>1. Add their medicines</b><span className="small">With a photo of each pill and strip</span></a>
            {member.is_organiser && <a className="card" href="/app/setup" style={{ textDecoration: 'none' }}><b style={{ fontSize: 18 }}>2. Set up {who}&apos;s phone</b><span className="small">A one-time link. They never need a password.</span></a>}
          </div>
        </div>
      )}
      <div className="cols wide">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card">
            <p className="small">Right now · {fmtTime(new Date())}</p>
            <p className="h2" style={{ fontSize: 23 }}>{due.length ? `${confirmed} of ${due.length} due doses confirmed today` : 'Nothing due yet today'}</p>
            <p className="small" style={{ fontSize: 16 }}>
              {waiting.length ? `${waiting.length} waiting. ` : ''}
              {fam ? 'Caretakers are emailed after 30 minutes. You are emailed only if an important medicine waits 1 hour.' : 'If nobody confirms within 30 minutes, you get an email with a Mark as given button.'}
            </p>
          </div>
          {SLOTS.map((s) => {
            const ds = doses.filter((d) => d.slot === s);
            if (!ds.length) return null;
            return (
              <section key={s} style={{ display: 'flex', flexDirection: 'column', gap: 8 }} aria-label={SLOT_LABEL[s]}>
                <p className="sect"><Icon name={s === 'morning' ? 'sun' : s === 'afternoon' ? 'noon' : 'moon'} size={20} color="#4A4A4A" />{SLOT_LABEL[s]} · {fmtTime(ds[0].due_at)}</p>
                {ds.map((d) => <DoseRow key={d.id} d={d} />)}
              </section>
            );
          })}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {low.map((m) => <a key={m.id} className="note n-warn" href={`/app/medicines/${m.id}`} style={{ textDecoration: 'none' }}><b>Refill soon:</b> {m.name}, {daysLeft(m)} days left</a>)}
          <div className="card">
            <p className="h2">Next doctor visit</p>
            {visit ? <><p className="body"><b>{visit.doctor}</b></p><p className="small">{fmtDateTime(visit.at)}{visit.location ? ` · ${visit.location}` : ''}</p><a className="btn ink sm" href={`/app/visits/${visit.id}`} style={{ alignSelf: 'flex-start' }}><Icon name="doc" size={18} color="#FFFFFF" />Visit sheet</a></>
              : <><p className="small">None planned.</p><a className="btn out sm" href="/app/visits" style={{ alignSelf: 'flex-start' }}>Add a visit</a></>}
          </div>
          <div className="card"><div className="between"><p className="h2">Last 14 days</p></div><Grid14 data={grid} /></div>
          <div className="card">
            <p className="h2">In {who}&apos;s words</p>
            {reasons.filter((r) => r.status === 'skipped').length ? reasons.filter((r) => r.status === 'skipped').slice(0, 4).map((r, i) => <p key={i} className="body">{fmtDateTime(r.due_at)}, {r.name}: “{r.reason}”</p>) : <p className="small">No skipped doses in the last 14 days.</p>}
          </div>
          <div className="card">
            <p className="h2">Activity</p>
            {activity.map((a, i) => <p key={i} className="small" style={{ fontSize: 15 }}><b style={{ color: '#1A1A1A' }}>{fmtTime(a.at)}</b> {a.actor}: {a.action}</p>)}
          </div>
          {fam && <form action={runRemindersNow}><button className="btn out sm">Run reminders now</button><p className="small">Reminders also run automatically every 5 minutes.</p></form>}
        </div>
      </div>
    </>
  );
}
