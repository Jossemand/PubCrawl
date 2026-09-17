// What the user still has to do, as an ordered list of steps. The timeline in
// the sidebar and the guidance on the front page both render this, so there is
// one place that decides "where are we, and what's next".
//
// Pure functions over the game state — no stores, no DOM.

import type { GameState, ID } from './types';
import type { Session } from './auth';
import { questionsForContestant } from './stores';

export type StepStatus = 'done' | 'now' | 'todo';

export interface JourneyStep {
	id: string;
	/** Short label for the timeline. */
	title: string;
	/** One line explaining what to actually do. */
	blurb: string;
	status: StepStatus;
	href?: string;
	/** Optional "3/7"-style counter shown next to the title. */
	meta?: string;
	/** Drives the little progress bar under an in-progress step. */
	progress?: { done: number; total: number };
	/** Label for the button on the front page when this is the current step. */
	cta?: string;
}

/** The first step that isn't finished — what the user should be doing now. */
export function currentStep(steps: JourneyStep[]): JourneyStep | null {
	return steps.find((s) => s.status === 'now') ?? null;
}

/** Marks the first unfinished step as 'now' and leaves the rest as 'todo'. */
function sequence(steps: (Omit<JourneyStep, 'status'> & { done: boolean })[]): JourneyStep[] {
	let foundCurrent = false;
	return steps.map(({ done, ...step }) => {
		if (done) return { ...step, status: 'done' as const };
		if (!foundCurrent) {
			foundCurrent = true;
			return { ...step, status: 'now' as const };
		}
		return { ...step, status: 'todo' as const };
	});
}

/** The player's path: log in → answer the quiz → read your task → show up. */
export function contestantJourney(
	state: GameState,
	session: Session,
	taskSeen: boolean
): JourneyStep[] {
	const me = state.contestants.find((c) => c.id === session.contestantId);
	const myQuestions = me ? questionsForContestant(state, me) : [];
	const answered = me
		? myQuestions.filter(
				(q) => state.answers.find((a) => a.questionId === q.id && a.contestantId === me.id)?.value?.trim()
			).length
		: 0;
	const quizDone = myQuestions.length > 0 && answered === myQuestions.length;
	const myTasks = me ? state.tasks.filter((t) => t.contestantId === me.id) : [];

	return sequence([
		{
			id: 'login',
			title: 'Log ind',
			blurb: 'Du er logget ind som ' + (me?.name ?? session.username) + '.',
			done: true
		},
		{
			id: 'quiz',
			title: 'Besvar din quiz',
			blurb: quizDone
				? 'Alle dine svar er gemt. Du kan altid rette dem frem til turen.'
				: 'Svar ærligt — det andet hold skal gætte, hvem der skrev hvad.',
			href: '/quiz',
			cta: 'Åbn quizzen',
			meta: myQuestions.length ? `${answered}/${myQuestions.length}` : undefined,
			progress: myQuestions.length ? { done: answered, total: myQuestions.length } : undefined,
			done: quizDone
		},
		{
			id: 'task',
			title: 'Læs din hemmelige opgave',
			blurb: myTasks.length
				? 'Du har en opgave, du skal udføre i løbet af aftenen. Hold den hemmelig!'
				: 'Du har ingen opgave endnu — kig forbi igen senere.',
			href: '/tasks',
			cta: 'Se din opgave',
			done: taskSeen && myTasks.length > 0
		},
		{
			id: 'crawl',
			title: 'Mød op til byturen',
			blurb: 'Tag din telefon med. Resten styrer taskmasteren.',
			done: false
		}
	]);
}

/** The taskmaster's path: build the game → get people answering → play it. */
export function adminJourney(state: GameState): JourneyStep[] {
	const contestants = state.contestants.length;
	const teams = state.teams.length;
	const withLogin = state.contestants.filter((c) =>
		state.accounts.some((a) => a.contestantId === c.id)
	).length;

	// Count real answer slots: each contestant only gets their own questions.
	let slots = 0;
	let filled = 0;
	for (const c of state.contestants) {
		for (const q of questionsForContestant(state, c)) {
			slots++;
			if (state.answers.find((a) => a.questionId === q.id && a.contestantId === c.id)?.value?.trim()) {
				filled++;
			}
		}
	}
	const everyoneAnswered = slots > 0 && filled === slots;
	const tasksAssigned = state.tasks.length > 0;

	return sequence([
		{
			id: 'setup',
			title: 'Hold og deltagere',
			blurb: 'Opret de to hold og skriv alle deltagere ind.',
			href: '/setup',
			cta: 'Åbn opsætning',
			meta: contestants ? `${contestants} personer` : undefined,
			done: teams >= 2 && contestants >= 2
		},
		{
			id: 'questions',
			title: 'Spørgsmål og opgaver',
			blurb: 'Skriv quizspørgsmålene og fordel en hemmelig opgave til hver deltager.',
			href: '/setup',
			cta: 'Åbn opsætning',
			meta: `${state.questions.length} spm · ${state.tasks.length} opg.`,
			done: state.questions.length > 0 && tasksAssigned
		},
		{
			id: 'logins',
			title: 'Send logins ud',
			blurb: 'Generér et login til hver deltager og send dem brugernavn og kode.',
			href: '/setup',
			cta: 'Generér logins',
			meta: contestants ? `${withLogin}/${contestants}` : undefined,
			progress: contestants ? { done: withLogin, total: contestants } : undefined,
			done: contestants > 0 && withLogin === contestants
		},
		{
			id: 'answers',
			title: 'Vent på svarene',
			blurb: everyoneAnswered
				? 'Alle har svaret — spillet er klar.'
				: 'Hold øje med hvem der mangler, og rykk dem i god tid før turen.',
			href: '/setup',
			cta: 'Se hvem der mangler',
			meta: slots ? `${filled}/${slots}` : undefined,
			progress: slots ? { done: filled, total: slots } : undefined,
			done: everyoneAnswered
		},
		{
			id: 'play',
			title: 'Kør spillet på turen',
			blurb: 'Én runde pr. stop. Appen holder styr på point og hvad I har spillet.',
			href: '/game',
			cta: 'Start en runde',
			meta: state.rounds.length ? `${state.rounds.length} runder` : undefined,
			done: false
		}
	]);
}

/** Whole days from today until the crawl. Negative once it's behind us. */
export function daysUntil(isoDate: string): number | null {
	if (!isoDate) return null;
	const target = new Date(isoDate + 'T00:00:00');
	if (Number.isNaN(target.getTime())) return null;
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

/** "om 23 dage" / "i dag!" / "3 dage siden" — for the countdown chip. */
export function countdownLabel(days: number): string {
	if (days === 0) return 'I DAG! 🍻';
	if (days === 1) return 'I morgen';
	if (days > 1) return `Om ${days} dage`;
	if (days === -1) return 'I går';
	return `${Math.abs(days)} dage siden`;
}

/** Team id → colour, for the odd place that needs it outside a component. */
export function teamColor(state: GameState, teamId: ID | undefined): string {
	return state.teams.find((t) => t.id === teamId)?.color ?? 'var(--text-dim)';
}
