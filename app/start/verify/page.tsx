import { AuthLayout } from '@/components/AuthLayout';
import { Steps } from '@/components/ui';
import { CodeForm } from '@/components/CodeForm';
import { startVerify } from '../../access-actions';
import { getTicket } from '@/lib/session';
import { msg } from '@/lib/errors';
import { redirect } from 'next/navigation';

export default async function StartVerify({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const t = await getTicket<{ email: string; demo?: string }>('start');
  if (!t) redirect('/start?e=ticket');
  return (
    <AuthLayout side={<><p style={{ fontSize: 26, fontWeight: 700 }}>Start a care circle</p><Steps labels={['Who it is for', 'About you', 'Circle passcode', 'Check your email']} current={3} /></>}>
      <CodeForm action={startVerify} error={msg(sp.e)} email={t.email} demo={t.demo} button="Create the circle" />
      <a className="link" href="/start" style={{ display: 'flex', alignItems: 'center' }}>Start again</a>
    </AuthLayout>
  );
}
