-- FedhApp : schéma Supabase
-- À coller dans Supabase > SQL Editor > New query, puis Run. Peut être relancé sans risque.
-- Chaque ligne appartient à un utilisateur (user_id) et n'est visible que par lui (Row Level Security).
-- "u" = date de dernière modification en millisecondes (la plus récente gagne).
-- "deleted" = suppression conservée pour que les autres appareils la reçoivent.

create table if not exists public.profile (
  user_id uuid primary key default auth.uid() references auth.users(id) on delete cascade,
  income  bigint,
  cur     text,
  thr     int,
  u       bigint not null default 0
);

create table if not exists public.categories (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id      text not null,
  name    text,
  budget  bigint,
  fixed   boolean not null default false,
  color   text,
  deleted boolean not null default false,
  u       bigint not null default 0,
  primary key (user_id, id)
);

create table if not exists public.expenses (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id      text not null,
  d       date,
  a       bigint,
  c       text,
  n       text,
  deleted boolean not null default false,
  u       bigint not null default 0,
  primary key (user_id, id)
);

create table if not exists public.goals (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  id      text not null,
  name    text,
  target  bigint,
  saved   bigint,
  dl      text,
  deleted boolean not null default false,
  u       bigint not null default 0,
  primary key (user_id, id)
);

create index if not exists expenses_user_u   on public.expenses   (user_id, u);
create index if not exists categories_user_u on public.categories (user_id, u);
create index if not exists goals_user_u      on public.goals      (user_id, u);

alter table public.profile    enable row level security;
alter table public.categories enable row level security;
alter table public.expenses   enable row level security;
alter table public.goals      enable row level security;

drop policy if exists "profile: ses propres lignes"    on public.profile;
drop policy if exists "categories: ses propres lignes" on public.categories;
drop policy if exists "expenses: ses propres lignes"   on public.expenses;
drop policy if exists "goals: ses propres lignes"      on public.goals;

create policy "profile: ses propres lignes"    on public.profile    for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "categories: ses propres lignes" on public.categories for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "expenses: ses propres lignes"   on public.expenses   for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "goals: ses propres lignes"      on public.goals      for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Aucun accès pour les visiteurs non connectés.
revoke all on public.profile, public.categories, public.expenses, public.goals from anon;


-- ===== Comptes : nom d'utilisateur et PIN (version 2) =====
-- Le PIN n'est jamais stocké en clair : seul un hash (PBKDF2) avec son sel est enregistré,
-- pour qu'un nouvel appareil puisse vérifier le PIN à la première connexion.

alter table public.profile add column if not exists username text;
alter table public.profile add column if not exists pin_salt text;
alter table public.profile add column if not exists pin_hash text;

alter table public.profile drop constraint if exists profile_username_format;
alter table public.profile add constraint profile_username_format
  check (username is null or username ~ '^[a-z0-9_]{3,20}$');

create unique index if not exists profile_username_key
  on public.profile (lower(username)) where username is not null;

-- Crée la ligne profil dès l'inscription (même si l'e-mail n'est pas encore confirmé).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profile (user_id, username, pin_salt, pin_hash, u)
  values (new.id,
          lower(nullif(new.raw_user_meta_data->>'username', '')),
          new.raw_user_meta_data->>'pin_salt',
          new.raw_user_meta_data->>'pin_hash',
          0)
  on conflict (user_id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Connexion par nom d'utilisateur : retrouve l'e-mail associé.
-- Compromis : quelqu'un qui devine un nom d'utilisateur peut obtenir l'e-mail correspondant.
create or replace function public.login_email(p_login text)
returns text language sql security definer stable set search_path = public, auth as $$
  select u.email::text
  from auth.users u join public.profile p on p.user_id = u.id
  where lower(p.username) = lower(p_login)
  limit 1
$$;

create or replace function public.username_available(p_username text)
returns boolean language sql security definer stable set search_path = public as $$
  select not exists (select 1 from public.profile where lower(username) = lower(p_username))
$$;

revoke all on function public.login_email(text), public.username_available(text) from public;
grant execute on function public.login_email(text), public.username_available(text) to anon, authenticated;
