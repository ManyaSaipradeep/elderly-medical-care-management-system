'use server';
import { redirect } from 'next/navigation';
import { q, one } from '@/lib/db';
import { sha256 } from '@/lib/crypto';
import { actOnDoses } from '@/lib/domain';

/** Confirms an email action. Opening the link only shows a page; this POST does the work, once. */
export async function confirmEmailAction(f: FormData) {
  const token = String(f.get('token') || '');
  const which = String(f.get('which') || 'all');
  const row = await one<{ circle_id: string; dose_ids: string[]; name: string; role: string }>(
    `update email_actions e set used_at = now() from members m
     where e.token_hash = $1 and e.used_at is null and e.expires_at > now() and m.id = e.member_id and m.status = 'active'
     returning e.circle_id, e.dose_ids, m.name, m.role`, [sha256(token)]);
  if (!row) redirect('/a/done?r=expired');
  const ids = which === 'all' ? row.dose_ids : row.dose_ids.filter((id) => id === which);
  const n = await actOnDoses(row.circle_id, ids, 'taken', `${row.name} (${row.role}, by email)`);
  redirect(`/a/done?r=${n ? 'ok' : 'already'}`);
}
