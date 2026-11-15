import { requireMember } from '@/lib/session';
import { q, one } from '@/lib/db';
import { fmtDateTime } from '@/lib/time';
import { decideRequest, removeMember, setOrganiser } from '../actions';

export default async function People() {
  const { member, circle } = await requireMember({ family: true });
  const [pending, active, device] = await Promise.all([
    q<{ id: string; name: string; email: string; role: string; relation: string | null; created_at: string }>(`select * from members where circle_id = $1 and status = 'pending' and created_at > now() - interval '7 days' order by created_at`, [circle.id]),
    q<{ id: string; name: string; email: string; role: string; relation: string | null; is_organiser: boolean; created_at: string }>(`select * from members where circle_id = $1 and status = 'active' order by is_organiser desc, created_at`, [circle.id]),
    one<{ created_at: string }>('select created_at from person_devices where circle_id = $1 and revoked_at is null order by created_at desc limit 1', [circle.id]),
  ]);
  return (
    <>
      <h1 className="h1">People</h1>
      <div className="cols wide">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {pending.map((p) => (
            <div key={p.id} className="card" style={{ borderColor: '#1A1A1A', borderWidth: 3 }}>
              <p className="h2">{p.name} wants to join as {p.role}</p>
              <p className="body">{p.email}{p.relation ? ` · ${p.relation}` : ''} · asked {fmtDateTime(p.created_at)}</p>
              <p className="small">{circle.person_name} can also approve this on their own screen. Approve only people you know. The request expires after 7 days.</p>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <form action={decideRequest}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="decision" value="approve" /><button className="btn go">Approve</button></form>
                <form action={decideRequest}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="decision" value="decline" /><button className="btn out">Decline</button></form>
              </div>
            </div>
          ))}
          <div className="card"><div className="row"><span className="av">{circle.person_name.slice(0, 1).toUpperCase()}</span>
            <div style={{ flex: 1 }}><b>{circle.person_name}</b><p className="small">At the centre · {device ? `phone set up ${fmtDateTime(device.created_at)}` : 'phone not set up yet'}{circle.consent_at ? ' · agreed to share' : ''}</p></div></div></div>
          {active.map((m) => (
            <div key={m.id} className="card"><div className="row" style={{ flexWrap: 'wrap' }}>
              <span className="av g">{m.name.slice(0, 1).toUpperCase()}</span>
              <div style={{ flex: 1, minWidth: 160 }}><b>{m.name}{m.id === member.id ? ' (you)' : ''}</b><p className="small">{m.role === 'family' ? 'Family' : 'Caretaker'}{m.is_organiser ? ' · organiser' : ''}{m.relation ? ` · ${m.relation}` : ''}</p></div>
              {member.is_organiser && m.id !== member.id && (
                <div className="row" style={{ flexWrap: 'wrap' }}>
                  {m.role === 'family' && <form action={setOrganiser}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="on" value={m.is_organiser ? '0' : '1'} /><button className="btn out sm">{m.is_organiser ? 'Remove organiser' : 'Make organiser'}</button></form>}
                  <details><summary className="btn danger sm" style={{ listStyle: 'none' }}>Remove</summary>
                    <form action={removeMember} className="card" style={{ marginTop: 8 }}><input type="hidden" name="id" value={m.id} />
                      <p className="small">{m.name} is signed out everywhere and stops getting emails. Doses they confirmed stay in the history.</p>
                      <button className="btn alert sm">Remove {m.name}</button></form>
                  </details>
                </div>
              )}
            </div></div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card"><p className="h2">Invite someone</p><p className="body">Share the circle code <b style={{ letterSpacing: '.1em' }}>{circle.code}</b> and tell them the passcode in person or by phone. They ask to join at <b>/join</b>; you or {circle.person_name} approve.</p></div>
          {member.is_organiser && <a className="card" href="/app/setup" style={{ textDecoration: 'none' }}><p className="h2">{circle.person_name}&apos;s phone</p><p className="body">{device ? 'Set up. If it is lost, make a new setup link.' : 'Not set up yet. Make a one-time setup link.'}</p></a>}
        </div>
      </div>
    </>
  );
}
