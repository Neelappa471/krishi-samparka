-- KrishiSetu: official mandi market prices (AGMARKNET / data.gov.in)
-- Run in Supabase SQL Editor (Dashboard → SQL → New query)

create table if not exists public.market_prices (
  id uuid primary key default gen_random_uuid(),
  commodity text not null,
  variety text not null default '',
  state text not null,
  district text not null,
  market text not null,
  min_price numeric(12, 2),
  max_price numeric(12, 2),
  modal_price numeric(12, 2),
  date date not null,
  unit text,
  source text not null default 'Government of India / AGMARKNET (data.gov.in)',
  created_at timestamptz not null default now()
);

-- Prevent duplicate rows when re-importing the same mandi report (used by import upsert)
alter table public.market_prices
  drop constraint if exists market_prices_dedup_key;
alter table public.market_prices
  add constraint market_prices_dedup_key
  unique (commodity, variety, market, date);

create index if not exists market_prices_commodity_lower_idx
  on public.market_prices (lower(commodity));

create index if not exists market_prices_state_lower_idx
  on public.market_prices (lower(state));

create index if not exists market_prices_district_lower_idx
  on public.market_prices (lower(district));

create index if not exists market_prices_market_lower_idx
  on public.market_prices (lower(market));

create index if not exists market_prices_date_idx
  on public.market_prices (date desc);

alter table public.market_prices enable row level security;

drop policy if exists "Authenticated users can read market prices" on public.market_prices;
create policy "Authenticated users can read market prices"
  on public.market_prices
  for select
  to authenticated
  using (true);

-- Optional: allow anon read only if your app requires login everywhere (KrishiSetu uses auth)
-- drop policy if exists "Anon can read market prices" on public.market_prices;
-- create policy "Anon can read market prices"
--   on public.market_prices for select to anon using (true);
