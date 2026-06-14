<script lang="ts">
	import Scoreboard from '$lib/components/Scoreboard.svelte';
	import { game } from '$lib/stores';

	let answeredCount = $derived($game.answers.filter((a) => a.value?.trim()).length);
	let totalAnswerSlots = $derived($game.questions.length * $game.contestants.length);
	let roundsPlayed = $derived($game.rounds.length);
	let tasksDone = $derived($game.tasks.filter((t) => t.completed).length);

	const cards = [
		{
			href: '/game',
			emoji: '🎯',
			title: 'Live-spil',
			body: 'På hvert stop matcher det ene hold det andet holds svar med de rigtige personer.'
		},
		{
			href: '/tasks',
			emoji: '✅',
			title: 'Opgaver',
			body: 'Kryds de hemmelige opgaver af, som deltagerne udfører i løbet af aftenen, for bonuspoint.'
		},
		{
			href: '/setup',
			emoji: '⚙️',
			title: 'Opsætning',
			body: 'Rediger hold, deltagere, spørgsmål og opgaver. Eksportér eller nulstil alt.'
		}
	];
</script>

<section class="stack">
	<div class="card">
		<h2>Stilling</h2>
		<Scoreboard />
	</div>

	<div class="grid">
		{#each cards as c (c.href)}
			<a class="card tile" href={c.href}>
				<div class="emoji">{c.emoji}</div>
				<div>
					<h3>{c.title}</h3>
					<p class="muted">{c.body}</p>
				</div>
			</a>
		{/each}
	</div>

	<div class="card stats">
		<div><strong>{answeredCount}</strong><span class="muted"> / {totalAnswerSlots} svar afgivet</span></div>
		<div><strong>{roundsPlayed}</strong><span class="muted"> runder spillet</span></div>
		<div><strong>{tasksDone}</strong><span class="muted"> / {$game.tasks.length} opgaver løst</span></div>
	</div>
</section>

<style>
	.grid {
		display: grid;
		gap: 1rem;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
	}
	.tile {
		display: flex;
		gap: 0.9rem;
		align-items: flex-start;
		color: var(--text);
	}
	.tile:hover {
		border-color: var(--accent);
	}
	.tile p {
		margin: 0.2rem 0 0;
		font-size: 0.9rem;
	}
	.emoji {
		font-size: 1.8rem;
		line-height: 1;
	}
	.stats {
		display: flex;
		gap: 1.5rem;
		flex-wrap: wrap;
	}
	.stats strong {
		font-size: 1.3rem;
	}
</style>
