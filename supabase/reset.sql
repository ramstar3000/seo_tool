-- Reset public app schema (SynapseCRO). Drops tables in reverse dependency order.
-- WARNING: Destroys all data in these tables.

-- Visitor free audits (references site_audits)
drop table if exists public.audit_requests cascade;

-- Children of linked_repositories / site_audits
drop table if exists public.repo_change_runs cascade;

-- References leads, site_audits, auth.users
drop table if exists public.linked_repositories cascade;

-- Children of site_audits
drop table if exists public.audit_social_profiles cascade;
drop table if exists public.audit_findings cascade;
drop table if exists public.audit_pages cascade;
drop table if exists public.audit_competitors cascade;

-- References leads
drop table if exists public.site_audits cascade;

-- Independent / parent tables
drop table if exists public.leads cascade;
drop table if exists public.lead_discovery_runs cascade;
drop table if exists public.agent_brain_logs cascade;
drop table if exists public.analytics_events cascade;
drop table if exists public.site_copy cascade;

-- After running this, run schema.sql
