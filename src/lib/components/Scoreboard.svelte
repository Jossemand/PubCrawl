<script lang="ts">
	import { scoreboard } from '$lib/stores';

	let { compact = false }: { compact?: boolean } = $props();

	// Sort a copy so the leader shows first without mutating the store value.
	let ranked = $derived([...$scoreboard].sort((a, b) => b.total - a.total));
</script>

<div class="board" class:compact>
	{#each ranked as s (s.team.id)}
		<div class="team" style="--c:{s.team.color}">
			<div class="head">
				<span class="dot"></span>
				<span class="name">{s.team.name}</span>
				<span class="total">{s.total}</span>
			</div>
			{#if !compact}
				<div class="breakdown muted">
					<span>Gæt {s.guessPoints}</span>
					<span>Opgaver {s.taskPoints}</span>
					<span>Tegning {s.drawPoints}</span>
					<span>Bonus {s.bonus}</span>
				</div>
			{/if}
		</div>
	{/each}
</div>

<style>
	.board {
		display: grid;
		gap: 0.75rem;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
	}
	.team {
		border: 1px solid var(--border);
		border-left: 5px solid var(--c);
		border-radius: 12px;
		padding: 0.75rem 1rem;
		background: var(--bg-elevated);
	}
	.head {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.dot {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		background: var(--c);
		flex: none;
	}
	.name {
		font-weight: 700;
	}
	.total {
		margin-left: auto;
		font-size: 1.6rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.breakdown {
		display: flex;
		gap: 0.85rem;
		font-size: 0.8rem;
		margin-top: 0.3rem;
	}
	.compact .total {
		font-size: 1.2rem;
	}
</style>
