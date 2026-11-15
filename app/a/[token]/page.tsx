import { Centered } from '@/components/AuthLayout';
import { q, one } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import { confirmEmailAction } from '../actions';
import { fmtTime, SLOT_LABEL, type Slot } from '@/lib/time';

export const dynamic = 'force-dynamic';

export default async function EmailAction({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const act = await one<{ dose_ids: string[]; expired: boolean; used_at: string | null; member: string }>(
    `select e.dose_ids, (e.expires_at < now()) as expired, e.used_at, m.name as member from email_actions e join members m on m.id = e.member_id where e.token_hash = $1`, [sha256(token)]);
  if (!act || act.expired || act.used_at) {
    return <Centered><h1 className="h1">This link has expired</h1><p className="body">Email buttons work once, for 12 hours. Sign in to change the dose.</p><a className="btn go" href="/signin">Sign in</a></Centered>;
  }
  const doses = await q<{ id: string; status: string; qty: number; due_at: string; slot: Slot; name: string; person_name: string; acted_by: string | null }>(
    `select d.id, d.status, d.qty, d.due_at, d.slot, m.name, c.person_name, d.acted_by from doses d join medications m on m.id = d.med_id join circles c on c.id = d.circle_id where d.id = any($1::uuid[])`, [act.dose_ids]);
  const open = doses.filter((d) => d.status === 'pending' || d.status === 'missed');
  if (!open.length) {
    return <Centered><h1 className="h1">Already recorded</h1><p className="body">{doses[0]?.acted_by ? `${doses[0].acted_by} recorded it.` : 'Someone recorded it already.'} Nothing more to do.</p></Centered>;
  }
  return (
    <Centered>
      <p className="small">{act.member}, for {doses[0].person_name}</p>
      <h1 className="h1">Confirm the {SLOT_LABEL[doses[0].slot].toLowerCase()} dose was given</h1>
      {open.map((d) => <div key={d.id} className="dose"><div className="txt"><b>{d.name}</b><span className="small">Take {d.qty}, due {fmtTime(d.due_at)}</span></div>
        {open.length > 1 && <form action={confirmEmailAction}><input type="hidden" name="token" value={token} /><input type="hidden" name="which" value={d.id} /><button className="btn out sm">Only this</button></form>}</div>)}
      <form action={confirmEmailAction}><input type="hidden" name="token" value={token} /><input type="hidden" name="which" value="all" />
        <button className="btn go" style={{ width: '100%' }}>{open.length > 1 ? 'Confirm: all given' : 'Confirm: given'}</button></form>
      <p className="small">Nothing is recorded until you press Confirm.</p>
    </Centered>
  );
}
