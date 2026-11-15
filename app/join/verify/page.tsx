import { AuthLayout } from '@/components/AuthLayout';
import { Steps } from '@/components/ui';
import { CodeForm } from '@/components/CodeForm';
import { joinVerify } from '../../access-actions';
import { getTicket } from '@/lib/session';
import { msg } from '@/lib/errors';
import { redirect } from 'next/navigation';

export default async function JoinVerify({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const t = await getTicket<{ email: string; demo?: string }>('join');
  if (!t?.email) redirect('/join?e=ticket');
  return (
    <AuthLayout side={<><p style={{ fontSize: 26, fontWeight: 700 }}>Joining a circle</p><Steps labels={['Code and passcode', 'About you', 'Check your email', 'Wait for approval']} current={2} /></>}>
      <CodeForm action={joinVerify} error={msg(sp.e)} email={t.email} demo={t.demo} button="Send my request" />
      <a className="link" href="/join/details" style={{ display: 'flex', alignItems: 'center' }}>Send a new code</a>
    </AuthLayout>
  );
}
