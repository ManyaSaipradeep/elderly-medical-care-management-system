import 'server-only';
import { q, one, logActivity } from './db';
import { SLOTS, type Slot, localDate, addDays, atLocal, startOfLocalDay } from './time';
import { hashSecret, checkSecret, randomDigits, sha256 } from './crypto';
import { sendMail, layout, esc } from './mail';

export type Med = {
  id: string; circle_id: string; name: string; purpose: string | null;
  n_morning: number; n_afternoon: number; n_night: number;
  t_morning: string; t_afternoon: string; t_night: string;
  food: 'before' | 'after' | 'with' | 'any'; importance: 'important' | 'regular' | 'supplement';
  stock: number; pill_photo_id: string | null; strip_photo_id: string | null; active: boolean;
  stopped_reason: string | null; refill_alerted_on: string | null;
};
export type Dose = {
  id: string; circle_id: string; med_id: string; slot: Slot; qty: number; due_at: string; status: 'pending' | 'taken' | 'skipped' | 'missed';
  reason: string | null; acted_by: string | null; acted_at: string | null; snoozed_until: string | null; notified_level: number;
};
export type DoseWithMed = Dose & { med: Med };

export const FOOD_LABEL = { before: 'Before food', after: 'After food', with: 'With food', any: 'Any time' } as const;
export const IMPORTANCE_LABEL = { important: 'Important', regular: 'Regular', supplement: 'Supplement' } as const;
export const perDay = (m: Med) => m.n_morning + m.n_afternoon + m.n_night;
export const daysLeft = (m: Med) => (perDay(m) ? Math.floor(m.stock / perDay(m)) : null);
export const pattern = (m: Med) => `${m.n_morning}-${m.n_afternoon}-${m.n_night}`;
export const slotCount = (m: Med, s: Slot) => (s === 'morning' ? m.n_morning : s === 'afternoon' ? m.n_afternoon : m.n_night);
export const slotTime = (m: Med, s: Slot) => (s === 'morning' ? m.t_morning : s === 'afternoon' ? m.t_afternoon : m.t_night);
export const takeLine = (qty: number) => `Take ${qty}`;

/** Create today's and tomorrow's dose rows. Safe to repeat: unique(med_id, due_at). */
export async function ensureDoses(circleId?: string) {
  const meds = await q<Med>(`select * from medications where active ${circleId ? 'and circle_id = $1' : ''}`, circleId ? [circleId] : []);
  const today = localDate();
  const rows: unknown[][] = [];
  for (const m of meds) {
    for (const d of [today, addDays(today, 1)]) {
      for (const s of SLOTS) {
        const n = slotCount(m, s);
        if (n > 0) rows.push([m.circle_id, m.id, s, n, atLocal(d, slotTime(m, s)).toISOString()]);
      }
    }
  }
  if (!rows.length) return;
  const values = rows.map((_, i) => `($${i * 5 + 1},$${i * 5 + 2},$${i * 5 + 3},$${i * 5 + 4},$${i * 5 + 5})`).join(',');
  await q(`insert into doses (circle_id, med_id, slot, qty, due_at) values ${values} on conflict (med_id, due_at) do nothing`, rows.flat());
}

const MED_COLS = `json_build_object('id',m.id,'circle_id',m.circle_id,'name',m.name,'purpose',m.purpose,'n_morning',m.n_morning,'n_afternoon',m.n_afternoon,'n_night',m.n_night,'t_morning',m.t_morning,'t_afternoon',m.t_afternoon,'t_night',m.t_night,'food',m.food,'importance',m.importance,'stock',m.stock,'pill_photo_id',m.pill_photo_id,'strip_photo_id',m.strip_photo_id,'active',m.active)`;

export async function dosesBetween(circleId: string, from: Date, to: Date) {
  return q<DoseWithMed>(
    `select d.*, ${MED_COLS} as med from doses d join medications m on m.id = d.med_id
     where d.circle_id = $1 and d.due_at >= $2 and d.due_at < $3 order by d.due_at, m.importance, m.name`,
    [circleId, from.toISOString(), to.toISOString()]);
}
export async function todayDoses(circleId: string) {
  await ensureDoses(circleId);
  const start = startOfLocalDay(localDate());
  return dosesBetween(circleId, start, new Date(start.getTime() + 86400000));
}

/** The slot the person should act on now: earliest open dose due within the next hour (or overdue today). */
export function currentSlot(doses: DoseWithMed[], now = Date.now()) {
  const open = doses.filter((d) => d.status === 'pending' && new Date(d.due_at).getTime() <= now + 60 * 60000);
  if (!open.length) return null;
  const first = open[0];
  return { slot: first.slot, due_at: first.due_at, doses: doses.filter((d) => d.slot === first.slot && d.due_at === first.due_at) };
}

/** Mark doses taken or skipped. Only open doses change, so the first person to act wins. */
export async function actOnDoses(circleId: string, ids: string[], status: 'taken' | 'skipped', actor: string, reason?: string | null) {
  if (!ids.length) return 0;
  const rows = await q<{ id: string; med_id: string; qty: number; name: string }>(
    `update doses d set status = $3, acted_by = $4, acted_at = now(), reason = $5
     from medications m
     where m.id = d.med_id and d.id = any($2::uuid[]) and d.circle_id = $1 and d.status in ('pending','missed')
     returning d.id, d.med_id, d.qty, m.name`,
    [circleId, ids, status, actor, reason ?? null]);
  if (status === 'taken') {
    for (const r of rows) await q('update medications set stock = greatest(stock - $2, 0) where id = $1', [r.med_id, r.qty]);
  }
  if (rows.length) await logActivity(circleId, actor, `${status === 'taken' ? 'Confirmed taken' : 'Skipped'}: ${rows.map((r) => r.name).join(', ')}${reason ? ` (“${reason}”)` : ''}`);
  return rows.length;
}

/** Undo within 15 minutes, restoring stock. */
export async function undoDoses(circleId: string, ids: string[], actor: string) {
  const rows = await q<{ med_id: string; qty: number; status: string; name: string }>(
    `with prev as (select id, status as old_status from doses where id = any($2::uuid[]) and circle_id = $1
                   and status in ('taken','skipped') and acted_at > now() - interval '15 minutes')
     update doses d set status = 'pending', acted_by = null, acted_at = null, reason = null
     from prev, medications m where d.id = prev.id and m.id = d.med_id
     returning d.med_id, d.qty, prev.old_status as status, m.name`,
    [circleId, ids]);
  for (const r of rows) if (r.status === 'taken') await q('update medications set stock = stock + $2 where id = $1', [r.med_id, r.qty]);
  if (rows.length) await logActivity(circleId, actor, `Undid: ${rows.map((r) => r.name).join(', ')}`);
  return rows.length;
}

export async function adherence(circleId: string, days: number) {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await q<{ med_id: string; status: string; due_at: string }>(
    `select med_id, status, due_at from doses where circle_id = $1 and due_at >= $2 and due_at <= now()`, [circleId, since.toISOString()]);
  const decided = rows.filter((r) => r.status !== 'pending');
  const taken = decided.filter((r) => r.status === 'taken').length;
  return { rows, taken, total: decided.length, pct: decided.length ? Math.round((taken / decided.length) * 100) : null };
}

/** 14-day grid: per medicine, per day → t / s / m / p / n */
export async function grid14(circleId: string, meds: Med[]) {
  const today = localDate();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const rows = await q<{ med_id: string; status: string; d: string }>(
    `select med_id, status, to_char(due_at at time zone 'Asia/Kolkata', 'YYYY-MM-DD') as d from doses
     where circle_id = $1 and due_at >= $2 and due_at <= now()`, [circleId, startOfLocalDay(days[0]).toISOString()]);
  return {
    days,
    meds: meds.map((m) => ({
      med: m,
      cells: days.map((d) => {
        const rs = rows.filter((r) => r.med_id === m.id && r.d === d);
        if (!rs.length) return 'n';
        if (rs.some((r) => r.status === 'missed')) return 'm';
        if (rs.some((r) => r.status === 'skipped')) return 's';
        if (rs.some((r) => r.status === 'pending')) return 'p';
        return 't';
      }),
    })),
  };
}

export async function skipReasons(circleId: string, days = 30) {
  return q<{ due_at: string; slot: Slot; reason: string; name: string; status: string }>(
    `select d.due_at, d.slot, d.reason, d.status, m.name from doses d join medications m on m.id = d.med_id
     where d.circle_id = $1 and d.status in ('skipped','missed') and d.due_at > now() - ($2 || ' days')::interval
     order by d.due_at desc limit 20`, [circleId, String(days)]);
}

// ---------- recipients ----------
export async function recipients(circleId: string, who: 'all' | 'caretakers' | 'organisers' | 'family') {
  const rows = await q<{ id: string; email: string; role: string; is_organiser: boolean; email_prefs: Record<string, boolean> }>(
    `select id, email, role, is_organiser, email_prefs from members where circle_id = $1 and status = 'active'`, [circleId]);
  if (who === 'all') return rows;
  if (who === 'caretakers') return rows.filter((r) => r.role === 'caretaker');
  if (who === 'family') return rows.filter((r) => r.role === 'family');
  return rows.filter((r) => r.is_organiser);
}
export const circleLabel = (c: { person_name: string; call_name: string | null }) => `${esc(c.call_name || c.person_name)}'s circle`;
export const displayName = (c: { person_name: string; call_name: string | null }) => c.call_name || c.person_name;

// ---------- one-time email codes ----------
export async function issueOtp(purpose: 'start' | 'join' | 'signin', email: string, payload: object, circleLabelText: string) {
  if (!(await rateLimit(`otp:${email.toLowerCase()}`, 5, 15 * 60))) throw new OtpLimit();
  const code = randomDigits(6);
  await q(`update otps set consumed_at = now() where email = lower($1) and purpose = $2 and consumed_at is null`, [email, purpose]);
  const [row] = await q<{ id: string }>(
    `insert into otps (purpose, email, code_hash, payload, expires_at) values ($1, lower($2), $3, $4, now() + interval '10 minutes') returning id`,
    [purpose, email, await hashSecret(code), JSON.stringify(payload)]);
  await sendMail(null, [email], 'Your CareCircle code', layout({
    circleLabel: esc(circleLabelText), title: `Your code is ${code}`,
    lines: ['It works for 10 minutes.', 'If you did not ask for this, ignore this email.'],
    footer: 'CareCircle never asks for the circle passcode by email.',
  }), { redact: code });
  return { id: row.id, demoCode: DEMO_CODES ? code : undefined };
}
/** Demo only: with no email server configured and DEMO_OUTBOX=1, codes are shown on screen. */
export const DEMO_CODES = process.env.DEMO_OUTBOX === '1' && !(process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD);
/** Returns the payload on success. The attempt is counted before comparing, so parallel guesses cannot exceed 5. */
export async function verifyOtp(id: string, code: string, purpose: 'start' | 'join' | 'signin'): Promise<{ ok: true; payload: any; email: string } | { ok: false; error: string }> {
  const row = await one<{ code_hash: string; payload: any; email: string }>(
    `update otps set attempts = attempts + 1 where id = $1 and purpose = $2 and consumed_at is null and expires_at > now() and attempts < 5
     returning code_hash, payload, email`, [id, purpose]);
  if (!row) return { ok: false, error: 'That code is no longer valid. Ask for a new one.' };
  if (!/^\d{6}$/.test(code) || !(await checkSecret(code, row.code_hash))) return { ok: false, error: 'That code is not right.' };
  const used = await q('update otps set consumed_at = now() where id = $1 and consumed_at is null returning id', [id]);
  if (!used.length) return { ok: false, error: 'That code was already used.' };
  return { ok: true, payload: row.payload, email: row.email };
}
export class OtpLimit extends Error {}

// ---------- passcode check with circle lockout ----------
export async function checkCirclePasscode(code: string, passcode: string) {
  // Count the attempt first (atomic), then compare, so a burst of parallel guesses cannot exceed the limit.
  const circle = await one<{ id: string; passcode_hash: string; failed_attempts: number; person_name: string; call_name: string | null }>(
    `update circles set failed_attempts = failed_attempts + 1
     where code = upper($1) and (locked_until is null or locked_until < now()) returning id, passcode_hash, failed_attempts, person_name, call_name`, [code.trim()]);
  if (!circle) {
    const locked = await one(`select 1 from circles where code = upper($1) and locked_until > now()`, [code.trim()]);
    return locked ? { ok: false as const, error: 'locked', locked: true } : { ok: false as const, error: 'bad_code' };
  }
  if (!/^\d{6}$/.test(passcode) || !(await checkSecret(passcode, circle.passcode_hash))) {
    if (circle.failed_attempts >= 5) {
      await q(`update circles set failed_attempts = 0, locked_until = now() + interval '15 minutes' where id = $1`, [circle.id]);
      const orgs = await recipients(circle.id, 'organisers');
      await sendMail(circle.id, orgs.map((o) => o.email), 'Someone tried the wrong passcode 5 times', layout({
        circleLabel: circleLabel(circle), title: 'The circle is locked for 15 minutes',
        lines: ['Someone entered a wrong passcode 5 times. If it was not someone you know, change the passcode in Circle settings.'], urgent: true,
      }));
      return { ok: false as const, error: 'locked', locked: true };
    }
    return { ok: false as const, error: 'wrong_pass', left: 5 - circle.failed_attempts };
  }
  await q('update circles set failed_attempts = 0 where id = $1', [circle.id]);
  return { ok: true as const, circleId: circle.id };
}

/** Fixed-window limiter in Postgres (works across instances). */
export async function rateLimit(key: string, max: number, windowSeconds: number) {
  const [r] = await q<{ count: number }>(
    `insert into rate_limits (key, count, window_end) values ($1, 1, now() + ($2 || ' seconds')::interval)
     on conflict (key) do update set
       count = case when rate_limits.window_end < now() then 1 else rate_limits.count + 1 end,
       window_end = case when rate_limits.window_end < now() then now() + ($2 || ' seconds')::interval else rate_limits.window_end end
     returning count`, [key, String(windowSeconds)]);
  return r.count <= max;
}

export const tokenHash = sha256;
