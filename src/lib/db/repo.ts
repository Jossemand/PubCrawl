// Supabase data layer. All access goes through SECURITY DEFINER RPCs (see
// supabase/rpc.sql), which bypass RLS and keep passwords server-side. This
// avoids publishable-key/role issues with direct table access.

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

export interface GameRepo {
	loadAll(): Promise<GameState>;
	saveConfig(state: GameState): Promise<void>;
	upsertAnswer(answer: Answer): Promise<void>;
	deleteAnswer(questionId: string, contestantId: string): Promise<void>;
	deleteAnswersForContestant(contestantId: string): Promise<void>;
	upsertAccount(account: Account): Promise<void>;
	deleteAccountForContestant(contestantId: string): Promise<void>;
	resetAll(state: GameState): Promise<void>;
	login(username: string, password: string): Promise<Session | null>;
}

export function createSupabaseRepo(sb: SupabaseClient): GameRepo {
	async function call<T = unknown>(fn: string, args?: Record<string, unknown>): Promise<T> {
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
			const data = await call<{ config: ConfigData | null; answers: unknown; accounts: unknown }>('app_load');

			// First run on an empty project: write the seed config + accounts.
			// Never wipes existing data (that's an explicit resetAll).
			let config = data?.config ?? null;
			if (!config) {
				const seed = clone(initialState);
				await saveConfig(seed);
				for (const acc of seed.accounts) await setAccount(acc);
				config = splitConfig(seed);
			}

			const answers = mapAnswers(data?.answers);
			const accounts = mapAccounts(data?.accounts);

			// Self-heal: ensure an admin login exists.
			if (!accounts.some((a) => a.role === 'admin')) {
				const adminSeeds = clone(initialState).accounts.filter((a) => a.role === 'admin');
				for (const acc of adminSeeds) {
					await setAccount(acc).catch((e) => console.error('[supabase] seed admin failed:', e));
					accounts.push({ ...acc, password: '' });
				}
			}

			return { ...config, answers, accounts } as GameState;
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
			const data = await call<Array<{ username: string; role: string; contestant_id: string | null }>>(
				'login',
				{ p_username: username, p_password: password }
			);
			const row = Array.isArray(data) ? data[0] : null;
			if (!row) return null;
			return { username: row.username, role: row.role as Account['role'], contestantId: row.contestant_id ?? undefined };
		}
	};
}
