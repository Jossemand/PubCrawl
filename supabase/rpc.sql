-- All app data access goes through these SECURITY DEFINER functions. They run
-- as the function owner, so they are the only way in: the API roles have no
-- privileges on the tables themselves (see schema.sql).
--
-- Every function takes a session token minted by app_login() and derives the
-- caller's role from it. The client is never trusted about who it is — the
-- old design handed all answers to anyone holding the anon key, which ships in
-- the frontend bundle, so any contestant could read the others' answers early.
--
-- Run this in the Supabase SQL Editor AFTER schema.sql. Safe to re-run.

-- =========================================================================
-- Retire the old token-less signatures first, so nothing keeps answering
-- unauthenticated calls after this script runs.
-- =========================================================================
drop function if exists app_load();
drop function if exists app_save_config(jsonb);
drop function if exists app_upsert_answer(text, text, text, text, boolean);
drop function if exists app_delete_answer(text, text);
drop function if exists app_delete_answers_for_contestant(text);
drop function if exists app_set_account(text, text, text, text);
drop function if exists app_delete_account_for_contestant(text);
drop function if exists app_reset(jsonb, jsonb);

-- =========================================================================
-- Session helper (internal — never granted to the API roles)
-- =========================================================================
create or replace function app_session(p_token text)
returns sessions language plpgsql security definer set search_path = public as $$
declare s sessions;
begin
	if p_token is null or p_token !~ '^[0-9a-fA-F-]{36}$' then
		return null;
	end if;
	select * into s from sessions
	where token = p_token::uuid and last_seen_at > now() - interval '30 days';
	if found then
		update sessions set last_seen_at = now() where token = s.token;
	end if;
	return s;
end $$;

-- Raise a PostgREST 403 for anything the session may not do.
create or replace function app_require_admin(p_token text)
returns sessions language plpgsql security definer set search_path = public as $$
declare s sessions;
begin
	s := app_session(p_token);
	if s.token is null or s.role <> 'admin' then
		raise exception 'forbidden' using errcode = '42501';
	end if;
	return s;
end $$;

-- =========================================================================
-- Auth
-- =========================================================================
create or replace function app_login(p_username text, p_password text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a accounts; t uuid;
begin
	select * into a from accounts
	where lower(username) = lower(trim(p_username)) and password = p_password
	limit 1;
	if not found then
		return null; -- the client shows "wrong username or password"
	end if;
	delete from sessions where last_seen_at < now() - interval '30 days';
	insert into sessions (username, role, contestant_id)
	values (a.username, a.role, a.contestant_id)
	returning token into t;
	return jsonb_build_object(
		'token', t, 'username', a.username, 'role', a.role, 'contestantId', a.contestant_id);
end $$;

create or replace function app_logout(p_token text)
returns void language plpgsql security definer set search_path = public as $$
begin
	if p_token ~ '^[0-9a-fA-F-]{36}$' then
		delete from sessions where token = p_token::uuid;
	end if;
end $$;

-- =========================================================================
-- Read — scoped to what the caller is allowed to see
-- =========================================================================
-- admin      → the whole game (it runs the live rounds from one device)
-- contestant → the config, their OWN answers, and only their OWN secret task
-- anonymous  → nothing but a flag saying whether the DB still needs seeding
create or replace function app_load(p_token text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s sessions; cfg jsonb; is_admin boolean; cid text;
begin
	s := app_session(p_token);

	if s.token is null then
		return jsonb_build_object(
			'role', 'anon', 'config', null,
			'answers', '[]'::jsonb, 'accounts', '[]'::jsonb,
			'needsSeed', not exists (select 1 from accounts where role = 'admin'));
	end if;

	is_admin := s.role = 'admin';
	cid := s.contestant_id;
	select data into cfg from game_config where id = 1;

	-- A contestant must not be able to read the other players' secret tasks.
	if cfg is not null and not is_admin then
		cfg := jsonb_set(cfg, '{tasks}', coalesce((
			select jsonb_agg(t) from jsonb_array_elements(coalesce(cfg->'tasks', '[]'::jsonb)) t
			where t->>'contestantId' = cid), '[]'::jsonb));
	end if;

	return jsonb_build_object(
		'role', s.role,
		'config', cfg,
		'answers', coalesce((select jsonb_agg(jsonb_build_object(
			'questionId', question_id, 'contestantId', contestant_id,
			'value', value, 'animal', animal, 'locked', locked))
			from answers where is_admin or contestant_id = cid), '[]'::jsonb),
		'accounts', case when is_admin then coalesce((select jsonb_agg(jsonb_build_object(
			'username', username, 'role', role, 'contestantId', contestant_id))
			from accounts), '[]'::jsonb) else '[]'::jsonb end,
		'needsSeed', false);
end $$;

-- =========================================================================
-- First run — seed an empty project so there is an admin to log in as
-- =========================================================================
-- Callable without a token, because on an empty database nobody could hold one
-- yet. It refuses to do anything as soon as a taskmaster login exists, so it
-- can never overwrite a live game; and it only ever inserts, never updates.
--
-- It doubles as the recovery path if the admin login is somehow lost: with
-- contestants already in place it restores the seed taskmaster account alone
-- and leaves every player account and answer untouched.
create or replace function app_bootstrap(p_config jsonb, p_accounts jsonb)
returns boolean language plpgsql security definer set search_path = public as $$
declare admin_only boolean;
begin
	if exists (select 1 from accounts where role = 'admin') then
		return false;
	end if;
	admin_only := exists (select 1 from accounts);

	insert into game_config (id, data) values (1, p_config)
		on conflict (id) do nothing;

	insert into accounts (username, password, role, contestant_id)
	select a->>'username', coalesce(nullif(a->>'password', ''), a->>'username'),
	       a->>'role', a->>'contestantId'
	from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) as a
	where not admin_only or a->>'role' = 'admin'
	on conflict (username) do nothing;
	return true;
end $$;

-- =========================================================================
-- Writes — admin only, except a contestant saving their own answer
-- =========================================================================
create or replace function app_save_config(p_token text, p_data jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
	perform app_require_admin(p_token);
	insert into game_config (id, data) values (1, p_data)
	on conflict (id) do update set data = excluded.data, updated_at = now();
end $$;

create or replace function app_upsert_answer(
	p_token text, p_question_id text, p_contestant_id text,
	p_value text, p_animal text, p_locked boolean)
returns void language plpgsql security definer set search_path = public as $$
declare s sessions; is_admin boolean; was_locked boolean;
begin
	s := app_session(p_token);
	if s.token is null then
		raise exception 'forbidden' using errcode = '42501';
	end if;
	is_admin := s.role = 'admin';
	-- A contestant may only ever write their own row.
	if not is_admin and s.contestant_id is distinct from p_contestant_id then
		raise exception 'forbidden' using errcode = '42501';
	end if;
	-- A locked (submitted) drawing is final; only the taskmaster reopens it,
	-- by deleting the row. Re-saving a locked row is a no-op, not an error,
	-- because the quiz page re-announces its answer on every reload.
	select locked into was_locked from answers
	where question_id = p_question_id and contestant_id = p_contestant_id;
	if coalesce(was_locked, false) and not is_admin then
		return;
	end if;

	insert into answers (question_id, contestant_id, value, animal, locked)
	values (p_question_id, p_contestant_id, p_value, p_animal, coalesce(p_locked, false))
	on conflict (question_id, contestant_id)
	do update set value = excluded.value, animal = excluded.animal,
	             locked = excluded.locked, updated_at = now();
end $$;

create or replace function app_delete_answer(p_token text, p_question_id text, p_contestant_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
	perform app_require_admin(p_token);
	delete from answers where question_id = p_question_id and contestant_id = p_contestant_id;
end $$;

create or replace function app_delete_answers_for_contestant(p_token text, p_contestant_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
	perform app_require_admin(p_token);
	delete from answers where contestant_id = p_contestant_id;
end $$;

create or replace function app_set_account(
	p_token text, p_username text, p_password text, p_role text, p_contestant_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
	perform app_require_admin(p_token);
	insert into accounts (username, password, role, contestant_id)
	values (p_username, coalesce(nullif(p_password, ''), p_username), p_role, p_contestant_id)
	on conflict (username)
	do update set password = excluded.password, role = excluded.role,
	             contestant_id = excluded.contestant_id;
end $$;

create or replace function app_delete_account_for_contestant(p_token text, p_contestant_id text)
returns void language plpgsql security definer set search_path = public as $$
begin
	perform app_require_admin(p_token);
	delete from sessions where contestant_id = p_contestant_id;
	delete from accounts where contestant_id = p_contestant_id;
end $$;

-- Full reset (Nulstil alt / import): wipe and reseed config + accounts.
create or replace function app_reset(p_token text, p_config jsonb, p_accounts jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare s sessions;
begin
	s := app_require_admin(p_token);
	delete from answers;
	delete from accounts;
	delete from sessions where token <> s.token; -- keep the taskmaster logged in
	insert into game_config (id, data) values (1, p_config)
		on conflict (id) do update set data = excluded.data, updated_at = now();
	insert into accounts (username, password, role, contestant_id)
	select a->>'username', coalesce(nullif(a->>'password', ''), a->>'username'),
	       a->>'role', a->>'contestantId'
	from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) as a;
end $$;

-- =========================================================================
-- Grants — expose only the callable surface
-- =========================================================================

-- The helpers are internal: no API role may call them directly.
revoke all on function app_session(text), app_require_admin(text) from anon, authenticated, public;

grant execute on function
	app_login(text, text),
	app_logout(text),
	app_load(text),
	app_bootstrap(jsonb, jsonb),
	app_save_config(text, jsonb),
	app_upsert_answer(text, text, text, text, text, boolean),
	app_delete_answer(text, text, text),
	app_delete_answers_for_contestant(text, text),
	app_set_account(text, text, text, text, text),
	app_delete_account_for_contestant(text, text),
	app_reset(text, jsonb, jsonb)
to anon, authenticated;
