<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { config } from '$lib/config';
	import { session, ready, game, taskSeen } from '$lib/stores';
	import { adminJourney, contestantJourney, countdownLabel, daysUntil } from '$lib/journey';
	import Timeline from '$lib/components/Timeline.svelte';

	let { children } = $props();

	// Which routes each role may visit. Admin (taskmaster) sees everything.
	const CONTESTANT_PATHS = new Set(['/quiz', '/tasks']);

	const adminLinks = [
		{ href: '/', label: 'Oversigt' },
		{ href: '/game', label: 'Spil' },
		{ href: '/tasks', label: 'Opgaver' },
		{ href: '/setup', label: 'Opsætning' }
	];
	const contestantLinks = [
		{ href: '/quiz', label: 'Min quiz' },
		{ href: '/tasks', label: 'Min opgave' }
	];

	let path = $derived($page.url.pathname);
	let s = $derived($session);
	let homeForRole = $derived(s?.role === 'admin' ? '/' : '/quiz');
	let links = $derived(s?.role === 'admin' ? adminLinks : s?.role === 'contestant' ? contestantLinks : []);

	// The guide rail: the same journey drives the timeline and the front page.
	let steps = $derived(
		s?.role === 'admin'
			? adminJourney($game)
			: s?.role === 'contestant'
				? contestantJourney($game, s, !!$taskSeen[s.contestantId ?? ''])
				: []
	);

	let days = $derived(daysUntil(config.eventDate));

	// May the current session see the current route?
	let allowed = $derived.by(() => {
		if (!s) return path === '/login';
		if (path === '/login') return false; // logged in → bounce to a real page
		if (s.role === 'contestant') return CONTESTANT_PATHS.has(path);
		return true; // admin
	});

	// Enforce access. Runs on the client (SPA), redirecting when a route isn't allowed.
	$effect(() => {
		if (!s) {
			if (path !== '/login') goto('/login');
		} else if (path === '/login') {
			goto(homeForRole);
		} else if (s.role === 'contestant' && !CONTESTANT_PATHS.has(path)) {
			goto('/quiz');
		}
	});

	function logout() {
		session.logout();
		goto('/login');
	}
</script>

{#if s && path !== '/login'}
	<div class="shell">
		<aside class="rail">
			<div class="rail-inner">
				<div class="top">
					<a class="brand" href={homeForRole}>
						<span class="logo" aria-hidden="true">🍻</span>
						<span class="brand-text">
							<b>{config.appName}</b>
							<span class="role">{s.role === 'admin' ? 'Taskmaster' : 'Deltager'}</span>
						</span>
					</a>
					<div class="top-right">
						{#if days !== null}
							<span class="countdown" class:soon={days <= 7}>{countdownLabel(days)}</span>
						{/if}
						<!-- Phone-sized screens have no room for the user row at the
						     bottom of the rail, so the logout sits up here instead. -->
						<button class="subtle compact-logout" onclick={logout}>Log ud</button>
					</div>
				</div>

				{#if steps.length}
					<Timeline {steps} />
				{/if}

				<nav class="pages" aria-label="Sider">
					{#each links as link (link.href)}
						<a href={link.href} class:active={path === link.href}>{link.label}</a>
					{/each}
				</nav>

				<div class="who">
					<span class="avatar" aria-hidden="true">{s.username.slice(0, 1).toUpperCase()}</span>
					<span class="uname">{s.username}</span>
					<button class="subtle" onclick={logout}>Log ud</button>
				</div>
			</div>
		</aside>

		<main>
			<div class="content">
				{#if !$ready}
					<p class="muted loading">Indlæser…</p>
				{:else if allowed}
					{@render children()}
				{/if}
			</div>
		</main>
	</div>
{:else}
	<main class="bare">
		{#if !$ready}
			<p class="muted loading">Indlæser…</p>
		{:else if allowed}
			{@render children()}
		{/if}
	</main>
{/if}

<style>
	.shell {
		min-height: 100vh;
	}

	.rail-inner {
		display: flex;
		flex-direction: column;
		gap: 1.1rem;
	}

	.top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		color: var(--text);
		min-width: 0;
	}
	.brand:hover {
		text-decoration: none;
	}
	.logo {
		font-size: 1.5rem;
		line-height: 1;
	}
	.brand-text {
		display: flex;
		flex-direction: column;
		line-height: 1.15;
		min-width: 0;
	}
	.brand-text b {
		font-size: 1rem;
		letter-spacing: -0.01em;
		white-space: nowrap;
	}
	.role {
		font-size: 0.72rem;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--text-dim);
	}

	.top-right {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		flex: none;
	}
	.compact-logout {
		font-size: 0.8rem;
	}
	.countdown {
		flex: none;
		font-size: 0.72rem;
		font-weight: 700;
		padding: 0.2rem 0.6rem;
		border-radius: 999px;
		background: var(--bg-sunken);
		color: var(--text-dim);
		white-space: nowrap;
	}
	.countdown.soon {
		background: var(--highlight-soft);
		color: var(--highlight);
	}

	.pages {
		display: flex;
		gap: 0.15rem;
	}
	.pages a {
		flex: 1;
		text-align: center;
		color: var(--text-dim);
		padding: 0.4rem 0.7rem;
		border-radius: var(--radius-sm);
		font-weight: 600;
		font-size: 0.88rem;
		white-space: nowrap;
	}
	.pages a:hover {
		background: var(--bg-sunken);
		color: var(--text);
		text-decoration: none;
	}
	.pages a.active {
		background: var(--accent);
		color: var(--on-strong);
	}

	.who {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.85rem;
		color: var(--text-dim);
	}
	.avatar {
		width: 26px;
		height: 26px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--bg-sunken);
		color: var(--text);
		font-weight: 700;
		font-size: 0.78rem;
		flex: none;
	}
	.uname {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.content {
		max-width: 780px;
		margin: 0 auto;
	}
	.loading {
		padding: 2rem 0;
	}
	.bare {
		min-height: 100vh;
	}

	/* ---- Phone: the rail becomes a sticky header strip ------------------- */
	@media (max-width: 899px) {
		.rail {
			position: sticky;
			top: 0;
			z-index: 20;
			background: var(--bg-card);
			border-bottom: 1px solid var(--border);
			padding: 0.6rem 1rem 0.5rem;
			padding-top: max(0.6rem, env(safe-area-inset-top));
		}
		.rail-inner {
			gap: 0.6rem;
		}
		.who {
			display: none; /* replaced by the compact logout in the top row */
		}
		.pages {
			overflow-x: auto;
			scrollbar-width: none;
		}
		.pages::-webkit-scrollbar {
			display: none;
		}
		.pages a {
			flex: 0 0 auto;
		}
		main {
			padding: 1rem 1rem 3rem;
		}
	}

	/* ---- Laptop: two columns, the rail pinned to the left ---------------- */
	@media (min-width: 900px) {
		.shell {
			display: grid;
			grid-template-columns: var(--rail-width) minmax(0, 1fr);
			align-items: start;
		}
		.rail {
			position: sticky;
			top: 0;
			height: 100vh;
			overflow-y: auto;
			background: var(--bg-card);
			border-right: 1px solid var(--border);
			padding: 1.5rem 1.25rem;
		}
		.rail-inner {
			min-height: calc(100vh - 3rem);
		}
		.compact-logout {
			display: none; /* the full user row at the bottom takes over */
		}
		.pages {
			flex-direction: column;
			gap: 0.1rem;
		}
		.pages a {
			text-align: left;
		}
		/* Push the user row to the bottom of the rail. */
		.who {
			margin-top: auto;
			padding-top: 1rem;
			border-top: 1px solid var(--border);
		}
		main {
			padding: 2.5rem 2rem 4rem;
		}
	}
</style>
