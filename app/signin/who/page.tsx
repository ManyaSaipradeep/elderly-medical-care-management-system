import { AuthLayout } from '@/components/AuthLayout';
import { Steps } from '@/components/ui';
import { signinWho } from '../../access-actions';
import { getTicket } from '@/lib/session';
import { q } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function Who() {
  const t = await getTicket<{ circleId: string }>('signin');
  if (!t) redirect('/signin?e=ticket');
  const members = await q<{ id: string; name: string; role: string }>(`select id, name, role from members where circle_id = $1 and status = 'active' order by name`, [t.circleId]);
  return (
    <AuthLayout side={<><p style={{ fontSize: 26, fontWeight: 700 }}>Welcome back</p><Steps labels={['Code and passcode', 'Who are you', 'Email code']} current={1} /></>}>
      <h1 className="h1">Who are you?</h1>
      <p className="lead">We will send a code to your email to check it is you.</p>
      {members.map((m) => (
        <form key={m.id} action={signinWho}>
          <input type="hidden" name="member" value={m.id} />
          <button className="btn out" style={{ justifyContent: 'flex-start', minHeight: 68, width: '100%' }}>
            <span className="av g">{m.name.slice(0, 1).toUpperCase()}</span>
            <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}><b>{m.name}</b><span className="small">{m.role === 'family' ? 'Family' : 'Caretaker'}</span></span>
          </button>
        </form>
      ))}
    </AuthLayout>
  );
}
