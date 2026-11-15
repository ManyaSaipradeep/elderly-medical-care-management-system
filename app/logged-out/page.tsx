import { Centered } from '@/components/AuthLayout';
import { Logo } from '@/components/ui';
export default function LoggedOut() {
  return (
    <Centered>
      <Logo size={64} /><h1 className="h1">You are logged out</h1>
      <p className="body">This device no longer shows the circle. Your email alerts continue.</p>
      <a className="btn go" href="/signin">Sign in again</a><a className="btn out" href="/">Home page</a>
    </Centered>
  );
}
