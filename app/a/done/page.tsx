import { Centered } from '@/components/AuthLayout';
export default async function Done({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const { r } = await searchParams;
  if (r === 'ok') return <Centered><div className="note n-ok" style={{ fontSize: 19 }}><b>Recorded. Thank you.</b> Nobody else will be emailed about this dose.</div></Centered>;
  if (r === 'already') return <Centered><h1 className="h1">Already recorded</h1><p className="body">Someone confirmed it first. Nothing more to do.</p></Centered>;
  return <Centered><h1 className="h1">This link has expired</h1><p className="body">Email buttons work once, for 12 hours. Sign in to change the dose.</p><a className="btn go" href="/signin">Sign in</a></Centered>;
}
