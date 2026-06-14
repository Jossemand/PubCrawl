// Supabase data layer. Everything the app persists goes through here when
// Supabase is configured. Three buckets:
//   - game_config : one JSON row with the whole config (taskmaster-written)
//   - answers     : one row per (question, contestant) — player-written, granular
//   - accounts    : logins (passwords write-only from the client; login via RPC)

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

function toAnswerRow(a: Answer) {
	return {
		question_id: a.questionId,
		contestant_id: a.contestantId,
		value: a.value,
		animal: a.animal ?? null,
		locked: !!a.locked
	};
}
function fromAnswerRow(r: Record<string, unknown>): Answer {
	return {
		questionId: r.question_id as string,
		contestantId: r.contestant_id as string,
		value: (r.value as string) ?? '',
		animal: (r.animal as string) ?? undefined,
		locked: !!r.locked
	};
}

function toAccountRow(a: Account) {
	return {
		username: a.username,
		password: a.password || a.username, // password defaults to username
		role: a.role,
		contestant_id: a.contestantId ?? null
	};
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
	async function saveConfig(state: GameState) {
		const { error } = await sb.from('game_config').upsert({ id: 1, data: splitConfig(state) });
		if (error) throw error;
	}

	async function resetAll(state: GameState) {
		// Wipe, then write the seed/imported state. Errors are surfaced (not
		// swallowed) so a failed seed doesn't leave the app half-set-up.
		await sb.from('answers').delete().not('question_id', 'is', null);
		await sb.from('accounts').delete().not('username', 'is', null);
		await saveConfig(state);
		if (state.accounts.length) {
			const { error } = await sb.from('accounts').upsert(state.accounts.map(toAccountRow));
			if (error) throw error;
		}
		if (state.answers.length) {
			const { error } = await sb.from('answers').upsert(state.answers.map(toAnswerRow));
			if (error) throw error;
		}
	}

	return {
		async loadAll() {
			const { data: cfgRow, error } = await sb
				.from('game_config')
				.select('data')
				.eq('id', 1)
				.maybeSingle();
			if (error) throw error;

			// First run on an empty project: write only the seed config. NEVER wipe
			// answers/accounts here — seeding must not destroy data that already
			// exists (a full reset is an explicit action: resetAll).
			let config: ConfigData;
			if (!cfgRow) {
				const seed = clone(initialState);
				await saveConfig(seed);
				const { answers: _seedA, accounts: _seedB, ...cfg } = seed;
				config = cfg;
			} else {
				config = cfgRow.data as ConfigData;
			}

			const [{ data: answerRows }, { data: accountRows }] = await Promise.all([
				sb.from('answers').select('*'),
				sb.from('accounts_public').select('*')
			]);

			const accounts: Account[] = (accountRows ?? []).map((r) => ({
				username: r.username as string,
				password: '', // never read back to the client
				role: r.role as Account['role'],
				contestantId: (r.contestant_id as string) ?? undefined
			}));

			// Self-heal: if no admin login exists (e.g. a previous seed failed),
			// re-create the seed admin so the taskmaster can always get in.
			if (!accounts.some((a) => a.role === 'admin')) {
				const adminSeeds = clone(initialState).accounts.filter((a) => a.role === 'admin');
				if (adminSeeds.length) {
					const { error: seedErr } = await sb
						.from('accounts')
						.upsert(adminSeeds.map(toAccountRow), { onConflict: 'username' });
					if (seedErr) console.error('[supabase] could not seed admin account:', seedErr);
					else accounts.push(...adminSeeds.map((a) => ({ ...a, password: '' })));
				}
			}

			return {
				...config,
				answers: (answerRows ?? []).map(fromAnswerRow),
				accounts
			} as GameState;
		},

		saveConfig,
		resetAll,

		async upsertAnswer(answer) {
			const { error } = await sb.from('answers').upsert(toAnswerRow(answer));
			if (error) throw error;
		},

		async deleteAnswer(questionId, contestantId) {
			const { error } = await sb
				.from('answers')
				.delete()
				.match({ question_id: questionId, contestant_id: contestantId });
			if (error) throw error;
		},

		async deleteAnswersForContestant(contestantId) {
			await sb.from('answers').delete().eq('contestant_id', contestantId);
		},

		async upsertAccount(account) {
			const { error } = await sb.from('accounts').upsert(toAccountRow(account), { onConflict: 'username' });
			if (error) throw error;
		},

		async deleteAccountForContestant(contestantId) {
			await sb.from('accounts').delete().eq('contestant_id', contestantId);
		},

		async login(username, password) {
			const { data, error } = await sb.rpc('login', { p_username: username, p_password: password });
			if (error) throw error;
			const row = Array.isArray(data) ? data[0] : null;
			if (!row) return null;
			return { username: row.username, role: row.role, contestantId: row.contestant_id ?? undefined };
		}
	};
}
