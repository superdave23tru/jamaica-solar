-- Schema changes for the Jamaica Solar Supabase project (applied 16 Oct 2026).
-- Additive only: keeps the existing public.providers table and its columns.

-- 1. Providers: allow suppliers, add contact/verification fields
alter table public.providers drop constraint if exists providers_kind_check;
alter table public.providers add constraint providers_kind_check
  check (kind = any (array['company','installer','supplier']));

alter table public.providers
  add column if not exists business_type text,
  add column if not exists website text,
  add column if not exists email text,
  add column if not exists whatsapp text,
  add column if not exists address text,
  add column if not exists city text,
  add column if not exists parish_hq text,
  add column if not exists battery_storage boolean default false,
  add column if not exists credentials text[] default '{}',
  add column if not exists verified boolean default false,
  add column if not exists sources text[] default '{}',
  add column if not exists notes text;

-- Mockup-era fields that imported listings don't have yet
alter table public.providers
  alter column short_name drop not null,
  alter column tagline drop not null,
  alter column experience_label drop not null,
  alter column team_label drop not null,
  alter column checked_date drop not null,
  alter column about1 drop not null,
  alter column about2 drop not null;

-- "JPS-approved" is not a real register; keep the column for now but stop using it in the UI.
comment on column public.providers.jps_approved is 'Deprecated: JPS publishes no approved-installer register. Use credentials/verified instead.';

-- New imports should not go live automatically
alter table public.providers alter column status set default 'pending';

-- 2. Quote requests from the /quote form
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  property_type text, parish text, bill_range text, system_kw numeric,
  name text not null, phone text not null, email text, notes text,
  matched_providers text[] default '{}', source_provider text,
  status text not null default 'new'
);
alter table public.leads enable row level security;
-- Anyone can submit a lead; nobody can read leads with the public key.
create policy "public can insert leads" on public.leads for insert to anon with check (
  status = 'new'
  and char_length(name) between 2 and 120
  and char_length(phone) between 7 and 30
  and coalesce(char_length(email), 0) <= 200
  and coalesce(char_length(notes), 0) <= 2000
);

-- 3. Reference data
create table if not exists public.bsj_inverters (
  id bigserial primary key,
  brand text not null, model text, lookup_key text, output_kw numeric, output_raw text,
  ac_voltage text, size_class text, hybrid_capable boolean, bsj_report_no text,
  approval_status text, approval_date date, data_issue text
);
alter table public.bsj_inverters enable row level security;
create policy "public read inverters" on public.bsj_inverters for select to anon using (true);

create table if not exists public.lenders (
  id bigserial primary key,
  lender text not null, product text, lender_type text, who_qualifies text, interest_rate text,
  max_term_years text, max_amount text, covers_batteries text, source text,
  last_confirmed date, status text default 'Unverified', notes text
);
alter table public.lenders enable row level security;
create policy "public read lenders" on public.lenders for select to anon using (true);
