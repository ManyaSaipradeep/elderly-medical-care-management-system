'use server';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { q, one, logActivity } from '@/lib/db';
import { requireMember, actorName, endMemberSession } from '@/lib/session';
import { actOnDoses, undoDoses, recipients, circleLabel, displayName, ensureDoses } from '@/lib/domain';
import { savePhoto } from '@/lib/photos';
import { sendMail, layout, esc, APP_URL } from '@/lib/mail';
import { hashSecret, checkSecret, isWeakPasscode, randomToken, sha256 } from '@/lib/crypto';
import { atLocal, startOfLocalDay, localDate } from '@/lib/time';
import { runTick } from '@/lib/tick';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const back = (f: FormData, fallback: string) => {
  const to = s(f, 'back');
  return to.startsWith('/app') ? to : fallback; // only internal paths
};

// ---------------- doses ----------------
export async function doseAction(f: FormData) {
  const { member, circle } = await requireMember();
  const ids = s(f, 'ids').split(',').filter((x) => /^[0-9a-f-]{36}$/.test(x));
  const act = s(f, 'act');
  const who = actorName(member);
  if (act === 'give') await actOnDoses(circle.id, ids, 'taken', who);
  else if (act === 'skip') await actOnDoses(circle.id, ids, 'skipped', who, s(f, 'reason').slice(0, 120) || 'Skipped');
  else if (act === 'undo') await undoDoses(circle.id, ids, who);
  revalidatePath('/app');
  redirect(back(f, '/app'));
}

// ---------------- medicines ----------------
const medSchema = z.object({
  name: z.string().trim().min(1).max(80), purpose: z.string().trim().max(80).optional(),
  n_morning: z.coerce.number().int().min(0).max(4), n_afternoon: z.coerce.number().int().min(0).max(4), n_night: z.coerce.number().int().min(0).max(4),
  t_morning: z.string().regex(/^\d\d:\d\d$/), t_afternoon: z.string().regex(/^\d\d:\d\d$/), t_night: z.string().regex(/^\d\d:\d\d$/),
  food: z.enum(['before', 'after', 'with', 'any']), importance: z.enum(['important', 'regular', 'supplement']),
  stock: z.coerce.number().int().min(0).max(10000),
});

export async function saveMedicine(f: FormData) {
  const { member, circle } = await requireMember();
  const id = s(f, 'id');
  const where = id ? `/app/medicines/${id}/edit` : '/app/medicines/new';
  const parsed = medSchema.safeParse(Object.fromEntries(['name', 'purpose', 'n_morning', 'n_afternoon', 'n_night', 't_morning', 't_afternoon', 't_night', 'food', 'importance', 'stock'].map((k) => [k, s(f, k) || undefined])));
  if (!parsed.success) redirect(`${where}?e=fields`);
  const m = parsed.data;
  if (m.n_morning + m.n_afternoon + m.n_night === 0) redirect(`${where}?e=med_none`);
  const pill = await savePhoto(circle.id, f.get('pill'));
  const strip = await savePhoto(circle.id, f.get('strip'));
  if (pill === 'invalid' || strip === 'invalid') redirect(`${where}?e=photo`);
  const who = actorName(member);
  const pattern = `${m.n_morning}-${m.n_afternoon}-${m.n_night}`;
  const dup = await one(`select 1 from medications where circle_id = $1 and active and lower(name) = lower($2) and id::text <> $3`, [circle.id, m.name, id || '']);
  if (dup) redirect(`${where}?e=med_dup`);
  let medId = id;
  if (id) {
    const prev = await one<{ name: string; n_morning: number; n_afternoon: number; n_night: number }>('select * from medications where id = $1 and circle_id = $2 and active', [id, circle.id]);
    if (!prev) redirect('/app/medicines');
    await q(
      `update medications set name=$3, purpose=$4, n_morning=$5, n_afternoon=$6, n_night=$7, t_morning=$8, t_afternoon=$9, t_night=$10,
        food=$11, importance=$12, stock=$13, pill_photo_id=coalesce($14, pill_photo_id), strip_photo_id=coalesce($15, strip_photo_id),
        refill_alerted_on=null, updated_at=now() where id=$1 and circle_id=$2`,
      [id, circle.id, m.name, m.purpose ?? null, m.n_morning, m.n_afternoon, m.n_night, m.t_morning, m.t_afternoon, m.t_night, m.food, m.importance, m.stock, pill, strip]);
    // Upcoming open doses follow the new schedule; history stays.
    await q(`delete from doses where med_id = $1 and status = 'pending' and due_at >= $2`, [id, startOfLocalDay(localDate()).toISOString()]);
    const prevPattern = `${prev.n_morning}-${prev.n_afternoon}-${prev.n_night}`;
    const summary = prevPattern !== pattern ? `${m.name}: now ${pattern} (was ${prevPattern})` : `${m.name}: details updated`;
    await q('insert into change_notices (circle_id, actor, summary) values ($1,$2,$3)', [circle.id, member.name, summary]);
    await logActivity(circle.id, who, `Changed ${summary}`);
    await notifyChange(circle, member.name, summary);
  } else {
    const row = await one<{ id: string }>(
      `insert into medications (circle_id, name, purpose, n_morning, n_afternoon, n_night, t_morning, t_afternoon, t_night, food, importance, stock, pill_photo_id, strip_photo_id)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) returning id`,
      [circle.id, m.name, m.purpose ?? null, m.n_morning, m.n_afternoon, m.n_night, m.t_morning, m.t_afternoon, m.t_night, m.food, m.importance, m.stock, pill, strip]);
    medId = row!.id;
    const summary = `${m.name} added (${pattern})`;
    await q('insert into change_notices (circle_id, actor, summary) values ($1,$2,$3)', [circle.id, member.name, summary]);
    await logActivity(circle.id, who, `Added ${m.name} (${pattern})`);
  }
  await ensureDoses(circle.id);
  revalidatePath('/app');
  redirect(`/app/medicines/${medId}?saved=1`);
}

async function notifyChange(circle: { id: string; person_name: string; call_name: string | null; person_email: string | null }, actor: string, summary: string) {
  const fam = await recipients(circle.id, 'family');
  await sendMail(circle.id, [circle.person_email, ...fam.map((x) => x.email)], `Medicine changed: ${summary}`, layout({
    circleLabel: circleLabel(circle), title: `${esc(actor)} changed a medicine`,
    lines: [esc(summary), `${esc(circle.person_name)} sees this on their screen and can say OK or ask a question.`],
    buttons: [{ label: 'Open medicines', href: `${APP_URL}/app/medicines`, tone: 'out' }],
  }));
}

export async function refill(f: FormData) {
  const { member, circle } = await requireMember();
  const add = Math.min(Math.max(parseInt(s(f, 'add'), 10) || 0, 0), 1000);
  const row = await one<{ name: string }>('update medications set stock = stock + $3, refill_alerted_on = null where id = $1 and circle_id = $2 returning name', [s(f, 'id'), circle.id, add]);
  if (row && add) await logActivity(circle.id, actorName(member), `Added ${add} ${row.name}`);
  revalidatePath('/app');
  redirect(`/app/medicines/${s(f, 'id')}`);
}

export async function stopMedicine(f: FormData) {
  const { member, circle } = await requireMember();
  const reason = s(f, 'reason').slice(0, 200) || 'No reason given';
  const row = await one<{ name: string }>('update medications set active = false, stopped_reason = $3, updated_at = now() where id = $1 and circle_id = $2 and active returning name', [s(f, 'id'), circle.id, reason]);
  if (row) {
    await q(`delete from doses where med_id = $1 and status = 'pending'`, [s(f, 'id')]);
    const summary = `${row.name} stopped: ${reason}`;
    await q('insert into change_notices (circle_id, actor, summary) values ($1,$2,$3)', [circle.id, member.name, summary]);
    await logActivity(circle.id, actorName(member), `Stopped ${summary}`);
    await notifyChange(circle, member.name, summary);
  }
  revalidatePath('/app');
  redirect('/app/medicines');
}

// ---------------- visits ----------------
export async function saveVisit(f: FormData) {
  const { member, circle } = await requireMember();
  const parsed = z.object({
    doctor: z.string().trim().min(1).max(80), location: z.string().trim().max(120).optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), time: z.string().regex(/^\d\d:\d\d$/), notes: z.string().max(2000).optional(),
  }).safeParse({ doctor: s(f, 'doctor'), location: s(f, 'location') || undefined, date: s(f, 'date'), time: s(f, 'time') || '10:00', notes: s(f, 'notes') || undefined });
  if (!parsed.success) redirect('/app/visits?e=fields');
  const v = parsed.data;
  const row = await one<{ id: string }>('insert into appointments (circle_id, doctor, location, at, notes, created_by) values ($1,$2,$3,$4,$5,$6) returning id',
    [circle.id, v.doctor, v.location ?? null, atLocal(v.date, v.time).toISOString(), v.notes ?? null, member.name]);
  await logActivity(circle.id, actorName(member), `Added a visit with ${v.doctor}`);
  redirect(`/app/visits/${row!.id}`);
}
export async function saveVisitNotes(f: FormData) {
  const { circle } = await requireMember();
  await q('update appointments set notes = $3 where id = $1 and circle_id = $2', [s(f, 'id'), circle.id, s(f, 'notes').slice(0, 2000)]);
  redirect(`/app/visits/${s(f, 'id')}?saved=1`);
}
export async function deleteVisit(f: FormData) {
  const { member, circle } = await requireMember();
  const row = await one<{ doctor: string }>('delete from appointments where id = $1 and circle_id = $2 returning doctor', [s(f, 'id'), circle.id]);
  if (row) await logActivity(circle.id, actorName(member), `Removed a visit with ${row.doctor}`);
  redirect('/app/visits');
}

// ---------------- people (family) ----------------
export async function decideRequest(f: FormData) {
  const { member, circle } = await requireMember({ family: true });
  const approve = s(f, 'decision') === 'approve';
  const row = await one<{ name: string; email: string; role: string }>(
    `update members set status = $3, decided_by = $4, decided_at = now()
     where id = $1 and circle_id = $2 and status = 'pending' and created_at > now() - interval '7 days' returning name, email, role`,
    [s(f, 'id'), circle.id, approve ? 'active' : 'declined', member.name]);
  if (row) {
    await logActivity(circle.id, actorName(member), `${approve ? 'Approved' : 'Declined'} ${row.name} (${row.role})`);
    await sendMail(circle.id, [row.email], approve ? `You are in ${displayName(circle)}'s circle` : 'Your CareCircle request', layout({
      circleLabel: circleLabel(circle), title: approve ? 'Your request was approved' : 'Your request was not approved',
      lines: [approve ? `${esc(member.name)} approved you. Sign in with the circle code and passcode.` : 'If you think this is a mistake, talk to the family directly.'],
      buttons: approve ? [{ label: 'Sign in', href: `${APP_URL}/signin`, tone: 'go' }] : [],
    }));
  }
  redirect('/app/people');
}
export async function removeMember(f: FormData) {
  const { member, circle } = await requireMember({ organiser: true });
  if (s(f, 'id') === member.id) redirect('/app/people');
  const row = await one<{ name: string }>(
    `update members set status = 'removed', session_version = session_version + 1, is_organiser = false, decided_by = $3, decided_at = now()
     where id = $1 and circle_id = $2 and status = 'active' returning name`, [s(f, 'id'), circle.id, member.name]);
  if (row) await logActivity(circle.id, actorName(member), `Removed ${row.name}`);
  redirect('/app/people');
}
export async function setOrganiser(f: FormData) {
  const { member, circle } = await requireMember({ organiser: true });
  const on = s(f, 'on') === '1';
  const row = await one<{ name: string }>(`update members set is_organiser = $3 where id = $1 and circle_id = $2 and status = 'active' and role = 'family' and id <> $4 returning name`, [s(f, 'id'), circle.id, on, member.id]);
  if (row) await logActivity(circle.id, actorName(member), `${on ? 'Made' : 'Removed'} ${row.name} ${on ? 'an organiser' : 'as organiser'}`);
  redirect('/app/people');
}

// ---------------- setup link for the person at the centre ----------------
export async function createSetupLink() {
  const { member, circle } = await requireMember({ organiser: true });
  const token = randomToken();
  await q(`update setup_links set expires_at = now() where circle_id = $1 and used_at is null and expires_at > now()`, [circle.id]);
  await q(`insert into setup_links (circle_id, token_hash, expires_at, created_by) values ($1,$2, now() + interval '24 hours', $3)`, [circle.id, sha256(token), member.name]);
  await logActivity(circle.id, actorName(member), "Made a new setup link for the care recipient's phone");
  // The raw token is shown once, to the organiser, via a short-lived cookie read by the page.
  const { setTicket } = await import('@/lib/session');
  await setTicket('setup', { token }, 60 * 60 * 24);
  redirect('/app/setup');
}
export async function emailSetupLink() {
  const { circle } = await requireMember({ organiser: true });
  const { getTicket } = await import('@/lib/session');
  const t = await getTicket<{ token: string }>('setup');
  if (!t || !circle.person_email) redirect('/app/setup');
  await sendMail(circle.id, [circle.person_email], 'Your CareCircle setup link', layout({
    circleLabel: circleLabel(circle), title: 'Open this on your own phone',
    lines: ['Your family set up CareCircle to help with your medicines. The link works once, for 24 hours.'],
    buttons: [{ label: 'Set up my phone', href: `${APP_URL}/setup/${t.token}`, tone: 'go' }],
    footer: 'If you did not expect this, ignore it.',
  }));
  redirect('/app/setup?sent=1');
}
export async function stopPersonDevices() {
  const { member, circle } = await requireMember({ organiser: true });
  await q('update person_devices set revoked_at = now() where circle_id = $1 and revoked_at is null', [circle.id]);
  await logActivity(circle.id, actorName(member), "Signed out the care recipient's phone");
  redirect('/app/setup?stopped=1');
}

// ---------------- settings ----------------
export async function changePasscode(f: FormData) {
  const { member, circle } = await requireMember({ organiser: true });
  const full = await one<{ passcode_hash: string }>('select passcode_hash from circles where id = $1', [circle.id]);
  if (!(await checkSecret(s(f, 'current'), full!.passcode_hash))) redirect('/app/settings?e=wrong_pass');
  const p1 = s(f, 'passcode'), p2 = s(f, 'passcode2');
  if (!/^\d{6}$/.test(p1)) redirect('/app/settings?e=pass_len');
  if (isWeakPasscode(p1)) redirect('/app/settings?e=pass_weak');
  if (p1 !== p2) redirect('/app/settings?e=pass_match');
  await q('update circles set passcode_hash = $2, failed_attempts = 0, locked_until = null where id = $1', [circle.id, await hashSecret(p1)]);
  await logActivity(circle.id, actorName(member), 'Changed the circle passcode');
  const all = await recipients(circle.id, 'all');
  await sendMail(circle.id, all.map((x) => x.email), 'The circle passcode was changed', layout({
    circleLabel: circleLabel(circle), title: `${esc(member.name)} changed the passcode`,
    lines: ['Your sign-in still works. New members need the new passcode, which an organiser will tell you directly.'],
  }));
  redirect('/app/settings?ok=pass');
}
export async function deleteCircle(f: FormData) {
  const { circle } = await requireMember({ organiser: true });
  if (s(f, 'confirm') !== circle.person_name) redirect('/app/settings?e=confirm_name');
  const all = await recipients(circle.id, 'all');
  // Tell everyone first; the outbox rows are removed with the circle, so send synchronously.
  await sendMail(null, [circle.person_email, ...all.map((x) => x.email)], `${displayName(circle)}'s circle was deleted`, layout({
    circleLabel: circleLabel(circle), title: 'This care circle was deleted', lines: ['All medicines, records, visits and photos have been deleted.'],
  }));
  await q('delete from circles where id = $1', [circle.id]);
  await endMemberSession();
  redirect('/?deleted=1');
}

// ---------------- account ----------------
export async function savePrefs(f: FormData) {
  const { member } = await requireMember();
  const prefs = Object.fromEntries(['upcoming', 'waiting', 'visits', 'refills'].map((k) => [k, f.get(k) === 'on']));
  await q('update members set email_prefs = $2 where id = $1', [member.id, JSON.stringify(prefs)]);
  redirect('/app/account?saved=1');
}
export async function leaveCircle() {
  const { member, circle } = await requireMember();
  if (member.is_organiser) {
    const others = await one<{ n: number }>(`select count(*)::int as n from members where circle_id = $1 and status = 'active' and is_organiser and id <> $2`, [circle.id, member.id]);
    if (!others?.n) redirect('/app/account?e=last_org');
  }
  await q(`update members set status = 'removed', session_version = session_version + 1, is_organiser = false where id = $1`, [member.id]);
  await logActivity(circle.id, actorName(member), 'Left the circle');
  await endMemberSession();
  redirect('/logged-out');
}

export async function runRemindersNow() {
  const { member, circle } = await requireMember({ family: true });
  const sent = await runTick(circle.id);
  await logActivity(circle.id, actorName(member), `Ran reminders now (${sent} emails)`);
  redirect('/app?ran=1');
}


export async function handleHelp(f: FormData) {
  const { member, circle } = await requireMember();
  const row = await one(`update help_requests set handled_at = now(), handled_by = $3 where id = $1 and circle_id = $2 and handled_at is null returning id`, [s(f, 'id'), circle.id, member.name]);
  if (row) await logActivity(circle.id, actorName(member), 'Responded to the Help request');
  revalidatePath('/app');
}
