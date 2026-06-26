-- Unified API usage tracking (all paid external APIs; service-role writes only).
-- Apply on existing Supabase projects. New projects: use supabase/schema.sql.

create table if not exists public.api_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  operation text not null,
  units numeric(12, 4) not null default 1,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_usd numeric(12, 6) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz default now()
);

create index if not exists api_usage_events_created_at_idx
  on public.api_usage_events (created_at desc);

create index if not exists api_usage_events_provider_idx
  on public.api_usage_events (provider);

alter table public.api_usage_events enable row level security;
-- No anon/authenticated policies: inserts/reads use service role only.
