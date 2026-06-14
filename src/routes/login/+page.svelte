<script lang="ts">
	import '../../app.css';
	import { goto } from '$app/navigation';
	import { config } from '$lib/config';
	import { session } from '$lib/stores';

	let username = $state('');
	let password = $state('');
	let error = $state('');

	function submit(e: SubmitEvent) {
		e.preventDefault();
		error = '';
		if (session.login(username, password)) {
			// Redirect handled here; the layout guard also enforces it.
			goto('/');
		} else {
			error = 'Forkert brugernavn eller adgangskode.';
			password = '';
		}
	}
</script>

<div class="wrap">
	<form class="card" onsubmit={submit}>
		<h1>🍻 {config.appName}</h1>
		<p class="muted">Log ind med det brugernavn og den adgangskode, du har fået tilsendt.</p>

		<label>
			<span class="muted">Brugernavn</span>
			<input bind:value={username} autocomplete="username" autocapitalize="none" spellcheck="false" />
		</label>
		<label>
			<span class="muted">Adgangskode</span>
			<input type="password" bind:value={password} autocomplete="current-password" />
		</label>

		{#if error}<p class="err">{error}</p>{/if}

		<button type="submit" disabled={!username.trim() || !password}>Log ind</button>
	</form>
</div>

<style>
	.wrap {
		min-height: 100vh;
		display: grid;
		place-items: center;
		padding: 1rem;
	}
	form {
		width: 100%;
		max-width: 360px;
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}
	h1 {
		margin: 0;
	}
	label span {
		display: block;
		margin-bottom: 0.3rem;
	}
	.err {
		color: var(--bad);
		margin: 0;
	}
</style>
