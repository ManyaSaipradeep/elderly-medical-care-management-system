import { requireMember } from '@/lib/session';
import { ErrorLine } from '@/components/ui';
import { msg } from '@/lib/errors';
import { changePasscode, deleteCircle } from '../actions';
import { PasscodePair } from '@/components/PasscodePair';

export default async function Settings({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const { circle } = await requireMember({ organiser: true });
  const sp = await searchParams;
  return (
    <>
      <h1 className="h1">Circle settings</h1>
      {sp.ok === 'pass' && <div className="note n-ok" role="status">Passcode changed. Everyone was emailed.</div>}
      <ErrorLine text={msg(sp.e)} />
      <div className="cols two">
        <div className="card">
          <p className="small">Circle code</p><p style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '.14em' }}>{circle.code}</p>
          <p className="small">Made by CareCircle. It cannot be changed.</p>
          <a className="btn out sm" href="/app/setup" style={{ alignSelf: 'flex-start' }}>Set up {circle.person_name}&apos;s phone</a>
          <a className="btn out sm" href="/app/people" style={{ alignSelf: 'flex-start' }}>Organisers and people</a>
          {process.env.DEMO_OUTBOX === '1' && <a className="btn out sm" href="/app/outbox" style={{ alignSelf: 'flex-start' }}>Outbox (sent emails)</a>}
        </div>
        <form action={changePasscode} className="card">
          <p className="h2">Change passcode</p>
          <label className="lbl" htmlFor="current">Current passcode</label><input id="current" name="current" type="password" inputMode="numeric" maxLength={6} className="in code" required />
          <PasscodePair label="New passcode" />
          <p className="small">People already signed in stay signed in. New joins need the new passcode.</p>
          <button className="btn go">Change passcode</button>
        </form>
      </div>
      <form action={deleteCircle} className="card" style={{ borderColor: '#B3261E' }}>
        <p className="h2">Delete this circle</p>
        <p className="body">Deletes every medicine, dose record, visit, photo and member. It cannot be undone. Everyone, including {circle.person_name}, is emailed first.</p>
        <label className="lbl" htmlFor="confirm">Type {circle.person_name} to confirm</label>
        <input id="confirm" name="confirm" className="in" required autoComplete="off" />
        <button className="btn alert" style={{ alignSelf: 'flex-start' }}>Delete everything</button>
      </form>
    </>
  );
}
