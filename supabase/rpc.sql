-- All app data access goes through these SECURITY DEFINER functions. They run
-- as the function owner and bypass RLS, which sidesteps publishable-key/role
-- issues with direct table access — and keeps passwords server-side.
--
-- Run this in the Supabase SQL Editor AFTER schema.sql. Safe to re-run.

-- Read everything the client needs (never returns passwords).
create or replace function app_load()
returns jsonb language sql security definer set search_path = public as $$
	select jsonb_build_object(
		'config', (select data from game_config where id = 1),
		'answers', coalesce((select jsonb_agg(jsonb_build_object(
			'questionId', question_id, 'contestantId', contestant_id,
			'value', value, 'animal', animal, 'locked', locked)) from answers), '[]'::jsonb),
		'accounts', coalesce((select jsonb_agg(jsonb_build_object(
			'username', username, 'role', role, 'contestantId', contestant_id)) from accounts), '[]'::jsonb)
	);
$$;

create or replace function app_save_config(p_data jsonb)
returns void language sql security definer set search_path = public as $$
	insert into game_config (id, data) values (1, p_data)
	on conflict (id) do update set data = excluded.data, updated_at = now();
$$;

create or replace function app_upsert_answer(
	p_question_id text, p_contestant_id text, p_value text, p_animal text, p_locked boolean)
returns void language sql security definer set search_path = public as $$
	insert into answers (question_id, contestant_id, value, animal, locked)
	values (p_question_id, p_contestant_id, p_value, p_animal, coalesce(p_locked, false))
	on conflict (question_id, contestant_id)
	do update set value = excluded.value, animal = excluded.animal,
	             locked = excluded.locked, updated_at = now();
$$;

create or replace function app_delete_answer(p_question_id text, p_contestant_id text)
returns void language sql security definer set search_path = public as $$
	delete from answers where question_id = p_question_id and contestant_id = p_contestant_id;
$$;

create or replace function app_delete_answers_for_contestant(p_contestant_id text)
returns void language sql security definer set search_path = public as $$
	delete from answers where contestant_id = p_contestant_id;
$$;

create or replace function app_set_account(
	p_username text, p_password text, p_role text, p_contestant_id text)
returns void language sql security definer set search_path = public as $$
	insert into accounts (username, password, role, contestant_id)
	values (p_username, coalesce(nullif(p_password, ''), p_username), p_role, p_contestant_id)
	on conflict (username)
	do update set password = excluded.password, role = excluded.role,
	             contestant_id = excluded.contestant_id;
$$;

create or replace function app_delete_account_for_contestant(p_contestant_id text)
returns void language sql security definer set search_path = public as $$
	delete from accounts where contestant_id = p_contestant_id;
$$;

-- Full reset (Nulstil alt / import): wipe and reseed config + accounts.
create or replace function app_reset(p_config jsonb, p_accounts jsonb)
returns void language sql security definer set search_path = public as $$
	delete from answers;
	delete from accounts;
	insert into game_config (id, data) values (1, p_config)
		on conflict (id) do update set data = excluded.data, updated_at = now();
	insert into accounts (username, password, role, contestant_id)
	select a->>'username', coalesce(nullif(a->>'password', ''), a->>'username'),
	       a->>'role', a->>'contestantId'
	from jsonb_array_elements(coalesce(p_accounts, '[]'::jsonb)) as a;
$$;

-- Supabase revokes default PUBLIC execute, so grant explicitly to the API roles.
grant execute on function
	app_load(),
	app_save_config(jsonb),
	app_upsert_answer(text, text, text, text, boolean),
	app_delete_answer(text, text),
	app_delete_answers_for_contestant(text),
	app_set_account(text, text, text, text),
	app_delete_account_for_contestant(text),
	app_reset(jsonb, jsonb)
to anon, authenticated;
