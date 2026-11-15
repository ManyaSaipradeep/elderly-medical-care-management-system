import { currentPerson } from '@/lib/session';
import { q, one } from '@/lib/db';
import { todayDoses, currentSlot, FOOD_LABEL, type DoseWithMed } from '@/lib/domain';
import { greeting, fmtTime, fmtDateTime, SLOT_LABEL, SLOTS, type Slot } from '@/lib/time';
import { Icon, Photo, Logo } from '@/components/ui';
import { ReadAloud } from '@/components/ReadAloud';
import { AutoRefresh } from '@/components/AutoRefresh';
import { Centered } from '@/components/AuthLayout';
import { take, skip, snooze, undo, askHelp, ackChange, decide, removePerson } from './actions';

export const dynamic = 'force-dynamic';
const SLOT_ICON: Record<Slot, string> = { morning: 'sun', afternoon: 'noon', night: 'moon' };

function PillCard({ d }: { d: DoseWithMed }) {
  const m = d.med;
  return (
    <div className="slot" style={{ flex: 1 }}>
      <div className="pc" style={{ borderTop: 0 }}>
        <div className="ph2">
          <Photo id={m.pill_photo_id} kind="pill" alt={`${m.name} tablet`} />
          <Photo id={m.strip_photo_id} kind="strip" alt={`${m.name} strip`} />
          {d.qty > 1 && <span className="badge" aria-hidden="true">×{d.qty}</span>}
        </div>
        <div className="between"><p className="take">Take {d.qty}</p>{m.importance === 'important' && <span className="chip c-imp">! Important</span>}</div>
        <span className="food"><Icon name={m.food === 'any' ? 'clock' : 'plate'} size={24} />{FOOD_LABEL[m.food]}</span>
        <p className="what">{m.name}{m.purpose ? ` · ${m.purpose}` : ''}</p>
      </div>
    </div>
  );
}

export default async function PersonScreen({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const c = await currentPerson();
  if (!c) {
    return <Centered><Logo size={64} /><h1 className="h1" style={{ fontSize: 30 }}>This screen is not set up</h1><p className="body" style={{ fontSize: 20 }}>Ask your family for a setup link to open on this phone.</p></Centered>;
  }
  const sp = await searchParams;
  const tab = sp.tab === 'day' ? 'day' : sp.tab === 'people' ? 'people' : sp.tab === 'visits' ? 'visits' : 'now';
  const doses = await todayDoses(c.id);
  const helpReq = await one<{ handled_by: string | null }>(`select handled_by from help_requests where circle_id = $1 and ((handled_at is null and created_at > now() - interval '2 hours') or handled_at > now() - interval '15 minutes') order by created_at desc limit 1`, [c.id]);
  const cur = currentSlot(doses);
  const answered = await one<{ handled_by: string; summary: string }>(`select handled_by, summary from change_notices where circle_id = $1 and ack = 'question' and handled_at > now() - interval '15 minutes' order by handled_at desc limit 1`, [c.id]);
  const [changes, requests, people, visit] = await Promise.all([
    q<{ id: string; actor: string; summary: string }>('select id, actor, summary from change_notices where circle_id = $1 and ack is null order by created_at limit 3', [c.id]),
    q<{ id: string; name: string; role: string; relation: string | null }>(`select id, name, role, relation from members where circle_id = $1 and status = 'pending' and created_at > now() - interval '7 days' order by created_at`, [c.id]),
    q<{ id: string; name: string; role: string; is_organiser: boolean }>(`select id, name, role, is_organiser from members where circle_id = $1 and status = 'active' order by created_at`, [c.id]),
    one<{ doctor: string; at: string; location: string | null }>(`select doctor, at, location from appointments where circle_id = $1 and at between now() and now() + interval '2 days' order by at limit 1`, [c.id]),
  ]);
  const slotState = (s: Slot) => {
    const ds = doses.filter((d) => d.slot === s);
    if (!ds.length) return 'none';
    if (cur && cur.slot === s) return 'now';
    if (ds.every((d) => d.status === 'taken')) return 'done';
    if (ds.some((d) => d.status === 'skipped' || d.status === 'missed')) return 'skipped';
    return 'later';
  };
  const doneIds = (sp.ids || '').split(',').filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const showDone = !!sp.done && doneIds.length > 0 && tab === 'now';
  const ids = cur ? cur.doses.filter((d) => d.status === 'pending').map((d) => d.id).join(',') : '';
  const snoozeEnd = cur?.doses.reduce<number>((mx, d) => (d.status === 'pending' && d.snoozed_until ? Math.max(mx, new Date(d.snoozed_until).getTime()) : mx), 0) ?? 0;
  const snoozed = snoozeEnd > Date.now();
  const viewSlot = (SLOTS as readonly string[]).includes(sp.slot) && sp.slot !== cur?.slot ? (sp.slot as Slot) : null; // looking at another time of day
  const viewDoses = viewSlot ? doses.filter((d) => d.slot === viewSlot) : [];
  const resting = snoozed && !sp.show; // after Later: hide the medicines until the reminder time
  const visits = tab === 'visits' ? await q<{ id: string; doctor: string; at: string; location: string | null }>(`select id, doctor, at, location from appointments where circle_id = $1 and at > now() - interval '30 days' order by at`, [c.id]) : [];
  const next = doses.find((d) => d.status === 'pending' && (!cur || d.due_at !== cur.due_at));
  const speech = cur ? `${SLOT_LABEL[cur.slot]} medicines. ${cur.doses.filter((d) => d.status === 'pending').map((d) => `${d.med.name}: take ${d.qty}, ${FOOD_LABEL[d.med.food]}.`).join(' ')}` : 'Nothing to take right now.';
  const nav = [
    { t: 'now', href: '/p', icon: 'home', label: 'Now' },
    { t: 'day', href: '/p?tab=day', icon: 'list', label: 'My day' },
    { t: 'visits', href: '/p?tab=visits', icon: 'cal', label: 'My visits' },
    { t: 'people', href: '/p?tab=people', icon: 'people', label: requests.length ? `My people (${requests.length})` : 'My people' },
  ];
  return (
    <div className="pgrid">
      <AutoRefresh seconds={60} />
      <nav className="pside" aria-label="Main">
        <div className="row" style={{ padding: '6px 8px 14px' }}><Logo /><b style={{ fontSize: 20 }}>My medicines</b></div>
        {nav.map((n) => <a key={n.t} href={n.href} className={tab === n.t ? 'on' : ''} aria-current={tab === n.t ? 'page' : undefined}><Icon name={n.icon} size={28} />{n.label}</a>)}
      </nav>
      <div className="pcol">
        <div className="p-head">
          <div><p className="p-greet">{greeting()}</p><p className="p-name">{c.person_name}</p></div>
          <a className="help" href="/p?helpask=1" aria-label="Help: ask my family to call me" style={{ textDecoration: 'none' }}><Icon name="phone" size={28} color="#B3261E" stroke={2.4} />Help</a>
        </div>
        {tab === 'now' && (
          <div className="day" role="list" aria-label="Today">
            {SLOTS.map((s) => {
              const st = slotState(s);
              const sel = viewSlot ? viewSlot === s : st === 'now';
              return <a key={s} role="listitem" href={st === 'now' ? '/p' : `/p?slot=${s}`} aria-label={`${SLOT_LABEL[s]}: see medicines`} aria-current={sel ? 'true' : undefined} className={[st === 'done' ? 'done' : st === 'now' ? 'now' : '', sel ? 'sel' : ''].join(' ')}>
                <Icon name={st === 'done' ? 'check' : SLOT_ICON[s]} size={22} color={st === 'done' ? '#13532A' : st === 'now' ? '#1A1A1A' : '#4A4A4A'} stroke={st === 'done' ? 3 : 2.2} />
                {st === 'now' ? 'Now' : SLOT_LABEL[s]}{st === 'none' ? <span className="sr"> (nothing)</span> : null}
              </a>;
            })}
          </div>
        )}
        <main id="main" className="person-main">
          {sp.welcome && <div className="note n-ok" role="status" style={{ fontSize: 18 }}><b>All set.</b> This phone now shows your medicines. Add it to your home screen to find it easily.</div>}
          {sp.helpask && (
            <div className="card" role="dialog" aria-label="Ask for help" style={{ borderColor: '#B3261E', borderWidth: 3 }}>
              <p className="h1">Ask your family to call you?</p>
              <p className="body" style={{ fontSize: 19 }}>Everyone in your circle gets a message straight away.</p>
              <form action={askHelp}><button className="btn alert big" style={{ width: '100%' }}><Icon name="phone" size={28} color="#FFFFFF" stroke={2.4} />Yes, ask my family to call</button></form>
              <a className="btn mid" href="/p">No, I am fine</a>
              <p className="small" style={{ fontSize: 16 }}>In an emergency, call 112.</p>
            </div>
          )}
          {helpReq && (helpReq.handled_by
            ? <div className="note n-ok" role="status" style={{ fontSize: 18 }}><b>{helpReq.handled_by} saw your Help request.</b> They are calling you.</div>
            : <div className="note n-wait" role="status" style={{ fontSize: 18 }}><b>Your family has been told.</b> They will call you.</div>)}
          {answered && <div className="note n-ok" role="status" style={{ fontSize: 18 }}><b>{answered.handled_by} saw your question</b> about {answered.summary}. They will call you.</div>}
          {sp.asked && <div className="note n-ok" role="status" style={{ fontSize: 18 }}><b>Sent.</b> Your family will call you about it.</div>}

          {tab === 'now' && <>
            {viewSlot ? (() => {
              const pending = viewDoses.filter((d) => d.status === 'pending');
              const first = viewDoses[0];
              const future = first && new Date(first.due_at).getTime() > Date.now();
              const say = `${SLOT_LABEL[viewSlot]} medicines. ${pending.map((d) => `${d.med.name}: take ${d.qty}, ${FOOD_LABEL[d.med.food]}.`).join(' ')}`;
              return (
                <>
                  <div className="between" style={{ flexWrap: 'wrap' }}>
                    <p className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name={SLOT_ICON[viewSlot]} size={32} />{SLOT_LABEL[viewSlot]} medicines{first ? `, ${fmtTime(first.due_at)}` : ''}</p>
                    {pending.length > 0 && <ReadAloud text={say} />}
                  </div>
                  {!first ? <div className="card"><p className="body" style={{ fontSize: 19, margin: 0 }}>No medicines in the {SLOT_LABEL[viewSlot].toLowerCase()}.</p></div>
                    : future && pending.length ? <div className="note n-info" style={{ fontSize: 18 }}>Not time yet. The buttons appear here at {fmtTime(first.due_at)}.</div>
                    : !pending.length ? <div className="note n-ok" style={{ fontSize: 18 }}><b>All done</b> for the {SLOT_LABEL[viewSlot].toLowerCase()}.</div> : null}
                  {pending.length > 0 && <div className="person-cards">{pending.map((d) => <PillCard key={d.id} d={d} />)}</div>}
                  {viewDoses.filter((d) => d.status !== 'pending').map((d) => (
                    <div key={d.id} className="card" style={{ borderStyle: 'dashed' }}><div className="row"><Icon name="check" size={26} color="#13532A" stroke={3} /><p className="body">{d.med.name}: {d.status === 'taken' ? `taken${d.acted_by ? ` (${d.acted_by})` : ''}` : d.status}</p></div></div>
                  ))}
                  <a className="btn out" href="/p">{cur ? 'Back to what to take now' : 'Back'}</a>
                </>
              );
            })() : showDone ? (
              <>
                <div className="card" style={{ background: sp.done === 'taken' ? '#E3F1E6' : '#FFF4D6', borderColor: 'transparent', alignItems: 'center', textAlign: 'center', padding: '26px 16px' }}>
                  <span style={{ width: 84, height: 84, borderRadius: 999, background: sp.done === 'taken' ? '#1B6B35' : '#6B4300', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="check" size={46} color="#FFFFFF" stroke={3} /></span>
                  <p className="h1" style={{ color: sp.done === 'taken' ? '#13532A' : '#6B4300' }}>{sp.done === 'taken' ? 'Well done' : 'Okay, not today'}</p>
                  <p className="body" style={{ fontSize: 19, color: sp.done === 'taken' ? '#13532A' : '#6B4300' }}>{sp.done === 'taken' ? 'Marked as taken.' : 'Your family will see your reason.'}</p>
                  <form action={undo}><input type="hidden" name="ids" value={doneIds.join(',')} /><button className="btn out" style={{ minWidth: 160 }}>Undo</button></form>
                </div>
                {next ? <div className="card"><p className="small">Next</p><div className="row"><Icon name={SLOT_ICON[next.slot]} size={30} /><p className="body" style={{ fontSize: 19 }}><b>{SLOT_LABEL[next.slot]} medicines</b> at {fmtTime(next.due_at)}</p></div></div> : null}
                <a className="btn out" href="/p">Back to my medicines</a>
              </>
            ) : sp.reasons && cur ? (
              <>
                <p className="h1">Why not today?</p>
                <p className="lead" style={{ fontSize: 19 }}>It is your choice. Your family will see your reason.</p>
                {['I feel unwell', 'The tablets have run out', "I don't want to take them today"].map((r) => (
                  <form key={r} action={skip}><input type="hidden" name="ids" value={ids} /><input type="hidden" name="reason" value={r} /><button className="btn mid" style={{ width: '100%', justifyContent: 'flex-start' }}>{r}</button></form>
                ))}
                <a className="link" href="/p" style={{ display: 'flex', alignItems: 'center' }}>Go back</a>
              </>
            ) : cur ? (
              <>
                <div className="between" style={{ flexWrap: 'wrap' }}>
                  <p className="h1" style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Icon name={SLOT_ICON[cur.slot]} size={32} />{SLOT_LABEL[cur.slot]} medicines, {fmtTime(cur.due_at)}</p>
                  <ReadAloud text={speech} />
                </div>
                {resting ? (
                  <div className="card" style={{ alignItems: 'center', textAlign: 'center', padding: '26px 16px', gap: 10 }}>
                    <Icon name="clock" size={44} />
                    <p className="h1" style={{ margin: 0 }}>I will remind you at {fmtTime(new Date(snoozeEnd))}</p>
                    <p className="body" style={{ fontSize: 19, margin: 0 }}>Nobody is told while you wait.</p>
                    <a className="btn out" href="/p?show=1">Take them now instead</a>
                  </div>
                ) : <>
                <div className="person-cards">
                  {cur.doses.filter((d) => d.status === 'pending').map((d) => <PillCard key={d.id} d={d} />)}
                </div>
                {cur.doses.filter((d) => d.status !== 'pending').map((d) => (
                  <div key={d.id} className="card" style={{ borderStyle: 'dashed' }}><div className="row"><Icon name="check" size={26} color="#13532A" stroke={3} /><p className="body">{d.med.name}: {d.status === 'taken' ? `taken${d.acted_by ? ` (${d.acted_by})` : ''}` : d.status}</p></div></div>
                ))}
                </>}
              </>
            ) : (
              <div className="card" style={{ padding: '24px 18px' }}>
                {doses.length === 0 ? <><p className="h1">Nothing to take yet</p><p className="body" style={{ fontSize: 19 }}>Your family is adding your medicines. They will appear here.</p></>
                  : next ? <><p className="h1">Nothing to take right now</p><p className="body" style={{ fontSize: 19 }}>Next: <b>{SLOT_LABEL[next.slot]} medicines</b> at {fmtTime(next.due_at)}.</p></>
                  : <><p className="h1" style={{ color: '#13532A' }}>All done for today</p><p className="body" style={{ fontSize: 19 }}>See you tomorrow morning.</p></>}
              </div>
            )}
            {changes.map((ch) => (
              <div key={ch.id} className="card" style={{ borderColor: '#1A1A1A', borderWidth: 3 }}>
                <p className="h2">Your medicines changed</p>
                <p className="body" style={{ fontSize: 19 }}><b>{ch.actor}</b>: {ch.summary}</p>
                <div className="grid2">
                  <form action={ackChange}><input type="hidden" name="id" value={ch.id} /><input type="hidden" name="ack" value="ok" /><button className="btn go" style={{ width: '100%' }}>OK</button></form>
                  <form action={ackChange}><input type="hidden" name="id" value={ch.id} /><input type="hidden" name="ack" value="question" /><button className="btn out" style={{ width: '100%' }}>I have a question</button></form>
                </div>
              </div>
            ))}
            {visit && <div className="card"><div className="row"><Icon name="cal" size={30} /><p className="h2">Doctor visit {new Date(visit.at).getTime() - Date.now() < 86400000 ? 'soon' : 'coming up'}</p></div><p className="body" style={{ fontSize: 19 }}>{visit.doctor}, {fmtDateTime(visit.at)}{visit.location ? `, ${visit.location}` : ''}.</p></div>}

          </>}

          {tab === 'day' && <>
            <div className="between" style={{ flexWrap: 'wrap', gap: 10 }}>
              <p className="h1" style={{ margin: 0 }}>My day</p>
              <a className="btn out" href="/p/add">Add a medicine</a>
            </div>
            {sp.added && <div className="note n-ok" role="status" style={{ fontSize: 18 }}><b>Added.</b> Your family has been told and can help set the exact times.</div>}
            {SLOTS.map((s) => {
              const ds = doses.filter((d) => d.slot === s);
              const st = slotState(s);
              if (!ds.length) return <div key={s} id={`slot-${s}`} className="card"><b className="row" style={{ fontSize: 21 }}><Icon name={SLOT_ICON[s]} size={28} />{SLOT_LABEL[s]}</b><p className="body" style={{ margin: 0 }}>No medicines.</p></div>;
              return (
                <div key={s} id={`slot-${s}`} className="card" style={st === 'now' ? { borderColor: '#1A1A1A', borderWidth: 3 } : undefined}>
                  <div className="between"><b className="row" style={{ fontSize: 21 }}><Icon name={SLOT_ICON[s]} size={28} />{SLOT_LABEL[s]}, {fmtTime(ds[0].due_at)}</b>
                    <span className={`chip ${st === 'done' ? 'c-ok' : st === 'now' ? 'c-wait' : st === 'skipped' ? 'c-skip' : 'c-later'}`}>{st === 'done' ? '✓ Done' : st === 'now' ? 'Now' : st === 'skipped' ? 'Some not taken' : 'Later'}</span></div>
                  {ds.map((d) => <p key={d.id} className="body" style={{ fontSize: 19 }}>{d.med.name}: take {d.qty} · {d.status === 'pending' ? FOOD_LABEL[d.med.food].toLowerCase() : d.status}</p>)}
                </div>
              );
            })}
            {doses.length === 0 && <div className="card"><p className="body">No medicines yet.</p></div>}
            {visit && <div className="card"><div className="row"><Icon name="cal" size={30} /><p className="body" style={{ fontSize: 19 }}><b>Doctor visit:</b> {visit.doctor}, {fmtDateTime(visit.at)}</p></div></div>}
          </>}

          {tab === 'visits' && <>
            <p className="h1">My doctor visits</p>
            {!visits.length && <div className="card"><p className="body" style={{ fontSize: 19, margin: 0 }}>No visits planned. Your family adds them.</p></div>}
            {visits.map((v) => {
              const past = new Date(v.at).getTime() < Date.now();
              return (
                <a key={v.id} className="card" href={`/p/visit/${v.id}`} style={{ textDecoration: 'none', color: 'inherit', opacity: past ? 0.75 : 1 }}>
                  <div className="row"><Icon name="cal" size={30} /><div>
                    <p className="body" style={{ fontSize: 20, margin: 0 }}><b>{v.doctor}</b></p>
                    <p className="body" style={{ margin: 0 }}>{fmtDateTime(v.at)}{v.location ? `, ${v.location}` : ''}{past ? ' (past)' : ''}</p>
                  </div></div>
                  <span className="btn out sm" style={{ alignSelf: 'flex-start' }}>Open visit sheet</span>
                </a>
              );
            })}
          </>}
          {tab === 'people' && <>
            <p className="h1">My people</p>
            <p className="lead" style={{ fontSize: 19 }}>These people can see your medicines. You decide who is here.</p>
            {requests.map((r) => (
              <div key={r.id} className="card" style={{ borderColor: '#1A1A1A', borderWidth: 3 }}>
                <p className="h2">{r.name} wants to join</p>
                <p className="body" style={{ fontSize: 19 }}>As your {r.role === 'family' ? 'family member' : 'caretaker'}{r.relation ? ` (${r.relation})` : ''}. They will see your medicines.</p>
                <div className="grid2">
                  <form action={decide}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="approve" /><button className="btn go" style={{ width: '100%' }}>Allow</button></form>
                  <form action={decide}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="decline" /><button className="btn out" style={{ width: '100%' }}>Say no</button></form>
                </div>
              </div>
            ))}
            {people.map((m) => (
              <div key={m.id} className="card"><div className="row">
                <span className="av">{m.name.slice(0, 1).toUpperCase()}</span>
                <div style={{ flex: 1 }}><b style={{ fontSize: 19 }}>{m.name}</b><p className="small" style={{ fontSize: 16 }}>{m.role === 'family' ? 'Family' : 'Caretaker'}{m.is_organiser ? ' · organiser' : ''}</p></div>
                <details><summary className="btn danger sm" style={{ listStyle: 'none' }}>Remove</summary>
                  <form action={removePerson} style={{ marginTop: 8 }}><input type="hidden" name="id" value={m.id} /><button className="btn alert sm">Yes, remove {m.name}</button></form>
                </details>
              </div></div>
            ))}
          </>}
        </main>
        {tab === 'now' && cur && !viewSlot && !showDone && !sp.reasons && !resting && (
          <div className="person-acts">
            <form action={take} className="big"><input type="hidden" name="ids" value={ids} /><button className="btn go big" style={{ width: '100%' }}><Icon name="check" size={30} color="#FFFFFF" stroke={3} />I took {cur.doses.filter((d) => d.status === 'pending').length > 1 ? 'them' : 'it'}</button></form>
            <form action={snooze}><input type="hidden" name="ids" value={ids} /><button className="btn mid" style={{ width: '100%', minHeight: 64 }}>Later</button></form>
            <a className="btn mid" href="/p?reasons=1" style={{ minHeight: 64 }}>Not today</a>
          </div>
        )}
        <div className="pnav-wrap">
          <nav className="nav pnav" aria-label="Main" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
            {nav.map((n) => <a key={n.t} href={n.href} className={tab === n.t ? 'on' : ''} aria-current={tab === n.t ? 'page' : undefined}><Icon name={n.icon} size={26} color={tab === n.t ? '#1A1A1A' : '#4A4A4A'} />{n.label}</a>)}
          </nav>
        </div>
      </div>
    </div>
  );
}
