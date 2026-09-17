<script lang="ts">
	import '../../app.css';
	import { goto } from '$app/navigation';
	import { config } from '$lib/config';
	import { session } from '$lib/stores';
	import { countdownLabel, daysUntil } from '$lib/journey';

	let username = $state('');
	let password = $state('');
	let error = $state('');
	let busy = $state(false);

	let days = $derived(daysUntil(config.eventDate));

	async function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		busy = true;
		const ok = await session.login(username, password);
		busy = false;
		if (ok) {
			// Redirect handled here; the layout guard also enforces it.
			goto('/');
		} else {
			error = 'Forkert brugernavn eller adgangskode.';
			password = '';
		}
	}
</script>

<div class="wrap">
	<div class="panel">
		<div class="mark" aria-hidden="true">🍻</div>
		<h1>{config.appName}</h1>
		<p class="tag">
			Quizzen før turen, spillet på turen. Log ind med det brugernavn og den adgangskode, du har
			fået tilsendt.
		</p>
		{#if days !== null && days >= 0}
			<span class="countdown">{countdownLabel(days)}</span>
		{/if}
	</div>

	<form class="card" onsubmit={submit}>
		<h2>Log ind</h2>

		<label>
			<span>Brugernavn</span>
			<input bind:value={username} autocomplete="username" autocapitalize="none" spellcheck="false" />
		</label>
		<label>
			<span>Adgangskode</span>
			<input type="password" bind:value={password} autocomplete="current-password" />
		</label>

		{#if error}<p class="err" role="alert">{error}</p>{/if}

		<button type="submit" disabled={busy || !username.trim() || !password}>
			{busy ? 'Logger ind…' : 'Log ind'}
		</button>
	</form>
</div>

<style>
	.wrap {
		min-height: 100vh;
		display: grid;
		place-content: center;
		justify-items: center;
		gap: 1.5rem;
		padding: 2rem 1rem 3rem;
	}

	.panel {
		text-align: center;
		max-width: 26rem;
	}
	.mark {
		font-size: 2.6rem;
		line-height: 1;
	}
	h1 {
		margin: 0.4rem 0 0.3rem;
		font-size: 1.75rem;
	}
	.tag {
		margin: 0;
		color: var(--text-dim);
		font-size: 0.95rem;
	}
	.countdown {
		display: inline-block;
		margin-top: 0.9rem;
		background: var(--highlight-soft);
		color: var(--highlight);
		font-weight: 700;
		font-size: 0.8rem;
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
	}

	form {
		width: 100%;
		max-width: 360px;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		box-shadow: var(--shadow);
	}
	h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	label span {
		display: block;
		margin-bottom: 0.3rem;
		font-size: 0.85rem;
		font-weight: 600;
		color: var(--text-dim);
	}
	.err {
		color: var(--bad);
		background: var(--bad-soft);
		border-radius: var(--radius-sm);
		padding: 0.5rem 0.7rem;
		margin: 0;
		font-size: 0.9rem;
	}
</style>
