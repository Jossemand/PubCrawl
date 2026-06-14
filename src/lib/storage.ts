// Persistence abstraction. Today this is localStorage; tomorrow it can be a
// `fetch`-based backend. Keep every read/write going through this interface so
// the rest of the app never has to care where the data lives.

export interface StorageBackend {
	load<T>(key: string, fallback: T): T;
	save<T>(key: string, value: T): void;
	clear(key: string): void;
}

const localBackend: StorageBackend = {
	load(key, fallback) {
		try {
			const raw = localStorage.getItem(key);
			return raw ? (JSON.parse(raw) as typeof fallback) : fallback;
		} catch {
			return fallback;
		}
	},
	save(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {
			// Storage full or unavailable — fail silently; the in-memory store is
			// still the source of truth for the current session.
		}
	},
	clear(key) {
		try {
			localStorage.removeItem(key);
		} catch {
			/* no-op */
		}
	}
};

// Swap this single export to point the whole app at a different backend later.
export const storage: StorageBackend = localBackend;
