-- Natáčecí den – nastavení databáze (lze spustit opakovaně)
-- Supabase → SQL Editor → New query → vložit VŠE → Run

create table if not exists public.editors (email text primary key);
insert into public.editors (email) values ('jirikacirek@gmail.com') on conflict do nothing;
alter table public.editors enable row level security;

create or replace function public.is_editor() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.editors where email = auth.jwt() ->> 'email');
$$;
grant execute on function public.is_editor() to anon, authenticated;

create table if not exists public.plan (
  id text primary key,
  json jsonb not null,
  saved_at bigint not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.plan enable row level security;

drop policy if exists "plan_read_public" on public.plan;
drop policy if exists "plan_read_editor" on public.plan;
drop policy if exists "plan_insert_editor" on public.plan;
drop policy if exists "plan_update_editor" on public.plan;

create policy "plan_read_public" on public.plan
  for select using (id = 'public');
create policy "plan_read_editor" on public.plan
  for select using (public.is_editor());
create policy "plan_insert_editor" on public.plan
  for insert with check (public.is_editor());
create policy "plan_update_editor" on public.plan
  for update using (public.is_editor()) with check (public.is_editor());

do $$ begin
  alter publication supabase_realtime add table public.plan;
exception when duplicate_object then null; end $$;

insert into storage.buckets (id, name, public) values ('docs', 'docs', true)
  on conflict (id) do nothing;

drop policy if exists "docs_read" on storage.objects;
drop policy if exists "docs_upload" on storage.objects;
drop policy if exists "docs_delete" on storage.objects;

create policy "docs_read" on storage.objects
  for select using (bucket_id = 'docs');
create policy "docs_upload" on storage.objects
  for insert with check (bucket_id = 'docs' and public.is_editor());
create policy "docs_delete" on storage.objects
  for delete using (bucket_id = 'docs' and public.is_editor());

select 'HOTOVO' as vysledek;
