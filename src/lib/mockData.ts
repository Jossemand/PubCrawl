// Startdata, der bruges første gang appen kører (og når du trykker "Nulstil" i opsætningen).
// Erstat navne/spørgsmål/opgaver via /setup-skærmen eller ved at rette her.

import type { GameState } from './types';

export const initialState: GameState = {
	teams: [
		{ id: 'team-a', name: 'De Humlede Helte', color: '#e8643b' },
		{ id: 'team-b', name: 'Lager-Legenderne', color: '#3b8fe8' }
	],

	contestants: [
		{ id: 'c1', name: 'Carl Johan', teamId: 'team-a' },
		{ id: 'c2', name: 'Mads', teamId: 'team-a' },
		{ id: 'c3', name: 'Emil', teamId: 'team-a' },
		{ id: 'c4', name: 'Frederik', teamId: 'team-a' },
		{ id: 'c5', name: 'Gustav', teamId: 'team-b' },
		{ id: 'c6', name: 'Alfred', teamId: 'team-b' },
		{ id: 'c7', name: 'Andreas', teamId: 'team-b' },
	],

	questions: [
		{ id: 'q1', text: 'Hvad er din mest pinlige fulde-historie i én sætning?' },
		{ id: 'q2', text: 'Hvis du skulle opgive én for altid: øl eller kaffe?' },
		{ id: 'q3', text: 'Hvad er en mærkeligt specifik frygt, du har?' },
		{ id: 'q4', text: 'Beskriv din drømmebar med tre ord.' },
		{ id: 'q5', text: 'Hvilken sang får dig altid ud på dansegulvet?' },
		// Mor bedømmer: alle tegner det samme (simple) dyr — kun 15 sekunder!
		{ id: 'q6', text: 'Tegn dette dyr — mor kårer de bedste! (15 sek)', kind: 'drawing', animalMode: 'fixed', animal: 'Elefant', seconds: 15 },
		// De andre gætter: hver deltager får et tilfældigt (svært) motiv — 60 sekunder.
		{ id: 'q7', text: 'Tegn dit hemmelige motiv — det andet hold skal gætte det! (60 sek)', kind: 'drawing', animalMode: 'random', seconds: 60 }
	],

	// Ingen svar endnu — disse udfyldes i quiz-fasen.
	answers: [],

	tasks: [
		{ id: 't1', description: 'Køb en drink til en fremmed og lær personens navn', contestantId: 'c1', points: 5, completed: false },
		{ id: 't2', description: 'Overtal en bartender til at lave et hemmeligt håndtryk', contestantId: 'c5', points: 5, completed: false },
		{ id: 't3', description: 'Tal kun i rim på ét helt stop', contestantId: 'c3', points: 8, completed: false },
		{ id: 't4', description: 'Start et råb, som hele baren stemmer i på', contestantId: 'c7', points: 10, completed: false }
	],

	rounds: [],
	bonus: { 'team-a': 0, 'team-b': 0 },

	// The taskmaster (you) logs in with this. Change the password in Opsætning.
	// Contestant logins are generated from Opsætning ("Generér logins").
	accounts: [{ username: 'taskmaster', password: 'crawl2026', role: 'admin' }],

	ratings: []
};
