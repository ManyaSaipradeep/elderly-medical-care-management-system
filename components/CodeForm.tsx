import { ErrorLine } from './ui';

export function CodeForm({ action, error, email, button, demo }: { action: (f: FormData) => Promise<void>; error: string | null; email?: string; button: string; demo?: string }) {
  return (
    <>
      <h1 className="h1">Check your email</h1>
      <p className="lead">We sent a 6-digit code{email ? <> to <b style={{ color: '#1A1A1A' }}>{email}</b></> : ''}. It works for 10 minutes.</p>
      {demo && <div className="note n-warn" role="status"><b>Demo mode:</b> email is not set up, so your code is <b style={{ letterSpacing: '.2em' }}>{demo}</b>. In real use it only arrives by email.</div>}
      <ErrorLine text={error} />
      <form action={action}>
        <label className="lbl" htmlFor="code">Code from the email</label>
        <input id="code" name="code" className="in code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required pattern="\d{6}" />
        <button className="btn go" style={{ marginTop: 12 }}>{button}</button>
      </form>
    </>
  );
}
