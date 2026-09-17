// Supabase data layer. All access goes through SECURITY DEFINER RPCs (see
// supabase/rpc.sql), which are the only way in: the anon key has no privileges
// on the tables themselves.
//
// Every call carries the session token minted by `app_login`. The database
// derives the caller's role from that token, so what comes back is already
// scoped — a contestant is handed their own answers and nothing else.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Account, Answer, GameState } from '../types';
import { initialState } from '../mockData';
import type { Session } from '../auth';

function clone<T>(v: T): T {
	return JSON.parse(JSON.stringify(v)) as T;
}

/** The config blob = the whole game state minus the separately-stored bits. */
type ConfigData = Omit<GameState, 'answers' | 'accounts'>;

function splitConfig(state: GameState): ConfigData {
	const { answers: _a, accounts: _b, ...config } = state;
	return config;
}

/** What `app_load` returns, once the database has scoped it to the caller. */
interface LoadPayload {
	role: 'anon' | Account['role'];
	config: ConfigData | null;
	answers: unknown;
	accounts: unknown;
	needsSeed: boolean;
}

export interface LoadResult {
	state: GameState;
	/** 'anon' means the token was missing or expired — the caller must log in. */
	role: LoadPayload['role'];
}

export interface GameRepo {
	loadAll(): Promise<LoadResult>;
	saveConfig(state: GameState): Promise<void>;
	upsertAnswer(answer: Answer): Promise<void>;
	deleteAnswer(questionId: string, contestantId: string): Promise<void>;
	deleteAnswersForContestant(contestantId: string): Promise<void>;
	upsertAccount(account: Account): Promise<void>;
	deleteAccountForContestant(contestantId: string): Promise<void>;
	resetAll(state: GameState): Promise<void>;
	login(username: string, password: string): Promise<Session | null>;
	logout(): Promise<void>;
}

/**
 * @param getToken reads the current session token at call time (the session
 *   store is created after the repo, and the token changes on login/logout).
 */
export function createSupabaseRepo(sb: SupabaseClient, getToken: () => string | null): GameRepo {
	async function call<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
		const { data, error } = await sb.rpc(fn, { p_token: getToken(), ...args });
		if (error) throw error;
		return data as T;
	}

	/** Calls that need no session (login, first-run seeding). */
	async function callAnon<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
		const { data, error } = await sb.rpc(fn, args);
		if (error) throw error;
		return data as T;
	}

	async function saveConfig(state: GameState) {
		await call('app_save_config', { p_data: splitConfig(state) });
	}

	async function upsertAnswer(a: Answer) {
		await call('app_upsert_answer', {
			p_question_id: a.questionId,
			p_contestant_id: a.contestantId,
			p_value: a.value,
			p_animal: a.animal ?? null,
			p_locked: !!a.locked
		});
	}

	async function setAccount(a: Account) {
		await call('app_set_account', {
			p_username: a.username,
			p_password: a.password || a.username,
			p_role: a.role,
			p_contestant_id: a.contestantId ?? null
		});
	}

	async function resetAll(state: GameState) {
		await call('app_reset', { p_config: splitConfig(state), p_accounts: state.accounts });
		for (const a of state.answers) await upsertAnswer(a);
	}

	function mapAnswers(rows: unknown): Answer[] {
		return ((rows as Record<string, unknown>[]) ?? []).map((r) => ({
			questionId: r.questionId as string,
			contestantId: r.contestantId as string,
			value: (r.value as string) ?? '',
			animal: (r.animal as string) ?? undefined,
			locked: !!r.locked
		}));
	}
	function mapAccounts(rows: unknown): Account[] {
		return ((rows as Record<string, unknown>[]) ?? []).map((r) => ({
			username: r.username as string,
			password: '', // never read back to the client
			role: r.role as Account['role'],
			contestantId: (r.contestantId as string) ?? undefined
		}));
	}

	return {
		saveConfig,
		upsertAnswer,
		resetAll,

		async loadAll() {
			let data = await call<LoadPayload>('app_load');

			// First run against an empty project: seed teams, questions and the
			// admin login so there is someone to log in as. The database only
			// honours this while the accounts table is empty, so it can never
			// overwrite a live game.
			if (data?.needsSeed) {
				const seed = clone(initialState);
				await callAnon('app_bootstrap', {
					p_config: splitConfig(seed),
					p_accounts: seed.accounts
				});
				data = await call<LoadPayload>('app_load');
			}

			const role = data?.role ?? 'anon';
			const state = {
				...(data?.config ?? splitConfig(clone(initialState))),
				answers: mapAnswers(data?.answers),
				accounts: mapAccounts(data?.accounts)
			} as GameState;

			return { state, role };
		},

		async deleteAnswer(questionId, contestantId) {
			await call('app_delete_answer', { p_question_id: questionId, p_contestant_id: contestantId });
		},

		async deleteAnswersForContestant(contestantId) {
			await call('app_delete_answers_for_contestant', { p_contestant_id: contestantId });
		},

		async upsertAccount(account) {
			await setAccount(account);
		},

		async deleteAccountForContestant(contestantId) {
			await call('app_delete_account_for_contestant', { p_contestant_id: contestantId });
		},

		async login(username, password) {
			const row = await callAnon<{
				token: string;
				username: string;
				role: Account['role'];
				contestantId: string | null;
			} | null>('app_login', { p_username: username, p_password: password });
			if (!row?.token) return null;
			return {
				token: row.token,
				username: row.username,
				role: row.role,
				contestantId: row.contestantId ?? undefined
			};
		},

		async logout() {
			if (getToken()) await call('app_logout');
		}
	};
}
