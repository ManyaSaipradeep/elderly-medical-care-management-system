# CareCircle

**One simple screen for the care recipient. Everyone who cares stays in the loop.**

CareCircle is an elderly care and medication management web app built for the PromptWars x Catalyst hackathon by Makers Need More (MnM). The person taking the medicines sees photos of their own pills and what to take now. Family and caretakers manage schedules, track adherence and visits, and are emailed only when a dose is really missed.

## The problem

Most reminder apps assume the person taking the medicines will set them up, read the alerts and tell look-alike tablets apart by name. In real families, a son in another city phones three times a day to ask "did you take it?", and nobody notices the strip running out. Studies of long-term conditions find only about half of patients take medicines as prescribed (WHO, 2003).

## What it does

| For | Feature |
|---|---|
| The care recipient | A private screen opened once with a **one-time setup link** and a **consent screen** listing who can see their medicines. **Photo pill cards** (the family's own photo of the pill *and* its strip), "Take 1 now", food timing, and three big buttons: **I took it**, **Later** (15 min), **Not today** (with their own reason). Read aloud, **Help** (asks the family to call), **My day**, and **My people**, where they **approve or refuse join requests** and remove anyone. Every medicine change appears on their screen with **OK / I have a question**. |
| Caretakers | Today by morning, afternoon and night with **Given / Skipped (reason) / Undo**, last 14 days, next doctor visit, refill warnings, the person's own reasons for skipping, medicines with photos, visits and visit sheets. |
| Family | Everything above plus **People** (approve requests, organisers, remove), **Settings** (passcode, setup link, delete circle) and **Run reminders now**. |
| Everyone | **Two-stage escalation**: reminder 15 min before; caretaker email after 30 min with a one-tap **Mark as given**; whole circle after 60 min for important medicines only; supplements never escalate; any confirmation stops it. **Doctor visit sheet** (printable) linked from the appointment reminder email. **Refill countdown** (stock falls with each confirmed dose; email at 5 days left). |

Works on phones (bottom menu), tablets and computers (side menu), keyboard accessible, Atkinson Hyperlegible type, colours chosen for ageing eyes (no blue/green distinctions, AA/AAA contrast, never colour alone).

## Architecture

```
 Person's phone ── /p (device cookie) ─────┐
 Family / caretaker ── /app (signed cookie) ┼──▶ Next.js 15 (server actions) ──▶ Postgres
 Email button ── /a/[token] (confirm page) ─┘            │                      (data + photos)
                                                         └──▶ Gmail SMTP (outbox table first)
 Cloud Scheduler / cron-job.org ── every 5 min ──▶ POST /api/cron/tick (x-cron-secret)
```

- **Postgres enforces the rules**: `unique(med_id, due_at)` makes dose creation idempotent; CHECK constraints on every enum and range; one live membership per email per circle.
- **Escalation is safe to run concurrently**: each email is sent only after an atomic `UPDATE ... WHERE notified_level < n AND status = 'pending' RETURNING`, so overlapping runs never double-send, and any confirmation ends the ladder.
- **Outbox**: every email is stored before sending. With no SMTP configured the app still works, and organisers can read emails at **Settings → Outbox** (demo mode).

## Security

- Every server action loads the signed-in member and scopes every query by their `circle_id`; ids from the browser are never trusted. Caretakers cannot open People or Settings.
- Join = circle code + 6-digit passcode (bcrypt) + emailed one-time code + **approval** by the care recipient or a family organiser. Sign in again = code + passcode + emailed code.
- 5 wrong passcodes lock the circle for 15 min and email organisers; per-IP limits on start, join and sign in.
- The person's phone uses a random device token stored only as a SHA-256 hash; a new setup link revokes older phones. Setup links and email action links are single-use and expire (24 h / 12 h). Opening an email link never records anything; only the confirm button does.
- Removing a member bumps their session version, signing them out everywhere.
- Photos: type checked by decoding (JPEG/PNG/WebP), 5 MB limit, re-encoded with sharp (drops EXIF, including GPS), stored privately, served only to that circle.
- Emails escape every user value. Security headers (CSP, frame-ancestors none, nosniff). Secrets only in environment variables.

Known limits: one shared passcode for the circle (individual logins are future work); a tap confirms a dose but cannot prove it was swallowed; reminders can be up to 5 minutes late; email only (SMS in India needs DLT registration).

## Run locally

```bash
cp .env.example .env.local        # set DATABASE_URL and SESSION_SECRET
npm install
DATABASE_URL=... npm run db:migrate
DATABASE_URL=... npm run db:seed  # optional demo circle with 14 days of history
npm run dev
```

## Demo mode (how the live demo runs)

The hosted demo runs **without an email account**, on purpose. With `DEMO_OUTBOX=1` and no Gmail credentials:

- **Every email is still created** (reminders, escalations, Help requests, join approvals, medicine changes, visit and refill notices) and stored in the `outbox` table.
- Organisers can read them all at **Settings → Outbox**, so you can see exactly who would be emailed, when and why.
- **Sign-in and join codes appear on screen**, labelled "Demo mode", instead of arriving by email.
- **Help requests** and join requests also show **inside the app**, so the core alerts work without email.

This is for evaluation only, with sample data. Because codes show on screen, anyone with the circle code and passcode can sign in. For real use, set `GMAIL_USER` and `GMAIL_APP_PASSWORD` (a Google app password): codes are then sent only by email and never shown. Set `DEMO_OUTBOX=0` to hide the Outbox page.

## Deploy

**Vercel + Supabase (what this project uses)**
1. In Supabase, open **Connect → Connection string → Transaction pooler** (port 6543) and add `?sslmode=require` to the end. Run `npm run db:migrate` (and optionally `npm run db:seed`) with it as `DATABASE_URL`.
2. Import the repo in Vercel and set `DATABASE_URL`, `SESSION_SECRET` (32+ random characters), `CRON_SECRET`, `APP_URL` (your Vercel URL, no trailing slash) and `DEMO_OUTBOX=1`. Add `GMAIL_USER` and `GMAIL_APP_PASSWORD` only if you want real emails.
3. Vercel's free cron runs only once a day, so create a cron-job.org job: `POST https://YOUR-APP/api/cron/tick` every 5 minutes with header `x-cron-secret: <CRON_SECRET>`.

**Google Cloud Run**
```bash
gcloud run deploy carecircle --source . --region asia-south1 --allow-unauthenticated \
  --set-env-vars DATABASE_URL=...,SESSION_SECRET=...,CRON_SECRET=...,APP_URL=...,GMAIL_USER=...,GMAIL_APP_PASSWORD=...
gcloud scheduler jobs create http carecircle-tick --location asia-south1 --schedule "*/5 * * * *" \
  --uri https://YOUR-URL/api/cron/tick --http-method POST --headers x-cron-secret=YOUR_CRON_SECRET
```

Health check: `GET /api/health`.

## Project layout

```
app/               pages and server actions (/, /start, /join, /signin, /setup/[token], /p, /app/*, /a/[token])
app/api/           cron tick and health check
lib/               db, sessions, crypto, domain logic, escalation engine, email, photo pipeline
components/        UI building blocks (pill cards, dose rows, 14-day grid, layouts)
db/schema.sql      schema with constraints (idempotent)
scripts/           migrate and seed
```
