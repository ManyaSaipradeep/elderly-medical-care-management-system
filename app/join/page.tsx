import { AuthLayout } from '@/components/AuthLayout';
import { Field, ErrorLine, Steps } from '@/components/ui';
import { joinCheck } from '../access-actions';
import { msg } from '@/lib/errors';

const JOIN_STEPS = ['Code and passcode', 'About you', 'Check your email', 'Wait for approval'];
export default async function Join({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <AuthLayout topRight={<a className="btn out sm" href="/signin">Sign in</a>} side={<>
      <p style={{ fontSize: 26, fontWeight: 700 }}>Joining a circle</p><Steps labels={JOIN_STEPS} current={0} />
      <p style={{ color: '#BFC2BA', marginTop: 'auto' }}>The care recipient or a family organiser approves every new member. You see nothing until then.</p>
    </>}>
      <h1 className="h1">Ask to join a circle</h1>
      <p className="lead">For family members and caretakers.</p>
      <ErrorLine text={msg(sp.e, sp.n)} />
      <form action={joinCheck}>
        <Field label="Circle code" name="code" required maxLength={6} autoComplete="off" />
        <Field label="Passcode" name="passcode" type="password" inputMode="numeric" maxLength={6} code required autoComplete="off" />
        <div className="note n-info" style={{ marginTop: 8 }}><b>Are you the care recipient?</b> You do not need a code. Ask your family for a setup link to open on your phone.</div>
        <button className="btn go" style={{ marginTop: 12 }}>Next</button>
      </form>
    </AuthLayout>
  );
}
