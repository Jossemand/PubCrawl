// The single source of truth: one writable store holding the whole GameState,
// transparently persisted to storage on every change. Components subscribe to
// `game` and mutate it through the helper actions below.

import { writable, derived, get } from 'svelte/store';
import { browser } from '$app/environment';
import { config } from './config';
import { storage } from './storage';
import { initialState } from './mockData';
import { authenticate, usernameFromName, type Session } from './auth';
import type { Contestant, GameState, ID, Question, RoundResult, RoundType, Team } from './types';

function randomPrompt(): string {
	const list = config.drawingPrompts;
	return list[Math.floor(Math.random() * list.length)] ?? '';
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
		const existing = state.answers.find(
			(a) => a.questionId === questionId && a.contestantId === contestantId
		);
		if (existing) {
			existing.value = value;
		} else {
			state.answers.push({ questionId, contestantId, value });
		}
		return state;
	});
}

/**
 * Begin a drawing: ensure an answer row exists and assign the animal to draw.
 * Fixed-mode questions use the question's animal; random-mode keeps a stable
 * per-contestant animal once assigned (so it can't be re-rolled). Returns it.
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
		else if (!ans.animal) ans.animal = randomPrompt();
		assigned = ans.animal ?? '';
		return state;
	});
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
}

/** Save (or overwrite) your mom's ranking for a fixed drawing question. */
export function setRating(questionId: ID, podium: ID[]) {
	game.update((state) => {
		const existing = state.ratings.find((r) => r.questionId === questionId);
		if (existing) existing.podium = podium;
		else state.ratings.push({ questionId, podium });
		return state;
	});
}

export function recordRound(result: Omit<RoundResult, 'id'>) {
	game.update((state) => {
		state.rounds.push({
			...result,
			id: `round-${state.rounds.length + 1}-${result.type}-${result.questionId}`
		});
		return state;
	});
}

export function toggleTask(taskId: ID) {
	game.update((state) => {
		const task = state.tasks.find((t) => t.id === taskId);
		if (task) task.completed = !task.completed;
		return state;
	});
}

export function adjustBonus(teamId: ID, delta: number) {
	game.update((state) => {
		state.bonus[teamId] = (state.bonus[teamId] ?? 0) + delta;
		return state;
	});
}

/** Replace the whole state (used by the setup editor). */
export function replaceState(next: GameState) {
	game.set(next);
}

export function currentState() {
	return get(game);
}

// ---- Auth / session -----------------------------------------------------

function createSessionStore() {
	const initial = browser ? storage.load<Session | null>(config.sessionKey, null) : null;
	const store = writable<Session | null>(initial);
	if (browser) {
		store.subscribe((value) => storage.save(config.sessionKey, value));
	}
	return {
		subscribe: store.subscribe,
		/** Returns true on success. */
		login(username: string, password: string): boolean {
			const sess = authenticate(get(game), username, password);
			if (sess) {
				store.set(sess);
				return true;
			}
			return false;
		},
		logout() {
			store.set(null);
		}
	};
}

export const session = createSessionStore();

// ---- Account management (admin) -----------------------------------------

/** Update the taskmaster's own login. */
export function setAdminCredentials(username: string, password: string) {
	game.update((state) => {
		const admin = state.accounts.find((a) => a.role === 'admin');
		if (admin) {
			admin.username = username;
			admin.password = password;
		} else {
			state.accounts.push({ username, password, role: 'admin' });
		}
		return state;
	});
}

/** Create a login for every contestant that doesn't have one yet. Password = username. */
export function generateMissingLogins() {
	game.update((state) => {
		const taken = new Set(state.accounts.map((a) => a.username.toLowerCase()));
		for (const c of state.contestants) {
			if (state.accounts.some((a) => a.role === 'contestant' && a.contestantId === c.id)) continue;
			const username = usernameFromName(c.name, taken);
			taken.add(username);
			state.accounts.push({ username, password: username, role: 'contestant', contestantId: c.id });
		}
		return state;
	});
}

/** (Re)create one contestant's login. Password is kept equal to the username. */
export function resetContestantPassword(contestantId: ID) {
	game.update((state) => {
		const taken = new Set(state.accounts.map((a) => a.username.toLowerCase()));
		const existing = state.accounts.find((a) => a.role === 'contestant' && a.contestantId === contestantId);
		if (existing) {
			existing.password = existing.username;
		} else {
			const c = state.contestants.find((c) => c.id === contestantId);
			if (c) {
				const username = usernameFromName(c.name, taken);
				state.accounts.push({ username, password: username, role: 'contestant', contestantId });
			}
		}
		return state;
	});
}

export function setContestantHiddenQuestions(contestantId: ID, hiddenQuestionIds: ID[]) {
	game.update((state) => {
		const c = state.contestants.find((c) => c.id === contestantId);
		if (c) c.hiddenQuestionIds = hiddenQuestionIds;
		return state;
	});
}
