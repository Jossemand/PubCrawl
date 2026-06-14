-- Pub Crawl Taskmaster — Supabase schema
-- Run this once in your Supabase project: SQL Editor → paste → Run.
-- Safe to re-run (uses "if not exists" / "or replace").

-- =========================================================================
-- Tables
-- =========================================================================

-- The whole game config (teams, contestants, questions, tasks, rounds,
-- ratings, bonus) lives in ONE JSON row, edited only by the taskmaster.
create table if not exists game_config (
	id smallint primary key default 1,
	data jsonb not null,
	updated_at timestamptz not null default now(),
	constraint game_config_single_row check (id = 1)
);

-- Answers/drawings are written by individual players, so they get their own
-- rows (no risk of one player overwriting another).
create table if not exists answers (
	question_id text not null,
	contestant_id text not null,
	value text not null default '',
	animal text,
	locked boolean not null default false,
	updated_at timestamptz not null default now(),
	primary key (question_id, contestant_id)
);

-- Logins. Passwords stay here and are never selectable by the browser.
create table if not exists accounts (
	username text primary key,
	password text not null,
	role text not null check (role in ('admin', 'contestant')),
	contestant_id text
);

-- =========================================================================
-- Row Level Security
-- =========================================================================

alter table game_config enable row level security;
alter table answers enable row level security;
alter table accounts enable row level security;

-- game_config + answers: open to the browser. Policies omit a role so they
-- apply to PUBLIC (all roles) — this avoids anon-vs-publishable-key mismatches.
-- This is a friends' party game; see SUPABASE_SETUP.md to lock it down further.
drop policy if exists "config_all" on game_config;
create policy "config_all" on game_config for all using (true) with check (true);

drop policy if exists "answers_all" on answers;
create policy "answers_all" on answers for all using (true) with check (true);

-- accounts: the browser may create/update/delete logins, but NOT read them
-- (no SELECT policy = passwords are never returned to the client).
drop policy if exists "accounts_insert" on accounts;
create policy "accounts_insert" on accounts for insert with check (true);
drop policy if exists "accounts_update" on accounts;
create policy "accounts_update" on accounts for update using (true) with check (true);
drop policy if exists "accounts_delete" on accounts;
create policy "accounts_delete" on accounts for delete using (true);

-- A safe view exposing only non-secret account columns (for the Setup screen
-- and the contestant↔account mapping). Runs with owner rights, so it can read
-- the table even though there is no SELECT policy on accounts.
create or replace view accounts_public as
	select username, role, contestant_id from accounts;
grant select on accounts_public to anon, authenticated;

-- =========================================================================
-- Login function — checks credentials server-side, returns no password.
-- =========================================================================
create or replace function login(p_username text, p_password text)
returns table (username text, role text, contestant_id text)
language sql
security definer
set search_path = public
as $$
	select a.username, a.role, a.contestant_id
	from accounts a
	where lower(a.username) = lower(p_username)
	  and a.password = p_password
	limit 1;
$$;

grant execute on function login(text, text) to anon;
