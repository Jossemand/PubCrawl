<script lang="ts">
	// The taskmaster's home: what to do next, where the game stands, and the
	// way in to each part of the app.
	import Scoreboard from '$lib/components/Scoreboard.svelte';
	import { game } from '$lib/stores';
	import { adminJourney, currentStep, daysUntil } from '$lib/journey';
	import { config } from '$lib/config';

	let steps = $derived(adminJourney($game));
	let next = $derived(currentStep(steps));
	let days = $derived(daysUntil(config.eventDate));

	let answeredCount = $derived($game.answers.filter((a) => a.value?.trim()).length);
	let roundsPlayed = $derived($game.rounds.length);
	let tasksDone = $derived($game.tasks.filter((t) => t.completed).length);

	const cards = [
		{
			href: '/game',
			emoji: '🎯',
			title: 'Live-spil',
			body: 'Kør en runde: det ene hold matcher det andets svar med de rigtige personer.'
		},
		{
			href: '/tasks',
			emoji: '✅',
			title: 'Opgaver',
			body: 'Kryds de hemmelige opgaver af, som deltagerne udfører undervejs.'
		},
		{
			href: '/setup',
			emoji: '⚙️',
			title: 'Opsætning',
			body: 'Hold, deltagere, spørgsmål, logins — og eksport af det hele.'
		}
	];
</script>

<div class="stack">
	<header class="page-head">
		<h1>Oversigt</h1>
		<p class="muted">
			{#if days !== null && days > 0}
				Der er <b>{days} dage</b> til byturen.
			{:else}
				Alt om byturen ét sted.
			{/if}
		</p>
	</header>

	{#if next}
		<section class="next">
			<div class="next-label">Næste skridt</div>
			<h2>{next.title}</h2>
			<p>{next.blurb}</p>
			{#if next.progress && next.progress.total > 0}
				<div class="next-progress">
					<div class="bar"><span style="width:{(next.progress.done / next.progress.total) * 100}%"></span></div>
					<span class="frac">{next.progress.done}/{next.progress.total}</span>
				</div>
			{/if}
			{#if next.href}
				<a class="cta" href={next.href}>{next.cta ?? 'Fortsæt'} →</a>
			{/if}
		</section>
	{/if}

	<section class="card">
		<div class="card-title">
			<h2>Stilling</h2>
			{#if roundsPlayed === 0}<span class="pill quiet">Ikke startet</span>{/if}
		</div>
		<Scoreboard />
	</section>

	<section class="stats">
		<div class="stat">
			<strong>{answeredCount}</strong>
			<span class="muted">svar afgivet</span>
		</div>
		<div class="stat">
			<strong>{roundsPlayed}</strong>
			<span class="muted">runder spillet</span>
		</div>
		<div class="stat">
			<strong>{tasksDone}<span class="of">/{$game.tasks.length}</span></strong>
			<span class="muted">opgaver løst</span>
		</div>
	</section>

	<section class="grid">
		{#each cards as c (c.href)}
			<a class="tile" href={c.href}>
				<span class="emoji" aria-hidden="true">{c.emoji}</span>
				<span class="tile-body">
					<b>{c.title}</b>
					<span class="muted">{c.body}</span>
				</span>
			</a>
		{/each}
	</section>
</div>

<style>
	.page-head {
		margin-bottom: -0.25rem;
	}
	.page-head p {
		margin: 0;
	}

	/* The one thing to do right now, given the loudest treatment on the page. */
	.next {
		background: linear-gradient(135deg, var(--hero-from) 0%, var(--hero-to) 100%);
		color: var(--hero-fg);
		border-radius: var(--radius-lg);
		padding: 1.4rem 1.5rem;
		box-shadow: var(--shadow);
	}
	.next-label {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		opacity: 0.85;
	}
	.next h2 {
		margin: 0.35rem 0 0.25rem;
		font-size: 1.45rem;
		color: var(--hero-fg);
	}
	.next p {
		margin: 0;
		opacity: 0.92;
		max-width: 48ch;
	}
	.next-progress {
		display: flex;
		align-items: center;
		gap: 0.7rem;
		margin-top: 0.9rem;
	}
	.next-progress .bar {
		flex: 1;
		background: rgba(255, 255, 255, 0.28);
	}
	.next-progress .bar > span {
		background: #fff;
	}
	.frac {
		font-size: 0.82rem;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.cta {
		display: inline-block;
		margin-top: 1rem;
		background: #fff;
		color: var(--hero-cta-fg);
		font-weight: 700;
		padding: 0.5rem 1rem;
		border-radius: var(--radius-sm);
	}
	.cta:hover {
		text-decoration: none;
		background: rgba(255, 255, 255, 0.9);
	}

	.stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.75rem;
	}
	.stat {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		display: flex;
		flex-direction: column;
	}
	.stat strong {
		font-size: 1.5rem;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.stat .of {
		font-size: 1rem;
		color: var(--text-dim);
		font-weight: 600;
	}
	.stat span.muted {
		font-size: 0.82rem;
	}

	.grid {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));
	}
	.tile {
		display: flex;
		gap: 0.8rem;
		align-items: flex-start;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 1rem;
		color: var(--text);
		transition: border-color 0.15s ease, transform 0.15s ease;
	}
	.tile:hover {
		border-color: var(--accent);
		transform: translateY(-1px);
		text-decoration: none;
	}
	.emoji {
		font-size: 1.5rem;
		line-height: 1.2;
	}
	.tile-body {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.tile-body span {
		font-size: 0.87rem;
		line-height: 1.4;
	}

	@media (max-width: 560px) {
		.stats {
			grid-template-columns: 1fr;
		}
		.stat {
			flex-direction: row;
			align-items: baseline;
			gap: 0.5rem;
		}
	}
</style>
