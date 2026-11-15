import { requireMember } from '@/lib/session';
export default async function Welcome() {
  const { member, circle } = await requireMember();
  const who = circle.call_name || circle.person_name;
  return (
    <>
      <h1 className="h1">{who}&apos;s circle is ready</h1>
      <div className="card" style={{ alignItems: 'center', textAlign: 'center' }}>
        <p className="small">Circle code, made for this circle</p>
        <p style={{ margin: 0, fontSize: 36, fontWeight: 700, letterSpacing: '.14em' }}>{circle.code}</p>
        <p className="small" style={{ maxWidth: 520 }}>Share the code by message or email. Tell the passcode by phone or in person, never in writing. New people ask to join; you or {circle.person_name} approve them.</p>
      </div>
      <p className="sect">Next</p>
      <div className="cols two">
        <a className="card" href="/app/medicines/new" style={{ textDecoration: 'none' }}><b style={{ fontSize: 18 }}>1. Add {who}&apos;s medicines</b><span className="small">Have the strips and the prescription nearby.</span></a>
        {member.is_organiser && <a className="card" href="/app/setup" style={{ textDecoration: 'none' }}><b style={{ fontSize: 18 }}>2. Set up {who}&apos;s phone</b><span className="small">A one-time setup link. They never need a password.</span></a>}
      </div>
      <a className="btn go" href="/app" style={{ alignSelf: 'flex-start' }}>Go to today</a>
    </>
  );
}
