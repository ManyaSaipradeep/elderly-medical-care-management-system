import { AuthLayout } from '@/components/AuthLayout';
import { Field, ErrorLine, Steps } from '@/components/ui';
import { startCircle } from '../access-actions';
import { msg } from '@/lib/errors';

export default async function Start({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  return (
    <AuthLayout topRight={<a className="btn out sm" href="/signin">Sign in</a>} side={<>
      <p style={{ fontSize: 26, fontWeight: 700 }}>Start a care circle</p>
      <p style={{ color: '#BFC2BA' }}>About 3 minutes. Medicines come after.</p>
      <Steps labels={['Who it is for', 'About you', 'Circle passcode', 'Check your email']} current={0} />
      <p style={{ color: '#BFC2BA', marginTop: 'auto' }}>The circle code is made for you. You choose the passcode and share it only with people you trust.</p>
    </>}>
      <h1 className="h1">Who is this circle for?</h1>
      <ErrorLine text={msg(sp.e)} />
      <form action={startCircle}>
        <fieldset className="pick" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="sr">Who is it for</legend>
          <label><input type="radio" name="for" value="someone" defaultChecked /><span><b>Someone I care for</b><span>A parent, grandparent, aunt, uncle or friend</span></span></label>
          <label><input type="radio" name="for" value="myself" /><span><b>Myself</b><span>I will run my own circle and invite help</span></span></label>
        </fieldset>
        <h2 className="h2" style={{ marginTop: 14 }}>The person at the centre</h2>
        <Field label="Their name (leave empty if it is you)" name="personName" placeholder="Full name" maxLength={80} />
        <Field label="What the family calls them (optional)" name="callName" placeholder="Used in emails" maxLength={40} />
        <Field label="Their email (optional)" name="personEmail" type="email" placeholder="For their own reminders" />
        <h2 className="h2" style={{ marginTop: 14 }}>About you</h2>
        <Field label="Your name" name="yourName" required maxLength={80} autoComplete="name" />
        <Field label="Your email" name="yourEmail" type="email" required autoComplete="email" note="We send a 6-digit code to check it." />
        <Field label="How you are related (optional)" name="relation" placeholder="For example, son, niece, neighbour" maxLength={60} />
        <h2 className="h2" style={{ marginTop: 14 }}>Circle passcode</h2>
        <p className="small">The circle code is created for you after this step. Choose a 6-digit passcode; people need both to ask to join.</p>
        <div className="grid2">
          <div><Field label="6-digit passcode" name="passcode" type="password" inputMode="numeric" maxLength={6} code required autoComplete="new-password" /></div>
          <div><Field label="Type it again" name="passcode2" type="password" inputMode="numeric" maxLength={6} code required autoComplete="new-password" /></div>
        </div>
        <label className="row" style={{ fontSize: 17, alignItems: 'flex-start', marginTop: 10 }}>
          <input type="checkbox" name="agree" required style={{ width: 24, height: 24, flex: 'none', marginTop: 2 }} />
          <span>I have talked to the person at the centre about this, or I am setting it up for myself. They will be asked to agree when their phone is set up.</span>
        </label>
        <button className="btn go" style={{ marginTop: 12 }}>Send me a code</button>
      </form>
    </AuthLayout>
  );
}
