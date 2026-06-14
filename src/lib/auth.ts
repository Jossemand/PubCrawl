// Authentication abstraction. Today it checks credentials against the accounts
// stored in the (local) game state; later, swap `authenticate` for a call to a
// real backend without touching the UI. See the security note in types.ts.

import type { Account, GameState } from './types';

export interface Session {
	username: string;
	role: Account['role'];
	contestantId?: string;
}

/** Returns a session if the credentials match an account, otherwise null. */
export function authenticate(state: GameState, username: string, password: string): Session | null {
	const u = username.trim().toLowerCase();
	const account = (state.accounts ?? []).find(
		(a) => a.username.toLowerCase() === u && a.password === password
	);
	if (!account) return null;
	return { username: account.username, role: account.role, contestantId: account.contestantId };
}

// ---- Credential generation (for the taskmaster's Opsætning screen) ----

/** Make a readable, unique-ish username from a display name. */
export function usernameFromName(name: string, taken: Set<string>): string {
	const base =
		name
			.toLowerCase()
			.replace(/æ/g, 'ae')
			.replace(/ø/g, 'oe')
			.replace(/å/g, 'aa')
			.normalize('NFD')
			.replace(/[̀-ͯ]/g, '') // strip remaining accents
			.replace(/[^a-z0-9]+/g, '') || 'spiller';
	let candidate = base;
	let n = 2;
	while (taken.has(candidate)) candidate = `${base}${n++}`;
	return candidate;
}

/** A short, easy-to-type password (no ambiguous characters). */
export function generatePassword(length = 6): string {
	const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // no l/o/0/1
	let out = '';
	const rnd = crypto.getRandomValues(new Uint32Array(length));
	for (let i = 0; i < length; i++) out += alphabet[rnd[i] % alphabet.length];
	return out;
}
