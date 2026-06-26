-- GitHub App installations (Phase 1)
-- Run on existing projects that already have linked_repositories.

create table if not exists public.github_installations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  installation_id bigint not null unique,
  account_login text not null,
  account_type text not null check (account_type in ('User', 'Organization')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists github_installations_user_id_idx
  on public.github_installations (user_id);

alter table public.linked_repositories
  add column if not exists installation_id bigint;

create index if not exists linked_repositories_installation_id_idx
  on public.linked_repositories (installation_id);

alter table public.github_installations enable row level security;

create policy "User read github_installations"
  on public.github_installations for select
  to authenticated
  using (auth.uid() = user_id);

-- Writes go through service role (API routes) only.
