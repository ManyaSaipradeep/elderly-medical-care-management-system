import { Centered } from '@/components/AuthLayout';
export default function Forgot() {
  return (
    <Centered>
      <h1 className="h1">Forgot the passcode?</h1>
      <p className="body">Ask a family organiser or the care recipient. Organisers can set a new passcode in Circle settings.</p>
      <div className="note n-info">For safety, CareCircle never sends the passcode by email.</div>
      <a className="btn out" href="/signin">Back to sign in</a>
    </Centered>
  );
}
