// Startdata, der bruges første gang appen kører (og når du trykker "Nulstil" i opsætningen).
// Erstat navne/spørgsmål/opgaver via /setup-skærmen eller ved at rette her.

import type { GameState } from './types';
import { config } from './config';

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

	// Spørgsmålene. De er skruet til en vennegruppe, der har kendt hinanden
	// længe nok til at kunne tage det — svarene skal helst kunne spores tilbage
	// til én bestemt person, ellers er der ikke meget at gætte på.
	// Skru op, ned eller ud i Opsætning; ingen af dem er hellige.
	questions: [
		{ id: 'q1', text: 'Hvad er det værste, du har gjort mod en i denne vennegruppe — som han aldrig har opdaget?' },
		{ id: 'q2', text: 'Hvilken løgn har du fortalt gruppen, som stadig står uimodsagt den dag i dag?' },
		{ id: 'q3', text: 'Hvem i gruppen har du talt mest lort om bag ryggen — og hvad handlede det om?' },
		{ id: 'q4', text: 'Hvilken af dine egne klassiske historier er pyntet mest? Fortæl den rigtige version.' },
		{ id: 'q5', text: 'Hvad er det mest patetiske, du har gjort for at imponere en, du var vild med?' },
		{ id: 'q6', text: 'Hvad er det tætteste, du har været på at blive anholdt?' },
		{ id: 'q7', text: 'Hvad er den dyreste beslutning, du har truffet efter klokken 02?' },
		{ id: 'q8', text: 'Hvis vi fik din telefon i fem minutter, hvad ville koste dig mest?' },
		{ id: 'q9', text: 'Hvem i gruppen ville klare sig dårligst i fængsel — og hvor længe holder han?' },
		{ id: 'q10', text: 'Hvilket af de andres forhold gav du mindre end et år? Fik du ret?' },
		{ id: 'q11', text: 'Hvad ville din værste ekskæreste svare, hvis vi ringede til hende i aften og spurgte, hvordan du var?' },
		{ id: 'q12', text: 'Hvad var dit absolutte lavpunkt i 20\'erne? Én sætning, ingen undskyldninger.' },
		{ id: 'q13', text: 'Hvem i gruppen har toppet — og hvem har stadig sit bedste til gode?' },
		{ id: 'q14', text: 'Hvad er det mest upassende, du har grinet højt af?' },
		// Mor bedømmer: alle tegner det samme (simple) motiv — kun 15 sekunder!
		{ id: 'q15', text: 'Tegn dette motiv — mor kårer de bedste! (15 sek)', kind: 'drawing', animalMode: 'fixed', animal: config.fixedMotif, seconds: 15 },
		// De andre gætter: hver deltager får sit eget (svære) motiv — 60 sekunder.
		{ id: 'q16', text: 'Tegn dit hemmelige motiv — det andet hold skal gætte det! (60 sek)', kind: 'drawing', animalMode: 'random', seconds: 60 }
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
