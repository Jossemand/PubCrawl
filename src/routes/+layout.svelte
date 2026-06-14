<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { config } from '$lib/config';
	import { session, ready } from '$lib/stores';

	let { children } = $props();

	// Which routes each role may visit. Admin (taskmaster) sees everything.
	const CONTESTANT_PATHS = new Set(['/quiz', '/tasks']);

	const adminLinks = [
		{ href: '/', label: 'Hjem' },
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

<div class="shell">
	{#if s && path !== '/login'}
		<header>
			<a class="brand" href={homeForRole}>🍻 {config.appName}</a>
			<div class="right">
				{#if links.length}
					<nav>
						{#each links as link (link.href)}
							<a href={link.href} class:active={path === link.href}>{link.label}</a>
						{/each}
					</nav>
				{/if}
				<button class="ghost logout" onclick={logout} title="Log ud">
					{s.username} · Log ud
				</button>
			</div>
		</header>
	{/if}

	<main>
		{#if !$ready}
			<p class="muted" style="padding:2rem 0">Indlæser data…</p>
		{:else if allowed}
			{@render children()}
		{/if}
	</main>
</div>

<style>
	.shell {
		max-width: 820px;
		margin: 0 auto;
		padding: 1rem 1rem 4rem;
	}
	header {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem 1rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0 1rem;
	}
	.right {
		display: flex;
		gap: 0.6rem;
		align-items: center;
		flex-wrap: wrap;
	}
	.brand {
		font-size: 1.2rem;
		font-weight: 800;
		color: var(--text);
	}
	nav {
		display: flex;
		gap: 0.25rem;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: 999px;
		padding: 0.25rem;
	}
	nav a {
		color: var(--text-dim);
		padding: 0.35rem 0.8rem;
		border-radius: 999px;
		font-weight: 600;
		font-size: 0.9rem;
	}
	nav a.active {
		background: var(--accent);
		color: #2a1c00;
	}
	.logout {
		font-size: 0.85rem;
		padding: 0.4rem 0.7rem;
	}
</style>
