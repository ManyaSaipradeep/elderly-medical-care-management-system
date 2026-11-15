import 'server-only';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { one, q } from './db';
import { seal, unseal, sha256, randomToken } from './crypto';

const SECURE = process.env.NODE_ENV === 'production';
const base = { httpOnly: true, sameSite: 'lax' as const, secure: SECURE, path: '/' };

export type Member = {
  id: string; circle_id: string; name: string; email: string; relation: string | null;
  role: 'family' | 'caretaker'; is_organiser: boolean; status: string; session_version: number;
  email_prefs: Record<string, boolean>;
};
export type Circle = {
  id: string; person_name: string; call_name: string | null; person_email: string | null; code: string;
  failed_attempts: number; locked_until: string | null; consent_at: string | null; last_help_at: string | null;
};

// ---------- member sessions (family and caretakers) ----------
export async function startMemberSession(m: { id: string; session_version: number }) {
  (await cookies()).set('cc_m', seal({ m: m.id, v: m.session_version }, 60 * 60 * 24 * 30), { ...base, maxAge: 60 * 60 * 24 * 30 });
}
export async function endMemberSession() {
  (await cookies()).delete('cc_m');
}
/** The signed-in member, or null. Removed members and bumped session versions are rejected. */
export async function currentMember(): Promise<{ member: Member; circle: Circle } | null> {
  const s = unseal<{ m: string; v: number }>((await cookies()).get('cc_m')?.value);
  if (!s) return null;
  const member = await one<Member>(`select * from members where id = $1 and status = 'active'`, [s.m]);
  if (!member || member.session_version !== s.v) return null;
  const circle = await one<Circle>('select * from circles where id = $1', [member.circle_id]);
  return circle ? { member, circle } : null;
}
export async function requireMember(opts: { organiser?: boolean; family?: boolean } = {}) {
  const ctx = await currentMember();
  if (!ctx) redirect('/signin?expired=1');
  if (opts.organiser && !ctx.member.is_organiser) redirect('/app?denied=1');
  if (opts.family && ctx.member.role !== 'family') redirect('/app?denied=1');
  return ctx;
}
export const actorName = (m: Member) => `${m.name} (${m.role === 'family' ? 'family' : 'caretaker'})`;

// ---------- the person at the centre: device sessions ----------
export async function createPersonDevice(circleId: string) {
  const token = randomToken();
  await q('insert into person_devices (circle_id, token_hash) values ($1,$2)', [circleId, sha256(token)]);
  (await cookies()).set('cc_p', token, { ...base, maxAge: 60 * 60 * 24 * 365 });
}
export async function currentPerson(): Promise<Circle | null> {
  const token = (await cookies()).get('cc_p')?.value;
  if (!token) return null;
  return one<Circle>(
    `select c.* from person_devices d join circles c on c.id = d.circle_id
     where d.token_hash = $1 and d.revoked_at is null`, [sha256(token)]);
}

// ---------- short-lived flow tickets (between steps of join / sign in / start) ----------
export async function setTicket(name: string, data: object, ttl = 30 * 60) {
  (await cookies()).set(`cc_t_${name}`, seal(data, ttl), { ...base, maxAge: ttl });
}
export async function getTicket<T>(name: string) {
  return unseal<T>((await cookies()).get(`cc_t_${name}`)?.value);
}
export async function clearTicket(name: string) {
  (await cookies()).delete(`cc_t_${name}`);
}

export async function clientIp() {
  const h = await headers();
  // Prefer the platform-set header; otherwise the last hop added by the closest proxy (not client-controlled).
  const xff = (h.get('x-forwarded-for') || '').split(',').map((x) => x.trim()).filter(Boolean);
  return h.get('x-real-ip') || xff[xff.length - 1] || 'local';
}
