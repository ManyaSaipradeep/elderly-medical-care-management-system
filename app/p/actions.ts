'use server';
import { redirect } from 'next/navigation';
import { q, one, logActivity } from '@/lib/db';
import { currentPerson } from '@/lib/session';
import { actOnDoses, undoDoses, recipients, circleLabel, displayName } from '@/lib/domain';
import { sendMail, layout, esc, APP_URL } from '@/lib/mail';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const ids = (f: FormData) => s(f, 'ids').split(',').filter((x) => /^[0-9a-f-]{36}$/.test(x));

async function person() {
  const c = await currentPerson();
  if (!c) redirect('/p');
  return c;
}

export async function take(f: FormData) {
  const c = await person();
  const list = ids(f);
  await actOnDoses(c.id, list, 'taken', c.person_name);
  redirect(`/p?done=taken&ids=${list.join(',')}`);
}
export async function skip(f: FormData) {
  const c = await person();
  const list = ids(f);
  const reason = ['I feel unwell', 'The tablets have run out', "I don't want to take them today"].includes(s(f, 'reason')) ? s(f, 'reason') : 'Not today';
  await actOnDoses(c.id, list, 'skipped', c.person_name, reason);
  redirect(`/p?done=skipped&ids=${list.join(',')}`);
}
export async function snooze(f: FormData) {
  const c = await person();
  await q(`update doses set snoozed_until = now() + interval '15 minutes' where id = any($1::uuid[]) and circle_id = $2 and status = 'pending'`, [ids(f), c.id]);
  await logActivity(c.id, c.person_name, 'Asked to be reminded in 15 minutes');
  redirect('/p?snoozed=1');
}
export async function undo(f: FormData) {
  const c = await person();
  await undoDoses(c.id, ids(f), c.person_name);
  redirect('/p');
}
export async function askHelp() {
  const c = await person();
  // At most one help email every 10 minutes, so a repeated tap does not flood the family.
  const ok = await one(`update circles set last_help_at = now() where id = $1 and (last_help_at is null or last_help_at < now() - interval '10 minutes') returning id`, [c.id]);
  if (ok) {
    const all = await recipients(c.id, 'all');
    await sendMail(c.id, all.map((m) => m.email), `${displayName(c)} asked for a call`, layout({
      circleLabel: circleLabel(c), title: `${esc(c.person_name)} pressed Help`, urgent: true,
      lines: ['Please call them as soon as you can. In an emergency, call 112.'],
      buttons: [{ label: 'Open the circle', href: `${APP_URL}/app`, tone: 'alert' }],
    }));
    await logActivity(c.id, c.person_name, 'Pressed Help');
  }
  redirect('/p?help=sent');
}
export async function ackChange(f: FormData) {
  const c = await person();
  const ack = s(f, 'ack') === 'question' ? 'question' : 'ok';
  const row = await one<{ summary: string; actor: string }>(`update change_notices set ack = $3, ack_at = now() where id = $1 and circle_id = $2 and ack is null returning summary, actor`, [s(f, 'id'), c.id, ack]);
  if (row && ack === 'question') {
    const fam = await recipients(c.id, 'family');
    await sendMail(c.id, fam.map((m) => m.email), `${displayName(c)} has a question about a change`, layout({
      circleLabel: circleLabel(c), title: `${esc(c.person_name)} has a question`,
      lines: [`About: ${esc(row.summary)} (changed by ${esc(row.actor)}). Please call them.`],
    }));
  }
  if (row) await logActivity(c.id, c.person_name, ack === 'ok' ? `Said OK to: ${row.summary}` : `Has a question about: ${row.summary}`);
  redirect(`/p${ack === 'question' ? '?asked=1' : ''}`);
}
export async function decide(f: FormData) {
  const c = await person();
  const approve = s(f, 'decision') === 'approve';
  const row = await one<{ name: string; email: string; role: string }>(
    `update members set status = $3, decided_by = $4, decided_at = now() where id = $1 and circle_id = $2 and status = 'pending' and created_at > now() - interval '7 days' returning name, email, role`,
    [s(f, 'id'), c.id, approve ? 'active' : 'declined', c.person_name]);
  if (row) {
    await logActivity(c.id, c.person_name, `${approve ? 'Allowed' : 'Said no to'} ${row.name} (${row.role})`);
    await sendMail(c.id, [row.email], approve ? `You are in ${displayName(c)}'s circle` : 'Your CareCircle request', layout({
      circleLabel: circleLabel(c), title: approve ? 'Your request was approved' : 'Your request was not approved',
      lines: [approve ? `${esc(c.person_name)} approved you. Sign in with the circle code and passcode.` : 'If you think this is a mistake, talk to the family directly.'],
      buttons: approve ? [{ label: 'Sign in', href: `${APP_URL}/signin`, tone: 'go' }] : [],
    }));
  }
  redirect('/p?tab=people');
}
export async function removePerson(f: FormData) {
  const c = await person();
  const row = await one<{ name: string; is_organiser: boolean }>(`select name, is_organiser from members where id = $1 and circle_id = $2 and status = 'active'`, [s(f, 'id'), c.id]);
  if (row) {
    await q(`update members set status = 'removed', is_organiser = false, session_version = session_version + 1, decided_by = $3, decided_at = now() where id = $1 and circle_id = $2`, [s(f, 'id'), c.id, c.person_name]);
    await logActivity(c.id, c.person_name, `Removed ${row.name} from their circle`);
    const orgs = await recipients(c.id, 'organisers');
    await sendMail(c.id, orgs.map((o) => o.email), `${displayName(c)} removed ${row.name}`, layout({
      circleLabel: circleLabel(c), title: `${esc(c.person_name)} removed ${esc(row.name)}`, lines: ['They can no longer see the circle.'],
    }));
  }
  redirect('/p?tab=people');
}
