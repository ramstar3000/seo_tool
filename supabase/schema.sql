-- Run this entire file on a fresh Supabase project. No migrations needed.
-- SynapseCRO Database Schema

-- 1. Dynamic Website Content
create table public.site_copy (
  id text primary key,
  text_content text not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

insert into public.site_copy (id, text_content) values
  ('hero_title', 'Rank higher. Get more visits.'),
  ('hero_subtitle', 'We improve your SEO and landing page so you show up in search and turn visits into enquiries.'),
  ('cta_text', 'Get a free audit');

-- 2. User Activity Log (Sensory Input)
create table public.analytics_events (
  id uuid default gen_random_uuid() primary key,
  event_type text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);


-- LLM usage tracking (Gemini spend cap; service-role writes only)
create table public.llm_usage_events (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  model text not null,
  input_tokens int not null default 0,
  output_tokens int not null default 0,
  estimated_usd numeric(12, 6) not null default 0,
  created_at timestamptz default now()
);

create index llm_usage_events_created_at_idx on public.llm_usage_events (created_at desc);

-- Unified API usage tracking (all paid external APIs; service-role writes only)
create table public.api_usage_events (
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

create index api_usage_events_created_at_idx on public.api_usage_events (created_at desc);
create index api_usage_events_provider_idx on public.api_usage_events (provider);

-- 3. Agent Cognitive Log (Dashboard Stream)
create table public.agent_brain_logs (
  id uuid default gen_random_uuid() primary key,
  thought_process text not null,
  action_taken text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. London Lead Pipeline
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  business_name text not null,
  category text,
  location text default 'London',
  keyword text not null,
  rank_position int not null check (rank_position in (3, 4)),
  website_url text,
  google_maps_url text,
  phone text,
  address text,
  lead_score int default 70,
  status text default 'new' check (status in ('new', 'contacted', 'qualified', 'converted', 'dismissed')),
  notes text,
  recommendation text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index leads_business_keyword_unique
  on public.leads (business_name, keyword);

create table public.lead_discovery_runs (
  id uuid primary key default gen_random_uuid(),
  keywords_searched text[] not null,
  leads_found int default 0,
  status text default 'completed',
  error_message text,
  created_at timestamptz default now()
);

-- 5. Research Agent Audits
create table public.site_audits (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete set null,
  target_url text not null,
  keyword text not null,
  business_name text not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  summary text,
  recommendations text,
  tool_trace jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  completed_at timestamptz
);

alter table public.leads
  add column last_audit_id uuid references public.site_audits(id) on delete set null;

create table public.audit_competitors (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.site_audits(id) on delete cascade,
  rank_position int not null,
  business_name text not null,
  url text not null,
  title text not null,
  snippet text
);

create table public.audit_pages (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.site_audits(id) on delete cascade,
  url text not null,
  is_target boolean default false,
  page_type text default 'unknown',
  seo_json jsonb not null,
  scraped_at timestamptz default now()
);

create table public.audit_findings (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.site_audits(id) on delete cascade,
  severity text not null check (severity in ('critical', 'warning', 'info')),
  category text not null check (category in ('seo', 'messaging', 'cro', 'technical', 'competitive', 'social')),
  title text not null,
  description text not null,
  evidence jsonb
);

create table public.audit_social_profiles (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.site_audits(id) on delete cascade,
  platform_id text not null,
  profile_url text,
  bio_text text,
  seo_json jsonb,
  found_via text check (found_via in ('serp', 'website_link')),
  status text not null default 'not_searched' check (status in ('found', 'missing', 'not_searched', 'error'))
);

create index site_audits_lead_id_idx on public.site_audits (lead_id);
create index site_audits_created_at_idx on public.site_audits (created_at desc);
create index audit_competitors_audit_id_idx on public.audit_competitors (audit_id);
create index audit_pages_audit_id_idx on public.audit_pages (audit_id);
create index audit_findings_audit_id_idx on public.audit_findings (audit_id);
create index audit_social_profiles_audit_id_idx on public.audit_social_profiles (audit_id);

-- 6. Linked GitHub Repositories & PR Change Runs
create table public.linked_repositories (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid references public.leads(id) on delete cascade,
  audit_id uuid references public.site_audits(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  label text,
  github_owner text not null,
  github_repo text not null,
  default_branch text default 'main',
  repo_url text not null,
  content_paths jsonb default '[]'::jsonb,
  created_at timestamptz default now()
);

create table public.repo_change_runs (
  id uuid primary key default gen_random_uuid(),
  repository_id uuid not null references public.linked_repositories(id) on delete cascade,
  audit_id uuid references public.site_audits(id),
  status text default 'pending' check (status in ('pending', 'completed', 'failed')),
  pr_url text,
  pr_number int,
  branch_name text,
  change_summary text,
  files_changed jsonb,
  error_message text,
  created_at timestamptz default now()
);

-- 7. Visitor free audit requests
create table public.audit_requests (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  website_url text not null,
  business_name text,
  status text default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  site_audit_id uuid references public.site_audits(id) on delete set null,
  lead_id uuid references public.leads(id) on delete set null,
  report_summary text,
  error_message text,
  created_at timestamptz default now()
);

create index audit_requests_created_at_idx on public.audit_requests (created_at desc);
create index audit_requests_site_audit_id_idx on public.audit_requests (site_audit_id);
create index audit_requests_lead_id_idx on public.audit_requests (lead_id);

create index leads_last_audit_id_idx on public.leads (last_audit_id);
create index linked_repositories_lead_id_idx on public.linked_repositories (lead_id);
create index linked_repositories_audit_id_idx on public.linked_repositories (audit_id);
create index linked_repositories_user_id_idx on public.linked_repositories (user_id);
create index repo_change_runs_repository_id_idx on public.repo_change_runs (repository_id);
create index repo_change_runs_audit_id_idx on public.repo_change_runs (audit_id);

-- Row Level Security
alter table public.site_copy enable row level security;
alter table public.analytics_events enable row level security;
alter table public.llm_usage_events enable row level security;
alter table public.api_usage_events enable row level security;
alter table public.agent_brain_logs enable row level security;
alter table public.leads enable row level security;
alter table public.lead_discovery_runs enable row level security;
alter table public.site_audits enable row level security;
alter table public.audit_competitors enable row level security;
alter table public.audit_pages enable row level security;
alter table public.audit_findings enable row level security;
alter table public.audit_social_profiles enable row level security;
alter table public.linked_repositories enable row level security;
alter table public.repo_change_runs enable row level security;
alter table public.audit_requests enable row level security;

create policy "Public read site_copy"
  on public.site_copy for select
  to anon, authenticated
  using (true);

-- Analytics writes go through POST /api/analytics (service role) only.

create policy "Public read analytics_events"
  on public.analytics_events for select
  to anon, authenticated
  using (true);

create policy "Public read agent_brain_logs"
  on public.agent_brain_logs for select
  to anon, authenticated
  using (true);

create policy "Public read leads"
  on public.leads for select
  to anon, authenticated
  using (true);

create policy "Public read lead_discovery_runs"
  on public.lead_discovery_runs for select
  to anon, authenticated
  using (true);

create policy "Public read site_audits"
  on public.site_audits for select
  to anon, authenticated
  using (true);

create policy "Public read audit_competitors"
  on public.audit_competitors for select
  to anon, authenticated
  using (true);

create policy "Public read audit_pages"
  on public.audit_pages for select
  to anon, authenticated
  using (true);

create policy "Public read audit_findings"
  on public.audit_findings for select
  to anon, authenticated
  using (true);

create policy "Public read audit_social_profiles"
  on public.audit_social_profiles for select
  to anon, authenticated
  using (true);

create policy "User read linked_repositories"
  on public.linked_repositories for select
  to authenticated
  using (auth.uid() = user_id or user_id is null);

create policy "User insert linked_repositories"
  on public.linked_repositories for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "User update linked_repositories"
  on public.linked_repositories for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "User delete linked_repositories"
  on public.linked_repositories for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "User read repo_change_runs"
  on public.repo_change_runs for select
  to authenticated
  using (
    exists (
      select 1 from public.linked_repositories lr
      where lr.id = repository_id
      and (lr.user_id = auth.uid() or lr.user_id is null)
    )
  );

create policy "Anon insert audit_requests"
  on public.audit_requests for insert
  to anon, authenticated
  with check (email is not null and length(trim(email)) > 0);

-- Supabase Realtime
alter publication supabase_realtime add table public.site_copy;
alter publication supabase_realtime add table public.analytics_events;
alter publication supabase_realtime add table public.agent_brain_logs;
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.site_audits;

-- Leads are seeded via Run Discovery on /leads (not SQL).
