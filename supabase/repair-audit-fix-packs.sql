-- Safe to run multiple times (half-applied / duplicate-run recovery)
-- Supabase SQL Editor: https://supabase.com/dashboard/project/gvrnvybxqqzfmzzulods/sql/new

-- ── 1. Check current state (read results in the output panel) ───────────────
select
  exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'audit_fix_packs'
  ) as table_exists,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'audit_fix_packs_audit_id_idx'
  ) as index_exists,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_fix_packs'
      and policyname = 'Public read audit_fix_packs'
  ) as policy_exists,
  coalesce(
    (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'audit_fix_packs'),
    false
  ) as rls_enabled;

-- ── 2. Repair (idempotent) ──────────────────────────────────────────────────
create table if not exists public.audit_fix_packs (
  id uuid primary key default gen_random_uuid(),
  audit_id uuid not null references public.site_audits(id) on delete cascade unique,
  platform_id text not null,
  platform_label text not null,
  pack_json jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  error_message text,
  created_at timestamptz default now()
);

create index if not exists audit_fix_packs_audit_id_idx
  on public.audit_fix_packs (audit_id);

alter table public.audit_fix_packs enable row level security;

drop policy if exists "Public read audit_fix_packs" on public.audit_fix_packs;

create policy "Public read audit_fix_packs"
  on public.audit_fix_packs for select
  to anon, authenticated
  using (true);

-- ── 3. Confirm (all four columns should be true) ─────────────────────────────
select
  exists (
    select 1 from pg_tables
    where schemaname = 'public' and tablename = 'audit_fix_packs'
  ) as table_ok,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'audit_fix_packs_audit_id_idx'
  ) as index_ok,
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'audit_fix_packs'
      and policyname = 'Public read audit_fix_packs'
  ) as policy_ok,
  coalesce(
    (select relrowsecurity from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = 'audit_fix_packs'),
    false
  ) as rls_ok;
