import { AuthLayout } from '@/components/AuthLayout';
import { Steps } from '@/components/ui';
import { CodeForm } from '@/components/CodeForm';
import { signinVerify } from '../../access-actions';
import { getTicket } from '@/lib/session';
import { msg } from '@/lib/errors';
import { redirect } from 'next/navigation';

export default async function SignInVerify({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const sp = await searchParams;
  const t = await getTicket<{ otpId: string; demo?: string }>('signin');
  if (!t?.otpId) redirect('/signin?e=ticket');
  return (
    <AuthLayout side={<><p style={{ fontSize: 26, fontWeight: 700 }}>Welcome back</p><Steps labels={['Code and passcode', 'Who are you', 'Email code']} current={2} /></>}>
      <CodeForm action={signinVerify} error={msg(sp.e)} demo={t.demo} button="Sign in" />
      <a className="link" href="/signin/who" style={{ display: 'flex', alignItems: 'center' }}>That is not me</a>
    </AuthLayout>
  );
}
