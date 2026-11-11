-- Run this once in Supabase: SQL Editor > New query > paste > Run

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  account_size numeric not null check (account_size > 0),
  growth_target numeric not null,        -- fraction, 0.02 = 2%
  consistency_limit numeric not null,    -- fraction, 0.4 = 40%
  reward_share numeric not null,         -- fraction, 0.9 = 90%
  created_at timestamptz not null default now()
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.accounts(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  day_no int not null,
  trade_date date,
  pnl numeric not null default 0,
  notes text,
  unique (account_id, day_no)
);

alter table public.accounts enable row level security;
alter table public.entries  enable row level security;

create policy "own accounts" on public.accounts
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "own entries" on public.entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
