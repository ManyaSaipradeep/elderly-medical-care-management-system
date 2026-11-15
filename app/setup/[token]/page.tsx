import { Centered } from '@/components/AuthLayout';
import { Logo } from '@/components/ui';
import { q, one } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import { acceptSetup, talkFirst } from '../actions';

export const dynamic = 'force-dynamic';

export default async function Setup({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ step?: string; told?: string }> }) {
  const { token } = await params;
  const sp = await searchParams;
  const link = await one<{ circle_id: string; created_by: string; person_name: string }>(
    `select l.circle_id, l.created_by, c.person_name from setup_links l join circles c on c.id = l.circle_id
     where l.token_hash = $1 and l.used_at is null and l.expires_at > now()`, [sha256(token)]);
  if (!link) {
    return <Centered><h1 className="h1" style={{ fontSize: 30 }}>This link does not work any more</h1><p className="body" style={{ fontSize: 20 }}>Ask your family to send you a new setup link. Links work once, for 24 hours, to keep your medicines private.</p></Centered>;
  }
  if (sp.told) {
    return <Centered><h1 className="h1" style={{ fontSize: 30 }}>We told {link.created_by}</h1><p className="body" style={{ fontSize: 20 }}>They will call you to talk about it. Nothing is shared until you say yes. You can open this link again later.</p></Centered>;
  }
  if (sp.step !== 'consent') {
    return (
      <Centered>
        <Logo size={72} />
        <h1 className="h1" style={{ fontSize: 32 }}>Hello, {link.person_name}</h1>
        <p className="body" style={{ fontSize: 20 }}>{link.created_by} set up CareCircle to help with your medicines. This phone will show what to take, and when.</p>
        <a className="btn go big" href="?step=consent">Continue</a>
      </Centered>
    );
  }
  const members = await q<{ name: string; role: string }>(`select name, role from members where circle_id = $1 and status = 'active' order by created_at`, [link.circle_id]);
  return (
    <Centered>
      <h1 className="h1" style={{ fontSize: 30 }}>These people can see your medicines</h1>
      {members.map((m) => (
        <div key={m.name + m.role} className="card"><div className="row"><span className="av">{m.name.slice(0, 1).toUpperCase()}</span><div><b style={{ fontSize: 19 }}>{m.name}</b><p className="small" style={{ fontSize: 16 }}>{m.role === 'family' ? 'Family' : 'Caretaker'}</p></div></div></div>
      ))}
      <p className="body" style={{ fontSize: 19 }}>You can remove anyone later in My people. New people need your OK.</p>
      <form action={acceptSetup}><input type="hidden" name="token" value={token} /><button className="btn go big" style={{ width: '100%' }}>Yes, that is fine</button></form>
      <form action={talkFirst}><input type="hidden" name="token" value={token} /><button className="btn mid" style={{ width: '100%' }}>I want to talk to them first</button></form>
    </Centered>
  );
}
