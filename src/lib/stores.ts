// The single source of truth: one writable store holding the whole GameState,
// transparently persisted to storage on every change. Components subscribe to
// `game` and mutate it through the helper actions below.

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { config } from './config';
import { storage } from './storage';
import { initialState } from './mockData';
import { authenticate, usernameFromName, type Session } from './auth';
import { supabase, supabaseConfigured } from './db/supabaseClient';
import { createSupabaseRepo, type GameRepo } from './db/repo';
import type { Account, Contestant, GameState, ID, Question, RoundResult, RoundType, Team } from './types';

/**
 * The 60-second motif this player is pinned to (config.randomMotifs).
 * Empty string when nobody has assigned them one yet.
 */
export function motifFor(contestantId: ID): string {
	return config.randomMotifs.find((m) => m.contestantId === contestantId)?.motif ?? '';
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Fill in any fields that a previously-saved state is missing (e.g. `accounts`
 * was added after some browsers already had data) so old localStorage never
 * breaks newer code.
 */
function normalize(state: GameState): GameState {
	const base = clone(initialState);
	const merged: GameState = {
		...base,
		...state,
		accounts: state.accounts ?? base.accounts,
		bonus: state.bonus ?? base.bonus,
		ratings: state.ratings ?? []
	};
	// Migrate the old inclusion model (questionIds) to the exclusion model
	// (hiddenQuestionIds), so questions added later default to visible.
	merged.contestants = merged.contestants.map((c) => {
		if (c.hiddenQuestionIds === undefined && Array.isArray(c.questionIds)) {
			const included = new Set(c.questionIds);
			const { questionIds: _drop, ...rest } = c;
			return { ...rest, hiddenQuestionIds: merged.questions.filter((q) => !included.has(q.id)).map((q) => q.id) };
		}
		return c;
	});
	return merged;
}

function createGameStore() {
	const loaded = browser ? storage.load(config.storageKey, clone(initialState)) : clone(initialState);
	const store = writable<GameState>(normalize(loaded));

	if (browser) {
		// Persist on every change.
		store.subscribe((value) => storage.save(config.storageKey, value));
	}

	return {
		subscribe: store.subscribe,
		set: store.set,
		update: store.update,
		/** Wipe everything back to the seed data. */
		reset() {
			store.set(clone(initialState));
		}
	};
}

export const game = createGameStore();

// ---- Backend (Supabase) -------------------------------------------------
// `repo` is null unless Supabase env vars are set, in which case the app runs
// purely on localStorage (current behaviour). When present, reads load from
// Supabase on startup and writes are mirrored there.

/**
 * The current session token, read straight from storage at startup so the very
 * first load is already authenticated. Kept in sync by the session store below;
 * the repo reads it lazily on every call, which is why this lives up here.
 */
let authToken: string | null = browser
	? (storage.load<Session | null>(config.sessionKey, null)?.token ?? null)
	: null;

const repo: GameRepo | null =
	browser && supabaseConfigured && supabase
		? createSupabaseRepo(supabase, () => authToken)
		: null;

export const usingSupabase = !!repo;
/** False while the initial Supabase load is in flight; always true in local mode. */
export const ready = writable<boolean>(!repo);

/**
 * Pull the backend's view of the game for the current session. The database
 * scopes the payload to the caller, so this returns a contestant's own answers
 * and the whole game for the taskmaster. Returns the role it was served as.
 */
async function loadFromBackend(): Promise<'anon' | Account['role'] | null> {
	if (!repo) return null;
	try {
		const { state, role } = await repo.loadAll();
		game.set(normalize(state));
		return role;
	} catch (e) {
		console.error('[supabase] load failed, using local cache:', e);
		return null;
	}
}

if (repo) {
	loadFromBackend()
		.then((role) => {
			// The stored token was rejected (expired, or the game was reset) —
			// drop the stale session so the user lands on the login screen
			// instead of an empty-looking app.
			if (role === 'anon') sessionExpired();
		})
		.finally(() => ready.set(true));
}

function logErr(label: string) {
	return (e: unknown) => console.error(`[supabase] ${label} failed:`, e);
}

/** Push the whole config blob (taskmaster-written data) to Supabase. */
function syncConfig() {
	repo?.saveConfig(get(game)).catch(logErr('saveConfig'));
}

function findAnswer(state: GameState, questionId: ID, contestantId: ID) {
	return state.answers.find((a) => a.questionId === questionId && a.contestantId === contestantId);
}

// ---- Read helpers -------------------------------------------------------

export function contestantsOfTeam(state: GameState, teamId: ID) {
	return state.contestants.filter((c) => c.teamId === teamId);
}

export function answerFor(state: GameState, questionId: ID, contestantId: ID) {
	return state.answers.find((a) => a.questionId === questionId && a.contestantId === contestantId);
}

export function contestantById(state: GameState, id: ID | undefined) {
	return state.contestants.find((c) => c.id === id) ?? null;
}

/** Seconds the drawing canvas should stay open for a question (mode-based default). */
export function drawingSecondsFor(q: Question): number {
	if (q.seconds && q.seconds > 0) return q.seconds;
	return config.drawingSeconds[q.animalMode ?? 'random'] ?? 60;
}

/** The questions a contestant is asked: everything except the ones hidden for them. */
export function questionsForContestant(state: GameState, contestant: Contestant): Question[] {
	const hidden = new Set(contestant.hiddenQuestionIds ?? []);
	return state.questions.filter((q) => !hidden.has(q.id));
}

export function accountForContestant(state: GameState, contestantId: ID) {
	return state.accounts.find((a) => a.role === 'contestant' && a.contestantId === contestantId);
}

/** Contestants who have a finished (locked) drawing for a given drawing question. */
export function lockedDrawingsFor(state: GameState, questionId: ID) {
	return state.contestants
		.map((c) => ({ contestant: c, answer: answerFor(state, questionId, c.id) }))
		.filter((x) => x.answer?.locked && x.answer.value)
		.map((x) => ({ contestant: x.contestant, answer: x.answer! }));
}

export function ratingFor(state: GameState, questionId: ID) {
	return state.ratings.find((r) => r.questionId === questionId);
}

/** Has this exact (type, question, authoring team, guessing team) round been played? */
export function roundPlayed(
	state: GameState,
	type: RoundType,
	questionId: ID,
	authoringTeamId: ID,
	guessingTeamId: ID
) {
	return state.rounds.some(
		(r) =>
			r.type === type &&
			r.questionId === questionId &&
			r.authoringTeamId === authoringTeamId &&
			r.guessingTeamId === guessingTeamId
	);
}

// ---- Scoreboard ---------------------------------------------------------

export interface TeamScore {
	team: Team;
	guessPoints: number;
	taskPoints: number;
	drawPoints: number;
	bonus: number;
	total: number;
}

/** Live scoreboard derived from rounds, tasks, drawing ratings and manual bonuses. */
export const scoreboard = derived(game, ($game): TeamScore[] => {
	// Pre-compute drawing podium points per team from your mom's ratings.
	const drawByTeam = new Map<ID, number>();
	for (const rating of $game.ratings) {
		rating.podium.forEach((contestantId, idx) => {
			const points = config.scoring.drawingPodium[idx] ?? 0;
			const c = $game.contestants.find((c) => c.id === contestantId);
			if (c && points) drawByTeam.set(c.teamId, (drawByTeam.get(c.teamId) ?? 0) + points);
		});
	}

	return $game.teams.map((team) => {
		const guessPoints = $game.rounds
			.filter((r) => r.guessingTeamId === team.id)
			.reduce((sum, r) => sum + r.pointsAwarded, 0);

		const memberIds = new Set(contestantsOfTeam($game, team.id).map((c) => c.id));
		const taskPoints = $game.tasks
			.filter((t) => t.completed && memberIds.has(t.contestantId))
			.reduce((sum, t) => sum + t.points, 0);

		const drawPoints = drawByTeam.get(team.id) ?? 0;
		const bonus = $game.bonus[team.id] ?? 0;

		return {
			team,
			guessPoints,
			taskPoints,
			drawPoints,
			bonus,
			total: guessPoints + taskPoints + drawPoints + bonus
		};
	});
});

// ---- Write actions ------------------------------------------------------

export function saveAnswer(questionId: ID, contestantId: ID, value: string) {
	game.update((state) => {
		const existing = findAnswer(state, questionId, contestantId);
		if (existing) {
			existing.value = value;
		} else {
			state.answers.push({ questionId, contestantId, value });
		}
		return state;
	});
	const ans = findAnswer(get(game), questionId, contestantId);
	if (ans) repo?.upsertAnswer(ans).catch(logErr('upsertAnswer'));
}

/**
 * Begin a drawing: ensure an answer row exists and assign the motif to draw.
 * Fixed-mode questions use the question's own motif; random-mode looks up the
 * player's pinned motif, so it is the same every time and you know in advance
 * who is drawing what. Returns the motif.
 */
export function startDrawing(questionId: ID, contestantId: ID): string {
	let assigned = '';
	game.update((state) => {
		const q = state.questions.find((q) => q.id === questionId);
		let ans = state.answers.find((a) => a.questionId === questionId && a.contestantId === contestantId);
		if (!ans) {
			ans = { questionId, contestantId, value: '' };
			state.answers.push(ans);
		}
		if (q?.animalMode === 'fixed') ans.animal = q.animal ?? '';
		// Re-read the assignment every time it's opened, so fixing a typo in
		// config still reaches a player who hasn't drawn yet. A locked drawing
		// never gets here — the quiz shows the finished picture instead.
		else ans.animal = motifFor(contestantId) || ans.animal || '';
		assigned = ans.animal ?? '';
		return state;
	});
	const ans = findAnswer(get(game), questionId, contestantId);
	if (ans) repo?.upsertAnswer(ans).catch(logErr('upsertAnswer'));
	return assigned;
}

/**
 * Delete a player's answer/drawing entry. With no entry in storage, the quiz
 * shows an open canvas again — i.e. this re-opens (unlocks) their drawing. The
 * change persists through the storage layer, so it works against a backend too.
 */
export function deleteAnswer(questionId: ID, contestantId: ID) {
	game.update((state) => {
		state.answers = state.answers.filter(
			(a) => !(a.questionId === questionId && a.contestantId === contestantId)
		);
		return state;
	});
	repo?.deleteAnswer(questionId, contestantId).catch(logErr('deleteAnswer'));
}

/** Save a finished drawing (PNG data URL) and lock it. */
export function saveDrawing(questionId: ID, contestantId: ID, dataUrl: string) {
	game.update((state) => {
		let ans = state.answers.find((a) => a.questionId === questionId && a.contestantId === contestantId);
		if (!ans) {
			ans = { questionId, contestantId, value: '' };
			state.answers.push(ans);
		}
		ans.value = dataUrl;
		ans.locked = true;
		return state;
	});
	const ans = findAnswer(get(game), questionId, contestantId);
	if (ans) repo?.upsertAnswer(ans).catch(logErr('upsertAnswer'));
}

/** Save (or overwrite) your mom's ranking for a fixed drawing question. */
export function setRating(questionId: ID, podium: ID[]) {
	game.update((state) => {
		const existing = state.ratings.find((r) => r.questionId === questionId);
		if (existing) existing.podium = podium;
		else state.ratings.push({ questionId, podium });
		return state;
	});
	syncConfig();
}

export function recordRound(result: Omit<RoundResult, 'id'>) {
	game.update((state) => {
		state.rounds.push({
			...result,
			id: `round-${state.rounds.length + 1}-${result.type}-${result.questionId}`
		});
		return state;
	});
	syncConfig();
}

export function toggleTask(taskId: ID) {
	game.update((state) => {
		const task = state.tasks.find((t) => t.id === taskId);
		if (task) task.completed = !task.completed;
		return state;
	});
	syncConfig();
}

export function adjustBonus(teamId: ID, delta: number) {
	game.update((state) => {
		state.bonus[teamId] = (state.bonus[teamId] ?? 0) + delta;
		return state;
	});
	syncConfig();
}

/** Persist arbitrary config edits made directly on the store (used by Setup). */
export function syncConfigChanges() {
	syncConfig();
}

/** Remove a contestant's answers + login from the backend (after local removal). */
export function cleanupContestant(contestantId: ID) {
	syncConfig();
	repo?.deleteAnswersForContestant(contestantId).catch(logErr('deleteAnswersForContestant'));
	repo?.deleteAccountForContestant(contestantId).catch(logErr('deleteAccountForContestant'));
}

/** Replace the whole state (used by the setup import). */
export function replaceState(next: GameState) {
	const normalized = normalize(next);
	game.set(normalized);
	repo?.resetAll(normalized).catch(logErr('resetAll'));
}

/** Wipe everything back to the seed data (Setup → Nulstil alt). */
export function resetEverything() {
	const seed = clone(initialState);
	game.set(seed);
	repo?.resetAll(seed).catch(logErr('resetAll'));
}

export function currentState() {
	return get(game);
}

// ---- Auth / session -----------------------------------------------------

function createSessionStore() {
	const initial = browser ? storage.load<Session | null>(config.sessionKey, null) : null;
	const store = writable<Session | null>(initial);
	if (browser) {
		// The token is what every backend call is authorised by, so keep the
		// module-level copy in step with the store on every change.
		store.subscribe((value) => {
			authToken = value?.token ?? null;
			storage.save(config.sessionKey, value);
		});
	}

	/**
	 * Drop the local copy of the game. Only when there's a backend to reload
	 * from — in local mode this store IS the game, so wiping it would destroy
	 * the only copy. On a shared taskmaster device this stops the next person
	 * to log in from finding everyone's answers sitting in localStorage.
	 */
	function clearCachedGame() {
		if (!repo) return;
		game.set(clone(initialState));
		storage.clear(config.storageKey);
	}

	return {
		subscribe: store.subscribe,
		/**
		 * Returns true on success. Uses the Supabase `app_login` RPC when
		 * configured (passwords never reach the browser); otherwise checks the
		 * local accounts. On success the game is re-loaded, because what the
		 * backend will hand over depends on who is now logged in.
		 */
		async login(username: string, password: string): Promise<boolean> {
			const sess = repo
				? await repo.login(username, password).catch((e) => {
						console.error('[supabase] login failed:', e);
						return null;
					})
				: authenticate(get(game), username, password);
			if (!sess) return false;
			store.set(sess);
			await loadFromBackend();
			return true;
		},
		logout() {
			repo?.logout().catch(logErr('logout')); // revoke the token server-side
			store.set(null);
			clearCachedGame();
		},
		/** Session rejected by the backend: clear it without calling logout. */
		expired() {
			store.set(null);
			clearCachedGame();
		}
	};
}

export const session = createSessionStore();

/** Used by the initial load when the stored token is no longer valid. */
function sessionExpired() {
	session.expired();
}

// ---- "I've read my secret task" -----------------------------------------
// Per-device, per-player marker so the timeline can tick that step off. It is
// a convenience, not a fact about the world, so localStorage is the right home.

function createTaskSeenStore() {
	const store = writable<Record<string, boolean>>(
		browser ? storage.load<Record<string, boolean>>(config.taskSeenKey, {}) : {}
	);
	if (browser) store.subscribe((v) => storage.save(config.taskSeenKey, v));
	return {
		subscribe: store.subscribe,
		mark(contestantId: ID | undefined) {
			if (!contestantId) return;
			store.update((v) => (v[contestantId] ? v : { ...v, [contestantId]: true }));
		}
	};
}

export const taskSeen = createTaskSeenStore();

// ---- Account management (admin) -----------------------------------------

function pushAccount(account: Account) {
	repo?.upsertAccount(account).catch(logErr('upsertAccount'));
}

/** Update the taskmaster's own login. */
export function setAdminCredentials(username: string, password: string) {
	let admin: Account | undefined;
	game.update((state) => {
		admin = state.accounts.find((a) => a.role === 'admin');
		if (admin) {
			admin.username = username;
			admin.password = password;
		} else {
			admin = { username, password, role: 'admin' };
			state.accounts.push(admin);
		}
		return state;
	});
	if (admin) pushAccount(admin);
}

/** Create a login for every contestant that doesn't have one yet. Password = username. */
export function generateMissingLogins() {
	const created: Account[] = [];
	game.update((state) => {
		const taken = new Set(state.accounts.map((a) => a.username.toLowerCase()));
		for (const c of state.contestants) {
			if (state.accounts.some((a) => a.role === 'contestant' && a.contestantId === c.id)) continue;
			const username = usernameFromName(c.name, taken);
			taken.add(username);
			const acc: Account = { username, password: username, role: 'contestant', contestantId: c.id };
			state.accounts.push(acc);
			created.push(acc);
		}
		return state;
	});
	created.forEach(pushAccount);
}

/** (Re)create one contestant's login. Password is kept equal to the username. */
export function resetContestantPassword(contestantId: ID) {
	let changed: Account | undefined;
	game.update((state) => {
		const taken = new Set(state.accounts.map((a) => a.username.toLowerCase()));
		const existing = state.accounts.find((a) => a.role === 'contestant' && a.contestantId === contestantId);
		if (existing) {
			existing.password = existing.username;
			changed = existing;
		} else {
			const c = state.contestants.find((c) => c.id === contestantId);
			if (c) {
				const username = usernameFromName(c.name, taken);
				changed = { username, password: username, role: 'contestant', contestantId };
				state.accounts.push(changed);
			}
		}
		return state;
	});
	if (changed) pushAccount(changed);
}

export function setContestantHiddenQuestions(contestantId: ID, hiddenQuestionIds: ID[]) {
	game.update((state) => {
		const c = state.contestants.find((c) => c.id === contestantId);
		if (c) c.hiddenQuestionIds = hiddenQuestionIds;
		return state;
	});
	syncConfig();
}
