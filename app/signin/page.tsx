import { AuthLayout } from '@/components/AuthLayout';
import { Field, ErrorLine, Steps } from '@/components/ui';
import { signinCheck } from '../access-actions';
import { msg } from '@/lib/errors';

export default async function SignIn({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <AuthLayout topRight={<a className="btn out sm" href="/join">Ask to join</a>} side={<>
      <p style={{ fontSize: 26, fontWeight: 700 }}>Welcome back</p><Steps labels={['Code and passcode', 'Who are you', 'Email code']} current={0} />
      <p style={{ color: '#BFC2BA', marginTop: 'auto' }}>We never send the passcode by email.</p>
    </>}>
      <h1 className="h1">Sign in to your circle</h1>
      {sp.expired && <div className="note n-info">Please sign in again.</div>}
      <ErrorLine text={msg(sp.e, sp.n)} />
      <form action={signinCheck}>
        <Field label="Circle code" name="code" required maxLength={6} autoComplete="off" />
        <Field label="Passcode" name="passcode" type="password" inputMode="numeric" maxLength={6} code required autoComplete="current-password" />
        <a href="/forgot" className="link" style={{ display: 'flex', alignItems: 'center', alignSelf: 'flex-start' }}>Forgot the passcode?</a>
        <button className="btn go" style={{ marginTop: 8 }}>Continue</button>
      </form>
      <p className="small">The person at the centre does not sign in here. They use the setup link their family sends.</p>
    </AuthLayout>
  );
}
