-- Pub Crawl Taskmaster — Supabase schema
-- Run this once in your Supabase project: SQL Editor → paste → Run.
-- Safe to re-run (uses "if not exists" / "or replace"), and never deletes data.
-- Run supabase/rpc.sql AFTER this file — it defines every function the app calls.
--
-- Security model: the browser ships the anon key, so the anon key must be able
-- to do *nothing* on its own. No table is reachable over the REST API; all
-- access goes through the SECURITY DEFINER functions in rpc.sql, each of which
-- takes a session token and decides what that session may see or change.

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

-- Login sessions. app_login() mints a token; every other function takes that
-- token and derives the caller's role from this table. Nothing is trusted from
-- the client except the opaque token itself.
create table if not exists sessions (
	token uuid primary key default gen_random_uuid(),
	username text not null,
	role text not null,
	contestant_id text,
	created_at timestamptz not null default now(),
	last_seen_at timestamptz not null default now()
);

create index if not exists sessions_last_seen_idx on sessions (last_seen_at);

-- =========================================================================
-- Lock the tables away from the API roles
-- =========================================================================
-- RLS stays on with NO policies: for anon/authenticated that is deny-all, even
-- if a grant is ever re-added by accident. Belt and braces, because the whole
-- point is that a curious contestant with the anon key cannot read answers.

alter table game_config enable row level security;
alter table answers enable row level security;
alter table accounts enable row level security;
alter table sessions enable row level security;

-- Drop the old permissive policies from the pre-RPC design, if still present.
drop policy if exists "config_all" on game_config;
drop policy if exists "answers_all" on answers;
drop policy if exists "accounts_insert" on accounts;
drop policy if exists "accounts_update" on accounts;
drop policy if exists "accounts_delete" on accounts;

-- No table privileges for the API roles at all. SECURITY DEFINER functions run
-- as the owner, so the app keeps working; direct /rest/v1/<table> calls do not.
revoke all on game_config, answers, accounts, sessions from anon, authenticated, public;

-- The old read-only view of accounts is obsolete (app_load returns the same
-- columns, admin-only) and it leaked usernames to anyone with the anon key.
drop view if exists accounts_public;

-- The old login() returned no session token; app_login() in rpc.sql replaces it.
drop function if exists login(text, text);

-- Anon may not invent its own functions or objects in the public schema.
revoke create on schema public from anon, authenticated, public;
