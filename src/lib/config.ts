// Tweakable app + scoring configuration. Change these values to retune the game;
// the rest of the app reads from here so there are no magic numbers scattered around.

export const config = {
	appName: 'Pub Crawl',

	scoring: {
		/** Points awarded for each answer correctly matched to its author. */
		pointsPerCorrectMatch: 2,
		/** Extra points if a team matches every answer in a round correctly. */
		perfectRoundBonus: 3,
		/** Points for 1st/2nd/3rd place in a mom-rated drawing question. */
		drawingPodium: [5, 3, 2]
	},

	/** Default canvas seconds per mode (a question can override via its own `seconds`). */
	drawingSeconds: { fixed: 15, random: 60 },

	/**
	 * The one motif everyone draws in the mom-judged round. Everybody gets the
	 * same thing — that's the whole point of the round — so there is exactly
	 * one of these. Keep it simple: 15 seconds is not long.
	 */
	fixedMotif: 'Elefant',

	/**
	 * The 60-second motifs, one per person, for the round where the other team
	 * guesses what the drawing is. Each player is pinned to their own motif so
	 * you know in advance who draws what — nothing is rolled at random.
	 *
	 * `contestantId` refers to the ids in mockData.ts / Opsætning (c1, c2, …),
	 * not to names, so renaming a player in Opsætning keeps their motif. Add a
	 * line when you add a player; anyone without one gets an empty canvas and
	 * no prompt.
	 */
	randomMotifs: [
		{ contestantId: 'c1', motif: 'CJ der får en flad på floor i Kolding' },
		{ contestantId: 'c2', motif: 'Emil der knækker sig foran Frederiksberg Rådhus' },
		{ contestantId: 'c3', motif: 'Joes der kommer med blomster til damen kl. 6 om morgenen' },
		{ contestantId: 'c6', motif: 'Gustav der bunder en hvidvin til kevle' },
		{ contestantId: 'c5', motif: 'Emil der knækker sig på gulvet på LA bar' },
		{ contestantId: 'c4', motif: "Gustav der knækker sig på Joes' ben på LA bar" },
		{ contestantId: 'c7', motif: 'Joes der fortærer taquitos i toget hjem fra Kolding' }
	],

	/**
	 * Date of the crawl itself, as YYYY-MM-DD. Drives the countdown and the
	 * final step of the timeline. Leave it empty to hide both.
	 */
	eventDate: '2026-10-17',

	/** localStorage key under which the whole game state is saved. */
	storageKey: 'pubcrawl-state-v1',
	/** localStorage key for the current login session. */
	sessionKey: 'pubcrawl-session-v1',
	/** localStorage key remembering that a player has read their secret task. */
	taskSeenKey: 'pubcrawl-task-seen-v1'
} as const;
