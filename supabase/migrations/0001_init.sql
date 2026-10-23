-- Applied to project euis-ticketing via the Supabase MCP (migration "init").
create table public.events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  event_date date not null,
  created_at timestamptz not null default now()
);

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  student_id text not null,
  name text not null,
  email text not null,
  dietary_requirements text not null,
  membership text not null,
  email_sent_at timestamptz,
  email_error text,
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index tickets_event_student_idx on public.tickets (event_id, student_id);

-- Only logged-in users (the shared committee login) can read/write.
-- Public sign-ups MUST be disabled in Auth settings for this to be safe.
alter table public.events enable row level security;
alter table public.tickets enable row level security;

create policy "authenticated full access" on public.events
  for all to authenticated using (true) with check (true);
create policy "authenticated full access" on public.tickets
  for all to authenticated using (true) with check (true);
