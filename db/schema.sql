-- CareCircle schema. Idempotent: safe to run more than once (npm run db:migrate).
-- Invariants live here, not only in application code.

create extension if not exists pgcrypto;

create table if not exists circles (
  id              uuid primary key default gen_random_uuid(),
  person_name     text not null check (length(person_name) between 1 and 80),
  call_name       text check (call_name is null or length(call_name) <= 40),
  person_email    text check (person_email is null or person_email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  code            text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  passcode_hash   text not null,
  failed_attempts int  not null default 0 check (failed_attempts >= 0),
  locked_until    timestamptz,
  consent_at      timestamptz,
  last_help_at    timestamptz,
  timezone        text not null default 'Asia/Kolkata',
  created_at      timestamptz not null default now()
);

create table if not exists members (
  id              uuid primary key default gen_random_uuid(),
  circle_id       uuid not null references circles(id) on delete cascade,
  name            text not null check (length(name) between 1 and 80),
  email           text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  relation        text check (relation is null or length(relation) <= 60),
  role            text not null check (role in ('family','caretaker')),
  is_organiser    boolean not null default false,
  status          text not null check (status in ('pending','active','declined','removed')),
  session_version int  not null default 1,
  email_prefs     jsonb not null default '{"upcoming":false,"waiting":true,"visits":true,"refills":true}',
  decided_by      text,
  decided_at      timestamptz,
  created_at      timestamptz not null default now(),
  check (not is_organiser or role = 'family')
);
create unique index if not exists members_one_live_email on members (circle_id, lower(email)) where status in ('pending','active');
create index if not exists members_circle on members (circle_id);

-- Phones of the person at the centre. Only a hash of the device token is stored.
create table if not exists person_devices (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references circles(id) on delete cascade,
  token_hash  text not null unique,
  created_at  timestamptz not null default now(),
  revoked_at  timestamptz
);
create index if not exists person_devices_circle on person_devices (circle_id);

create table if not exists setup_links (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references circles(id) on delete cascade,
  token_hash  text not null unique,
  expires_at  timestamptz not null,
  used_at     timestamptz,
  created_by  text not null,
  created_at  timestamptz not null default now()
);

-- One-time email codes for start, join and sign in.
create table if not exists otps (
  id          uuid primary key default gen_random_uuid(),
  purpose     text not null check (purpose in ('start','join','signin')),
  email       text not null,
  code_hash   text not null,
  payload     jsonb not null default '{}',
  attempts    int  not null default 0 check (attempts >= 0),
  expires_at  timestamptz not null,
  consumed_at timestamptz,
  created_at  timestamptz not null default now()
);

create table if not exists photos (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references circles(id) on delete cascade,
  mime       text not null check (mime = 'image/jpeg'),
  bytes      bytea not null check (octet_length(bytes) <= 1048576),
  created_at timestamptz not null default now()
);

create table if not exists medications (
  id               uuid primary key default gen_random_uuid(),
  circle_id        uuid not null references circles(id) on delete cascade,
  name             text not null check (length(name) between 1 and 80),
  purpose          text check (purpose is null or length(purpose) <= 80),
  n_morning        smallint not null default 0 check (n_morning between 0 and 4),
  n_afternoon      smallint not null default 0 check (n_afternoon between 0 and 4),
  n_night          smallint not null default 0 check (n_night between 0 and 4),
  t_morning        time not null default '08:00',
  t_afternoon      time not null default '13:00',
  t_night          time not null default '21:00',
  food             text not null default 'after' check (food in ('before','after','with','any')),
  importance       text not null default 'regular' check (importance in ('important','regular','supplement')),
  stock            int  not null default 0 check (stock >= 0),
  pill_photo_id    uuid references photos(id) on delete set null,
  strip_photo_id   uuid references photos(id) on delete set null,
  active           boolean not null default true,
  stopped_reason   text,
  refill_alerted_on date,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (n_morning + n_afternoon + n_night > 0)
);
create index if not exists medications_circle on medications (circle_id) where active;

create table if not exists doses (
  id             uuid primary key default gen_random_uuid(),
  circle_id      uuid not null references circles(id) on delete cascade,
  med_id         uuid not null references medications(id) on delete cascade,
  slot           text not null check (slot in ('morning','afternoon','night')),
  qty            smallint not null check (qty between 1 and 4),
  due_at         timestamptz not null,
  status         text not null default 'pending' check (status in ('pending','taken','skipped','missed')),
  reason         text check (reason is null or length(reason) <= 120),
  acted_by       text,
  acted_at       timestamptz,
  snoozed_until  timestamptz,
  notified_level smallint not null default 0 check (notified_level between 0 and 3),
  unique (med_id, due_at)
);
create index if not exists doses_open on doses (due_at) where status = 'pending';
create index if not exists doses_circle_due on doses (circle_id, due_at);

create table if not exists appointments (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references circles(id) on delete cascade,
  doctor      text not null check (length(doctor) between 1 and 80),
  location    text check (location is null or length(location) <= 120),
  at          timestamptz not null,
  notes       text check (notes is null or length(notes) <= 2000),
  reminded_at timestamptz,
  created_by  text not null,
  created_at  timestamptz not null default now()
);
create index if not exists appointments_circle on appointments (circle_id, at);

-- Changes the person at the centre must see and acknowledge.
create table if not exists change_notices (
  id         uuid primary key default gen_random_uuid(),
  circle_id  uuid not null references circles(id) on delete cascade,
  actor      text not null,
  summary    text not null,
  ack        text check (ack in ('ok','question')),
  ack_at     timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists activity (
  id        bigserial primary key,
  circle_id uuid not null references circles(id) on delete cascade,
  actor     text not null,
  action    text not null,
  at        timestamptz not null default now()
);
create index if not exists activity_circle on activity (circle_id, at desc);

-- One-time email action links (Mark as given). Only the hash of the token is stored.
create table if not exists email_actions (
  token_hash text primary key,
  circle_id  uuid not null references circles(id) on delete cascade,
  member_id  uuid not null references members(id) on delete cascade,
  dose_ids   uuid[] not null,
  expires_at timestamptz not null,
  used_at    timestamptz
);

-- Every email is written here first (outbox), then sent. Lets demos work without SMTP.
create table if not exists outbox (
  id         bigserial primary key,
  circle_id  uuid references circles(id) on delete cascade,
  to_addrs   text[] not null,
  subject    text not null,
  html       text not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  error      text
);

-- Per-IP attempt counters for sign-in and join (simple fixed window).
create table if not exists rate_limits (
  key        text primary key,
  count      int not null,
  window_end timestamptz not null
);

-- v2: one active medicine per name per circle. Older duplicates are stopped (history kept).
update medications m set active = false, stopped_reason = 'Duplicate entry'
 where m.active and exists (select 1 from medications o where o.circle_id = m.circle_id and o.active
   and lower(o.name) = lower(m.name) and (o.created_at, o.id) < (m.created_at, m.id));
delete from doses d using medications m where d.med_id = m.id and not m.active and d.status = 'pending';
create unique index if not exists medications_one_active_name on medications (circle_id, lower(name)) where active;

-- v2: Help presses shown inside the app until someone responds.
create table if not exists help_requests (
  id          uuid primary key default gen_random_uuid(),
  circle_id   uuid not null references circles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  handled_at  timestamptz,
  handled_by  text check (handled_by is null or length(handled_by) <= 80),
  check ((handled_at is null) = (handled_by is null))
);
create index if not exists help_open on help_requests (circle_id) where handled_at is null;
