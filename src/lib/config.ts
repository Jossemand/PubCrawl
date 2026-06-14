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

	/** Simple animals — suggestions for 'fixed' (mom-rated) drawing questions. */
	animals: [
		'Elefant',
		'Giraf',
		'Pingvin',
		'Krokodille',
		'Kænguru',
		'Næsehorn',
		'Flodhest',
		'Egern',
		'Pindsvin',
		'Ugle',
		'Hjort',
		'Sæl',
		'Blæksprutte',
		'Flamingo',
		'Dovendyr',
		'Hummer'
	],

	/** Harder scenes for 'random' (guess-the-drawing) questions — an animal doing something. */
	drawingPrompts: [
		'En elefant på rulleskøjter',
		'En giraf der spiller guitar',
		'En pingvin der dyrker yoga',
		'En krokodille til tandlægen',
		'En kænguru der bokser med en kænguru',
		'En hund der kører på skateboard',
		'En kat der bager en lagkage',
		'En bjørn der fisker i en sø',
		'En ugle der læser avis med briller',
		'En abe der jonglerer med bananer',
		'En flodhest på ballettåspids',
		'En egern der løfter vægte',
		'En frø der spiller fodbold',
		'En hest der maler et selvportræt',
		'En kanin der hopper i faldskærm',
		'En sæl der balancerer en bold på næsen til disco'
	],

	/** localStorage key under which the whole game state is saved. */
	storageKey: 'pubcrawl-state-v1',
	/** localStorage key for the current login session. */
	sessionKey: 'pubcrawl-session-v1'
} as const;
