'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { q, one, tx, logActivity, log } from '@/lib/db';
import { hashSecret, isWeakPasscode, randomCircleCode } from '@/lib/crypto';
import {
  setTicket, getTicket, clearTicket, startMemberSession, endMemberSession, clientIp, currentMember,
} from '@/lib/session';
import { OtpLimit, issueOtp, verifyOtp, checkCirclePasscode, rateLimit, recipients, circleLabel, displayName } from '@/lib/domain';
import { sendMail, layout, esc, APP_URL } from '@/lib/mail';

const s = (f: FormData, k: string) => String(f.get(k) ?? '').trim();
const email = z.string().trim().toLowerCase().email().max(120);
const name = z.string().trim().min(1).max(80);

async function limited(bucket: string) {
  return !(await rateLimit(`${bucket}:${await clientIp()}`, 20, 15 * 60));
}

// ---------------- start a circle ----------------
export async function startCircle(f: FormData) {
  if (await limited('start')) redirect('/start?e=slow_down');
  const forWhom = s(f, 'for') === 'myself' ? 'myself' : 'someone';
  const parsed = z.object({
    yourName: name, yourEmail: email, relation: z.string().max(60).optional(),
    personName: forWhom === 'myself' ? z.string().optional() : name,
    callName: z.string().max(40).optional(), personEmail: z.union([z.literal(''), email]).optional(),
  }).safeParse({
    yourName: s(f, 'yourName'), yourEmail: s(f, 'yourEmail'), relation: s(f, 'relation') || undefined,
    personName: s(f, 'personName'), callName: s(f, 'callName') || undefined, personEmail: s(f, 'personEmail'),
  });
  if (!parsed.success) redirect(`/start?e=${parsed.error.issues.some((i) => i.path[0]?.toString().includes('mail')) ? 'email' : 'fields'}`);
  const p1 = s(f, 'passcode'), p2 = s(f, 'passcode2');
  if (!/^\d{6}$/.test(p1)) redirect('/start?e=pass_len');
  if (isWeakPasscode(p1)) redirect('/start?e=pass_weak');
  if (p1 !== p2) redirect('/start?e=pass_match');
  if (f.get('agree') !== 'on') redirect('/start?e=fields');
  const d = parsed.data;
  const payload = {
    forWhom, yourName: d.yourName, relation: forWhom === 'myself' ? 'self' : d.relation ?? null,
    personName: forWhom === 'myself' ? d.yourName : d.personName, callName: d.callName ?? null,
    personEmail: forWhom === 'myself' ? d.yourEmail : d.personEmail || null, passcodeHash: await hashSecret(p1),
  };
  const otp = await issueOtp('start', d.yourEmail, payload, `${payload.personName}'s new circle`).catch((e) => { if (e instanceof OtpLimit) return null; throw e; });
  if (!otp) redirect('/start?e=slow_down');
  await setTicket('start', { otpId: otp.id, email: d.yourEmail, demo: otp.demoCode });
  redirect('/start/verify');
}

export async function startVerify(f: FormData) {
  const t = await getTicket<{ otpId: string; email: string }>('start');
  if (!t) redirect('/start?e=ticket');
  const r = await verifyOtp(t.otpId, s(f, 'code'), 'start');
  if (!r.ok) redirect('/start/verify?e=otp');
  const p = r.payload;
  const member = await tx(async (c) => {
    let circleId = '';
    for (let i = 0; i < 5 && !circleId; i++) {
      const res = await c.query(
        `insert into circles (person_name, call_name, person_email, code, passcode_hash) values ($1,$2,$3,$4,$5)
         on conflict (code) do nothing returning id`,
        [p.personName, p.callName, p.personEmail, randomCircleCode(), p.passcodeHash]);
      circleId = res.rows[0]?.id ?? '';
    }
    if (!circleId) throw new Error('could not allocate circle code');
    const m = await c.query(
      `insert into members (circle_id, name, email, relation, role, is_organiser, status, decided_by, decided_at)
       values ($1,$2,$3,$4,'family',true,'active','started the circle',now()) returning id, session_version`,
      [circleId, p.yourName, r.email, p.relation]);
    await c.query('insert into activity (circle_id, actor, action) values ($1,$2,$3)', [circleId, p.yourName, 'Started the circle']);
    return { ...m.rows[0], circleId };
  });
  await clearTicket('start');
  await startMemberSession(member);
  log('circle.created', { circle: member.circleId });
  redirect('/app/welcome');
}

// ---------------- join (request + approval) ----------------
export async function joinCheck(f: FormData) {
  if (await limited('join')) redirect('/join?e=slow_down');
  const r = await checkCirclePasscode(s(f, 'code'), s(f, 'passcode'));
  if (!r.ok) redirect(`/join?e=${r.error}${'left' in r ? `&n=${r.left}` : ''}`);
  await setTicket('join', { circleId: r.circleId });
  redirect('/join/details');
}

export async function joinDetails(f: FormData) {
  const t = await getTicket<{ circleId: string }>('join');
  if (!t) redirect('/join?e=ticket');
  const parsed = z.object({ name, email, relation: z.string().max(60).optional(), role: z.enum(['family', 'caretaker']) })
    .safeParse({ name: s(f, 'name'), email: s(f, 'email'), relation: s(f, 'relation') || undefined, role: s(f, 'role') });
  if (!parsed.success) redirect(`/join/details?e=${parsed.error.issues.some((i) => i.path[0] === 'email') ? 'email' : 'fields'}`);
  const dup = await one(`select 1 from members where circle_id = $1 and lower(email) = $2 and status in ('pending','active')`, [t.circleId, parsed.data.email]);
  if (dup) redirect('/join/details?e=exists');
  const circle = await one<{ person_name: string; call_name: string | null }>('select person_name, call_name from circles where id = $1', [t.circleId]);
  const otp = await issueOtp('join', parsed.data.email, { ...parsed.data, circleId: t.circleId }, `${displayName(circle!)}'s circle`).catch((e) => { if (e instanceof OtpLimit) return null; throw e; });
  if (!otp) redirect('/join/details?e=slow_down');
  await setTicket('join', { circleId: t.circleId, otpId: otp.id, email: parsed.data.email, demo: otp.demoCode });
  redirect('/join/verify');
}

export async function joinVerify(f: FormData) {
  const t = await getTicket<{ circleId: string; otpId: string; email: string }>('join');
  if (!t?.otpId) redirect('/join?e=ticket');
  const r = await verifyOtp(t.otpId, s(f, 'code'), 'join');
  if (!r.ok) redirect('/join/verify?e=otp');
  const p = r.payload as { name: string; relation?: string; role: 'family' | 'caretaker'; circleId: string };
  try {
    await q(`insert into members (circle_id, name, email, relation, role, status) values ($1,$2,$3,$4,$5,'pending')`,
      [p.circleId, p.name, r.email, p.relation ?? null, p.role]);
  } catch {
    redirect('/join/details?e=exists');
  }
  await logActivity(p.circleId, p.name, `Asked to join as ${p.role}`);
  const circle = (await one<{ person_name: string; call_name: string | null; person_email: string | null }>('select person_name, call_name, person_email from circles where id = $1', [p.circleId]))!;
  const orgs = await recipients(p.circleId, 'organisers');
  await sendMail(p.circleId, [...orgs.map((o) => o.email), circle.person_email], `${p.name} asked to join ${displayName(circle)}'s circle`, layout({
    circleLabel: circleLabel(circle), title: `${esc(p.name)} wants to join as ${p.role}`,
    lines: [`Email: ${esc(r.email)}. Approve only if you know them. The request expires in 7 days.`, `${esc(circle.person_name)} can also approve it on their own screen.`],
    buttons: [{ label: 'Review request', href: `${APP_URL}/app/people`, tone: 'ink' }],
  }));
  await clearTicket('join');
  redirect('/join/sent');
}

// ---------------- sign in ----------------
export async function signinCheck(f: FormData) {
  if (await limited('signin')) redirect('/signin?e=slow_down');
  const r = await checkCirclePasscode(s(f, 'code'), s(f, 'passcode'));
  if (!r.ok) redirect(`/signin?e=${r.error}${'left' in r ? `&n=${r.left}` : ''}`);
  await setTicket('signin', { circleId: r.circleId });
  redirect('/signin/who');
}

export async function signinWho(f: FormData) {
  const t = await getTicket<{ circleId: string }>('signin');
  if (!t) redirect('/signin?e=ticket');
  const m = await one<{ id: string; email: string; name: string }>(
    `select id, email, name from members where id = $1 and circle_id = $2 and status = 'active'`, [s(f, 'member'), t.circleId]);
  if (!m) redirect('/signin/who');
  const circle = await one<{ person_name: string; call_name: string | null }>('select person_name, call_name from circles where id = $1', [t.circleId]);
  const otp = await issueOtp('signin', m.email, { memberId: m.id }, `${displayName(circle!)}'s circle`).catch((e) => { if (e instanceof OtpLimit) return null; throw e; });
  if (!otp) redirect('/signin/who?e=slow_down');
  await setTicket('signin', { circleId: t.circleId, otpId: otp.id, memberId: m.id, demo: otp.demoCode });
  redirect('/signin/verify');
}

export async function signinVerify(f: FormData) {
  const t = await getTicket<{ circleId: string; otpId: string; memberId: string }>('signin');
  if (!t?.otpId) redirect('/signin?e=ticket');
  const r = await verifyOtp(t.otpId, s(f, 'code'), 'signin');
  if (!r.ok || r.payload.memberId !== t.memberId) redirect('/signin/verify?e=otp');
  const m = await one<{ id: string; session_version: number }>(`select id, session_version from members where id = $1 and status = 'active'`, [t.memberId]);
  if (!m) redirect('/signin?e=ticket');
  await clearTicket('signin');
  await startMemberSession(m);
  redirect('/app');
}

export async function resendCode(f: FormData) {
  const flow = s(f, 'flow');
  redirect(flow === 'join' ? '/join/details' : flow === 'start' ? '/start' : '/signin/who');
}

export async function logout() {
  const ctx = await currentMember();
  if (ctx) {
    await q('update members set session_version = session_version + 1 where id = $1', [ctx.member.id]);
    await logActivity(ctx.circle.id, ctx.member.name, 'Logged out');
  }
  await endMemberSession();
  redirect('/logged-out');
}

/** From the "Who are you?" step: someone with the code and passcode who is not on the list asks to join. */
export async function signinToJoin() {
  const t = await getTicket<{ circleId: string }>('signin');
  if (!t) redirect('/join');
  await setTicket('join', { circleId: t.circleId });
  redirect('/join/details');
}
