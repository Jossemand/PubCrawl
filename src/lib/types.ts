// Core data model for the Pub Crawl Taskmaster app.
// Everything the app knows lives inside a single GameState object so it can be
// persisted as one blob now (localStorage) and shipped to a server later.

export type ID = string;

export interface Team {
	id: ID;
	name: string;
	color: string; // CSS color, used for badges/scoreboard
}

export interface Contestant {
	id: ID;
	name: string;
	teamId: ID;
	/**
	 * Questions this contestant should NOT be asked. Everyone gets every question
	 * by default (so newly added questions always show up); list ids here to hide
	 * specific ones from this person.
	 */
	hiddenQuestionIds?: ID[];
	/** @deprecated old inclusion model — migrated to hiddenQuestionIds on load. */
	questionIds?: ID[];
}

export type Role = 'admin' | 'contestant';

/**
 * A login. NOTE: passwords are stored in plain text because, until there's a
 * backend, everything lives in the browser anyway — this gates the UI but is
 * NOT real security. Swap `src/lib/auth.ts` for a server-backed check later.
 */
export interface Account {
	username: string;
	password: string;
	role: Role;
	contestantId?: ID; // set for role === 'contestant'
}

/** 'text' = a written answer; 'drawing' = draw an animal on a canvas. */
export type QuestionKind = 'text' | 'drawing';

/**
 * For drawing questions:
 * - 'fixed'  — everyone draws the SAME animal (`animal`); your mom ranks them.
 * - 'random' — each contestant gets a random animal; the other team guesses it.
 */
export type AnimalMode = 'fixed' | 'random';

export interface Question {
	id: ID;
	text: string;
	kind?: QuestionKind; // undefined = 'text'
	animalMode?: AnimalMode; // drawing questions only
	animal?: string; // the fixed animal everyone draws (animalMode === 'fixed')
	seconds?: number; // drawing timer override (defaults to config.drawingSeconds)
}

/** One contestant's answer to one question (filled in during the quiz phase). */
export interface Answer {
	questionId: ID;
	contestantId: ID;
	/** Text answer, or a PNG data URL for drawing questions. */
	value: string;
	/** The animal this contestant was asked to draw (drawing questions). */
	animal?: string;
	/** True once a drawing's timer ran out / was submitted (no more edits). */
	locked?: boolean;
}

/** Your mom's ranking of a 'fixed' drawing question: [1st, 2nd, 3rd] contestant ids. */
export interface DrawingRating {
	questionId: ID;
	podium: ID[];
}

/** A task assigned to a specific contestant to perform during the live crawl. */
export interface Task {
	id: ID;
	description: string;
	contestantId: ID; // who must perform it
	points: number;
	completed: boolean;
}

/**
 * The kind of guessing round:
 * - 'match'     — match ALL of a team's answers to people at once (auto-scored)
 * - 'who'       — for each answer, guess who wrote it (taskmaster-judged)
 * - 'what'      — for each person, guess what they answered (taskmaster-judged)
 * - 'drawGuess' — for each drawing, guess the animal it depicts (taskmaster-judged)
 */
export type RoundType = 'match' | 'who' | 'what' | 'drawGuess';

/**
 * The record of a completed guessing round: one team ("guessing") tried to
 * identify the other team's ("authoring") answers/authors for one question.
 * Stored so scores are reproducible and rounds aren't replayed.
 */
export interface RoundResult {
	id: ID;
	type: RoundType;
	questionId: ID;
	authoringTeamId: ID; // whose answers/people were in play
	guessingTeamId: ID; // who did the guessing
	correctCount: number;
	totalCount: number;
	pointsAwarded: number;
}

export interface GameState {
	teams: Team[];
	contestants: Contestant[];
	questions: Question[];
	answers: Answer[];
	tasks: Task[];
	rounds: RoundResult[];
	/** Manual point adjustments per team (judge's discretion). */
	bonus: Record<ID, number>;
	/** Logins: one admin (the taskmaster) plus one per contestant. */
	accounts: Account[];
	/** Your mom's rankings of the 'fixed' drawing questions. */
	ratings: DrawingRating[];
}
