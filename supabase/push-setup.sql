-- Natáčecí den – upozornění (iPhone / Apple Watch)
-- Supabase → SQL Editor → New query → vložit VŠE → Run  (lze spustit opakovaně)

create table if not exists public.push_subs (
  endpoint text primary key,
  sub jsonb not null,
  device text,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
-- tabulka není přímo dostupná; zápis jen přes funkce níže

create or replace function public.push_subscribe(p_endpoint text, p_sub jsonb, p_device text default null)
returns void language sql security definer set search_path = public as $$
  insert into public.push_subs (endpoint, sub, device) values (p_endpoint, p_sub, p_device)
  on conflict (endpoint) do update set sub = excluded.sub, device = excluded.device;
$$;
create or replace function public.push_unsubscribe(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subs where endpoint = p_endpoint;
$$;
grant execute on function public.push_subscribe(text, jsonb, text) to anon, authenticated;
grant execute on function public.push_unsubscribe(text) to anon, authenticated;

select 'HOTOVO' as vysledek;
