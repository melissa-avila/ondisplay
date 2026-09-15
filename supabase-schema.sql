-- Pulse — Supabase schema
-- Paste this whole file into Supabase -> SQL Editor -> New query -> Run.

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  name         text        not null default 'Untitled session',
  code         text        not null unique,
  questions    jsonb       not null default '[]'::jsonb,
  active_index int         not null default 0,
  created_at   timestamptz not null default now()
);

create table if not exists participants (
  id         uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),
  unique (session_id, name)
);

create table if not exists responses (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  question_id text not null,
  name        text not null,
  body        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists responses_session_idx on responses (session_id, created_at);

alter table sessions     enable row level security;
alter table participants enable row level security;
alter table responses    enable row level security;

-- Open access with the anon key. Anyone who has your Pages URL can read and write.
-- Fine for an internal research session; do not put confidential data here.
drop policy if exists sessions_all on sessions;
create policy sessions_all on sessions
  for all to anon using (true) with check (true);

drop policy if exists participants_all on participants;
create policy participants_all on participants
  for all to anon using (true) with check (true);

drop policy if exists responses_all on responses;
create policy responses_all on responses
  for all to anon using (true) with check (true);
