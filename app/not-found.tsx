import { Centered } from '@/components/AuthLayout';
export default function NotFound() {
  return (
    <Centered>
      <h1 className="h1">This page does not exist</h1>
      <p className="body">The address may be mistyped, or the page was removed.</p>
      <a className="btn ink" href="/">Go to the home page</a>
    </Centered>
  );
}
