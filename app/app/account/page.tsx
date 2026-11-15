import { requireMember } from '@/lib/session';
import { logout } from '../../access-actions';
import { savePrefs, leaveCircle } from '../actions';

export default async function Account({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { member, circle } = await requireMember();
  const sp = await searchParams;
  const p = member.email_prefs || {};
  const toggles: [string, string, string][] = [
    ['upcoming', 'Upcoming doses', '15 minutes before each dose'],
    ['waiting', 'Dose not confirmed', 'After 30 minutes, if you are the caretaker (or there is none)'],
    ['visits', 'Doctor visits', 'The day before, with the visit sheet'],
    ['refills', 'Refills', 'When 5 days or fewer are left'],
  ];
  return (
    <>
      <h1 className="h1">Account</h1>
      {sp.saved && <div className="note n-ok" role="status">Saved.</div>}
      {sp.e === 'last_org' && <div className="note n-warn">Make someone else an organiser before you leave.</div>}
      <div className="cols two">
        <div className="card">
          <b style={{ fontSize: 20 }}>{member.name}</b>
          <span className="small">{member.role === 'family' ? 'Family' : 'Caretaker'}{member.is_organiser ? ', organiser' : ''} in {circle.person_name}&apos;s circle</span>
          <span className="small">{member.email}</span>
          <form action={logout} style={{ marginTop: 10 }}><button className="btn ink">Log out</button></form>
          <details><summary className="link" style={{ color: '#B3261E', listStyle: 'none', display: 'flex', alignItems: 'center' }}>Leave this circle</summary>
            <form action={leaveCircle} className="card" style={{ marginTop: 8 }}>
              <p className="small">You stop seeing {circle.person_name}&apos;s medicines and getting emails. Doses you confirmed stay in the history. To come back you need to ask again.</p>
              <button className="btn alert sm">Leave circle</button>
            </form>
          </details>
        </div>
        <form action={savePrefs} className="card">
          <p className="h2">Email me about</p>
          {toggles.map(([k, l, d]) => (
            <label key={k} className="between" style={{ borderTop: '1px solid #E2E4DE', padding: '10px 0', cursor: 'pointer' }}>
              <span style={{ display: 'flex', flexDirection: 'column' }}><b>{l}</b><span className="small">{d}</span></span>
              <input type="checkbox" name={k} defaultChecked={!!p[k]} style={{ width: 28, height: 28, accentColor: '#1B6B35' }} />
            </label>
          ))}
          <p className="small">Help requests and important missed doses always email everyone.</p>
          <button className="btn go">Save</button>
        </form>
      </div>
    </>
  );
}
