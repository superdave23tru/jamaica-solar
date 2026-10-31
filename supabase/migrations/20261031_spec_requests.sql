-- Homeowner system-sizer submissions. Private to Jamaica Solar: NOT shared with providers.
create table if not exists public.spec_requests (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  spec_id text not null unique,
  name text not null,
  email text not null,
  phone text,
  parish text,
  nht_contributor text,
  contact_ok boolean not null default false,
  answers jsonb not null,
  pv_kw numeric, battery_kwh numeric, inverter_kw numeric,
  price_low numeric, price_high numeric,
  status text not null default 'new',
  notes text
);
alter table public.spec_requests enable row level security;
-- Anyone can submit; nobody can read with the public key.
create policy "public can insert spec requests" on public.spec_requests for insert to anon with check (
  status = 'new'
  and spec_id ~ '^JS-[A-Z0-9]{5}$'
  and char_length(name) between 2 and 120
  and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 200
  and coalesce(char_length(phone), 0) <= 30
  and pg_column_size(answers) < 4000
  and notes is null
);
