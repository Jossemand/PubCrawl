// Pure game logic: shuffling and scoring. No Svelte, no storage — easy to test
// and reuse if the rules move to a server later.

import { config } from './config';

/**
 * Deterministic-ish shuffle (Fisher–Yates). We don't need crypto randomness for
 * a party game; Math.random is fine here and keeps it dependency-free.
 */
export function shuffle<T>(items: readonly T[]): T[] {
	const out = items.slice();
	for (let i = out.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[out[i], out[j]] = [out[j], out[i]];
	}
	return out;
}

/**
 * Given how many answers were matched correctly out of the total, compute the
 * points for the round including the perfect-round bonus.
 */
export function scoreRound(correctCount: number, totalCount: number): number {
	let points = correctCount * config.scoring.pointsPerCorrectMatch;
	if (totalCount > 0 && correctCount === totalCount) {
		points += config.scoring.perfectRoundBonus;
	}
	return points;
}
