-- Chip!n Order: seller accounts + cloud copy of each seller's data.
-- Local-first app: each PO event is stored as one JSON document, owned by one seller.
-- Row Level Security guarantees a seller can only ever read/write their own rows.

create table public.po_events (
  owner uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id text not null,
  data jsonb not null,
  deleted boolean not null default false, -- tombstone so deletes sync across devices
  updated_at timestamptz not null default now(),
  primary key (owner, id)
);

create table public.seller_profiles (
  owner uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.po_events enable row level security;
alter table public.seller_profiles enable row level security;

create policy "own events: read"   on public.po_events for select to authenticated using (owner = (select auth.uid()));
create policy "own events: insert" on public.po_events for insert to authenticated with check (owner = (select auth.uid()));
create policy "own events: update" on public.po_events for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));
create policy "own events: delete" on public.po_events for delete to authenticated using (owner = (select auth.uid()));

create policy "own profile: read"   on public.seller_profiles for select to authenticated using (owner = (select auth.uid()));
create policy "own profile: insert" on public.seller_profiles for insert to authenticated with check (owner = (select auth.uid()));
create policy "own profile: update" on public.seller_profiles for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()));

-- anon role gets nothing; only signed-in sellers touch these tables.
revoke all on public.po_events, public.seller_profiles from anon;
grant select, insert, update, delete on public.po_events to authenticated;
grant select, insert, update on public.seller_profiles to authenticated;
