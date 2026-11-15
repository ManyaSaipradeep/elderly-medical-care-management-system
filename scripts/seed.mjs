// Creates a demo circle with three medicines, 14 days of history and a visit tomorrow.
// Prints the circle code, passcode and a one-time setup link. Usage: npm run db:seed
import pg from 'pg';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';

const url = process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const appUrl = (process.env.APP_URL || 'http://localhost:3000').replace(/\/$/, '');
const db = new pg.Client({ connectionString: url, ssl: /sslmode=require/.test(url) ? { rejectUnauthorized: false } : undefined });
await db.connect();

const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const code = Array.from(crypto.randomBytes(6), (b) => ALPHA[b % ALPHA.length]).join('');
const passcode = String(crypto.randomInt(100000, 999999));
const email = process.env.SEED_EMAIL || 'organiser@example.com';
const ist = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d);
const at = (date, hhmm) => new Date(`${date}T${hhmm}:00+05:30`);

const { rows: [c] } = await db.query(
  `insert into circles (person_name, call_name, code, passcode_hash, consent_at) values ($1,$2,$3,$4, now()) returning id`,
  ['Demo Person', null, code, await bcrypt.hash(passcode, 10)]);
await db.query(`insert into members (circle_id, name, email, relation, role, is_organiser, status, decided_by, decided_at)
  values ($1,'Demo Organiser',$2,'family','family',true,'active','seed',now())`, [c.id, email]);

const meds = [
  ['Amlodipine 5 mg', 'for blood pressure', 1, 0, 0, 'any', 'important', 4],
  ['Metformin 500 mg', 'for sugar', 1, 0, 1, 'after', 'important', 40],
  ['Calcium + Vitamin D3', 'for bones', 0, 2, 0, 'after', 'supplement', 30],
];
const ids = [];
for (const [name, purpose, m, a, n, food, imp, stock] of meds) {
  const { rows: [r] } = await db.query(
    `insert into medications (circle_id, name, purpose, n_morning, n_afternoon, n_night, food, importance, stock, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() - interval '20 days') returning id`, [c.id, name, purpose, m, a, n, food, imp, stock]);
  ids.push([r.id, m, a, n]);
}
// 14 days of history: mostly taken, a few skips with reasons, one missed.
const reasons = ['I feel unwell', "I don't want to take them today"];
for (let day = 14; day >= 1; day--) {
  const date = ist(new Date(Date.now() - day * 86400000));
  for (const [id, m, a, n] of ids) {
    for (const [slot, qty, t] of [['morning', m, '08:00'], ['afternoon', a, '13:00'], ['night', n, '21:00']]) {
      if (!qty) continue;
      const r = Math.random();
      const status = r < 0.86 ? 'taken' : r < 0.95 ? 'skipped' : 'missed';
      await db.query(`insert into doses (circle_id, med_id, slot, qty, due_at, status, reason, acted_by, acted_at)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict do nothing`,
        [c.id, id, slot, qty, at(date, t), status, status === 'skipped' ? reasons[Math.floor(Math.random() * 2)] : null,
         status === 'missed' ? null : 'Demo Person', status === 'missed' ? null : at(date, t)]);
    }
  }
}
const tomorrow = ist(new Date(Date.now() + 86400000));
await db.query(`insert into appointments (circle_id, doctor, location, at, notes, created_by) values ($1,$2,$3,$4,$5,'seed')`,
  [c.id, 'Cardiology review', 'City clinic', at(tomorrow, '10:30'), 'Dizzy on some mornings since last week. Could it be the BP tablet?']);
const token = crypto.randomBytes(32).toString('base64url');
await db.query(`insert into setup_links (circle_id, token_hash, expires_at, created_by) values ($1,$2, now() + interval '24 hours','Demo Organiser')`,
  [c.id, crypto.createHash('sha256').update(token).digest('hex')]);
await db.end();
console.log(`\nDemo circle ready\n  Circle code: ${code}\n  Passcode:    ${passcode}\n  Organiser:   ${email} (sign in at ${appUrl}/signin)\n  Person's setup link (one use, 24 h): ${appUrl}/setup/${token}\n`);
