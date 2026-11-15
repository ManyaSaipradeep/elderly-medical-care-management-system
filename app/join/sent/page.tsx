import { Centered } from '@/components/AuthLayout';
import { Logo } from '@/components/ui';

export default function Sent() {
  return (
    <Centered>
      <Logo size={64} />
      <h1 className="h1">Request sent</h1>
      <p className="body">The care recipient or a family organiser needs to approve you. We will email you when they do. Then sign in with the circle code and passcode.</p>
      <div className="note n-info">Requests expire after 7 days.</div>
      <a className="btn out" href="/">Home page</a>
    </Centered>
  );
}
