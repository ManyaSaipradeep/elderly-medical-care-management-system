'use server';
import { redirect } from 'next/navigation';
import { q, one, logActivity } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import { createPersonDevice } from '@/lib/session';
import { recipients, circleLabel } from '@/lib/domain';
import { sendMail, layout, esc } from '@/lib/mail';

export async function acceptSetup(f: FormData) {
  const token = String(f.get('token') || '');
  // Single use: only one request can flip used_at.
  const link = await one<{ circle_id: string }>(
    `update setup_links set used_at = now() where token_hash = $1 and used_at is null and expires_at > now() returning circle_id`, [sha256(token)]);
  if (!link) redirect(`/setup/${encodeURIComponent(token)}`);
  await q('update person_devices set revoked_at = now() where circle_id = $1 and revoked_at is null', [link.circle_id]);
  await q('update circles set consent_at = now() where id = $1', [link.circle_id]);
  await createPersonDevice(link.circle_id);
  const c = await one<{ person_name: string }>('select person_name from circles where id = $1', [link.circle_id]);
  await logActivity(link.circle_id, c!.person_name, 'Set up their phone and agreed to share with the circle');
  redirect('/p?welcome=1');
}

export async function talkFirst(f: FormData) {
  const token = String(f.get('token') || '');
  const link = await one<{ circle_id: string; person_name: string; call_name: string | null }>(
    `select l.circle_id, c.person_name, c.call_name from setup_links l join circles c on c.id = l.circle_id where l.token_hash = $1 and l.used_at is null and l.expires_at > now()`, [sha256(token)]);
  if (!link) redirect(`/setup/${encodeURIComponent(token)}`);
  const orgs = await recipients(link.circle_id, 'organisers');
  await sendMail(link.circle_id, orgs.map((o) => o.email), `${link.person_name} wants to talk before sharing`, layout({
    circleLabel: circleLabel(link), title: `${esc(link.person_name)} wants to talk first`,
    lines: ['They opened the setup link but want to talk before sharing their medicines. Please call them. The link still works until it expires.'],
  }));
  await logActivity(link.circle_id, link.person_name, 'Asked to talk before sharing');
  redirect(`/setup/${encodeURIComponent(token)}?told=1`);
}
