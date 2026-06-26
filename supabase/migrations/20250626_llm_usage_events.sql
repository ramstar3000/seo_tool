-- Apply on existing Supabase projects that already ran schema.sql before llm_usage_events existed.
-- New projects: use supabase/schema.sql (includes this table).

create table if not exists public.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('gemini', 'anthropic')),
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_usd numeric(12, 6) not null default 0,
  created_at timestamptz default now()
);

create index if not exists llm_usage_events_created_at_idx
  on public.llm_usage_events (created_at desc);

alter table public.llm_usage_events enable row level security;
-- No anon/authenticated policies: inserts/reads use service role only.
