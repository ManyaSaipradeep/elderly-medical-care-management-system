import { AuthLayout } from '@/components/AuthLayout';
import { Field, ErrorLine, Steps } from '@/components/ui';
import { joinDetails } from '../../access-actions';
import { msg } from '@/lib/errors';
import { getTicket } from '@/lib/session';
import { one } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function JoinDetails({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const t = await getTicket<{ circleId: string }>('join');
  if (!t) redirect('/join?e=ticket');
  const c = await one<{ person_name: string }>('select person_name from circles where id = $1', [t.circleId]);
  return (
    <AuthLayout side={<><p style={{ fontSize: 26, fontWeight: 700 }}>Joining {c?.person_name}&apos;s circle</p><Steps labels={['Code and passcode', 'About you', 'Check your email', 'Wait for approval']} current={1} /></>}>
      <h1 className="h1">About you</h1>
      <ErrorLine text={msg(sp.e)} />
      <form action={joinDetails}>
        <Field label="Your name" name="name" required maxLength={80} autoComplete="name" />
        <Field label="Your email" name="email" type="email" required autoComplete="email" />
        <Field label={`How you know ${c?.person_name}`} name="relation" placeholder="For example, daughter, home nurse" maxLength={60} />
        <p className="lbl">You are joining as</p>
        <div className="pick">
          <label><input type="radio" name="role" value="caretaker" defaultChecked /><span><b>Caretaker</b><span>Give and confirm doses, manage medicines and visits</span></span></label>
          <label><input type="radio" name="role" value="family" /><span><b>Family</b><span>See everything, get alerts, prepare doctor visits</span></span></label>
        </div>
        <button className="btn go" style={{ marginTop: 12 }}>Send me a code</button>
      </form>
    </AuthLayout>
  );
}
