-- Sika Budget : schéma Supabase
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
