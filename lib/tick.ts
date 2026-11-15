import 'server-only';
import { q, log } from './db';
import { ensureDoses, recipients, circleLabel, displayName, FOOD_LABEL } from './domain';
import { sendMail, layout, esc, APP_URL } from './mail';
import { randomToken, sha256 } from './crypto';
import { fmtTime, fmtDateTime, localDate, SLOT_LABEL, type Slot } from './time';

type Row = {
  id: string; circle_id: string; slot: Slot; qty: number; due_at: string; snoozed_until: string | null; notified_level: number;
  name: string; importance: string; food: keyof typeof FOOD_LABEL;
  person_name: string; call_name: string | null; person_email: string | null;
};
const MIN = 60_000;

/** Atomically raise the level on doses still open below it. Only the caller that wins sends the email. */
async function claim(ids: string[], level: number) {
  const rows = await q<{ id: string }>(
    `update doses set notified_level = $2 where id = any($1::uuid[]) and notified_level < $2 and status = 'pending' returning id`, [ids, level]);
  return rows.map((r) => r.id);
}

async function actionLink(circleId: string, memberId: string, doseIds: string[]) {
  const token = randomToken();
  await q(`insert into email_actions (token_hash, circle_id, member_id, dose_ids, expires_at) values ($1,$2,$3,$4, now() + interval '12 hours')`,
    [sha256(token), circleId, memberId, doseIds]);
  return `${APP_URL}/a/${token}`;
}

/** The escalation engine. Safe to run any number of times, concurrently. Returns emails sent. */
export async function runTick(onlyCircle?: string): Promise<number> {
  const started = Date.now();
  let sent = 0;
  await ensureDoses(onlyCircle);
  const now = Date.now();
  const rows = await q<Row>(
    `select d.id, d.circle_id, d.slot, d.qty, d.due_at, d.snoozed_until, d.notified_level, m.name, m.importance, m.food,
            c.person_name, c.call_name, c.person_email
     from doses d join medications m on m.id = d.med_id join circles c on c.id = d.circle_id
     where d.status = 'pending' and d.due_at between now() - interval '4 hours' and now() + interval '15 minutes'
     ${onlyCircle ? 'and d.circle_id = $1' : ''} order by d.due_at`, onlyCircle ? [onlyCircle] : []);

  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const k = `${r.circle_id}|${r.due_at}`;
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }

  for (const doses of groups.values()) {
    const c = doses[0];
    const label = circleLabel(c);
    const who = esc(displayName(c));
    const slot = SLOT_LABEL[c.slot];
    const due = new Date(c.due_at).getTime();
    const list = (ds: Row[]) => ds.map((d) => `<b>${esc(d.name)}</b>: take ${d.qty}, ${FOOD_LABEL[d.food].toLowerCase()}`).join('<br>');

    // Stage 0: upcoming, 15 minutes before
    if (now >= due - 15 * MIN) {
      const ids = await claim(doses.filter((d) => d.notified_level < 1).map((d) => d.id), 1);
      if (ids.length) {
        const members = (await recipients(c.circle_id, 'all')).filter((m) => m.email_prefs?.upcoming);
        const to = [c.person_email, ...members.map((m) => m.email)];
        if (await sendMail(c.circle_id, to, `${slot} medicines at ${fmtTime(c.due_at)}`, layout({
          circleLabel: label, title: `${slot} medicines in 15 minutes`, lines: [list(doses)],
          buttons: [{ label: 'Open my medicines', href: `${APP_URL}/p`, tone: 'go' }],
        }))) sent++;
      }
    }

    const late = (d: Row) => (now - Math.max(due, d.snoozed_until ? new Date(d.snoozed_until).getTime() : 0)) / MIN;

    // Stage 1: not confirmed for 30 minutes → caretakers (family if there is no caretaker). Supplements never escalate.
    const s1 = await claim(doses.filter((d) => d.importance !== 'supplement' && d.notified_level < 2 && late(d) >= 30).map((d) => d.id), 2);
    if (s1.length) {
      const ds = doses.filter((d) => s1.includes(d.id));
      let to = await recipients(c.circle_id, 'caretakers');
      if (!to.length) to = await recipients(c.circle_id, 'family');
      for (const m of to.filter((m) => m.email_prefs?.waiting !== false)) {
        const href = await actionLink(c.circle_id, m.id, s1);
        if (await sendMail(c.circle_id, [m.email], `${displayName(c)}'s ${slot.toLowerCase()} medicines are not confirmed`, layout({
          circleLabel: label, title: `${slot} medicines, due ${fmtTime(c.due_at)}, not confirmed for 30 minutes`,
          lines: [list(ds), `If you gave them, confirm below. The whole family is emailed only if an important medicine waits 1 hour.`],
          buttons: [{ label: 'Mark as given', href, tone: 'go' }, { label: 'Open today', href: `${APP_URL}/app`, tone: 'out' }],
        }))) sent++;
      }
    }

    // Stage 2: important and not confirmed for 60 minutes → everyone
    const s2 = await claim(doses.filter((d) => d.importance === 'important' && d.notified_level < 3 && late(d) >= 60).map((d) => d.id), 3);
    if (s2.length) {
      const ds = doses.filter((d) => s2.includes(d.id));
      for (const m of await recipients(c.circle_id, 'all')) {
        const href = await actionLink(c.circle_id, m.id, s2);
        if (await sendMail(c.circle_id, [m.email], `Important: ${who}'s medicine not taken for 1 hour`, layout({
          circleLabel: label, title: `Important medicine, due ${fmtTime(c.due_at)}, still not confirmed`, urgent: true,
          lines: [list(ds), `Please call ${who} or the caretaker.`],
          buttons: [{ label: 'Mark as given', href, tone: 'go' }],
        }))) sent++;
      }
    }

    // After 3 hours the dose is recorded as missed.
    await q(`update doses set status = 'missed' where id = any($1::uuid[]) and status = 'pending' and due_at < now() - interval '3 hours'`, [doses.map((d) => d.id)]);
  }

  // Doctor visits within 24 hours
  const visits = await q<{ id: string; circle_id: string; doctor: string; location: string | null; at: string; person_name: string; call_name: string | null; person_email: string | null }>(
    `update appointments a set reminded_at = now() from circles c
     where c.id = a.circle_id and a.reminded_at is null and a.at between now() and now() + interval '24 hours' ${onlyCircle ? 'and a.circle_id = $1' : ''}
     returning a.id, a.circle_id, a.doctor, a.location, a.at, c.person_name, c.call_name, c.person_email`, onlyCircle ? [onlyCircle] : []);
  for (const v of visits) {
    const members = (await recipients(v.circle_id, 'all')).filter((m) => m.email_prefs?.visits !== false);
    if (await sendMail(v.circle_id, [v.person_email, ...members.map((m) => m.email)], `${displayName(v)} sees ${v.doctor} on ${fmtDateTime(v.at)}`, layout({
      circleLabel: circleLabel(v), title: `${esc(v.doctor)}, ${esc(fmtDateTime(v.at))}`,
      lines: [`${v.location ? esc(v.location) + '. ' : ''}The visit sheet is ready: medicines, 30-day record and reasons for skipped doses.`],
      buttons: [{ label: 'Open visit sheet', href: `${APP_URL}/app/visits/${v.id}`, tone: 'ink' }],
    }))) sent++;
  }

  // Refills: 5 days or fewer, once a day per medicine
  const today = localDate();
  const low = await q<{ id: string; circle_id: string; name: string; stock: number; per_day: number; person_name: string; call_name: string | null }>(
    `update medications m set refill_alerted_on = $1 from circles c
     where c.id = m.circle_id and m.active and (m.n_morning + m.n_afternoon + m.n_night) > 0
       and m.stock / (m.n_morning + m.n_afternoon + m.n_night) <= 5 and m.refill_alerted_on is distinct from $1::date ${onlyCircle ? 'and m.circle_id = $2' : ''}
     returning m.id, m.circle_id, m.name, m.stock, (m.n_morning + m.n_afternoon + m.n_night) as per_day, c.person_name, c.call_name`,
    onlyCircle ? [today, onlyCircle] : [today]);
  for (const m of low) {
    const members = (await recipients(m.circle_id, 'all')).filter((x) => x.email_prefs?.refills !== false);
    const days = Math.floor(m.stock / m.per_day);
    if (await sendMail(m.circle_id, members.map((x) => x.email), `Refill needed: ${m.name}, ${days} days left`, layout({
      circleLabel: circleLabel(m), title: `Time to refill ${esc(m.name)}`,
      lines: [`${m.stock} left, about ${days} day${days === 1 ? '' : 's'} at the current dose.`],
      buttons: [{ label: 'Open medicine', href: `${APP_URL}/app/medicines/${m.id}`, tone: 'out' }],
    }))) sent++;
  }

  log('tick.done', { circle: onlyCircle ?? 'all', groups: groups.size, sent, ms: Date.now() - started });
  return sent;
}
