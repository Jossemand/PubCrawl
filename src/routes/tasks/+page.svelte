<script lang="ts">
	import { game, session, toggleTask, contestantById } from '$lib/stores';

	let isAdmin = $derived($session?.role === 'admin');
	let me = $derived(contestantById($game, $session?.contestantId));

	// Admin sees every task; a contestant sees only the ones assigned to them.
	let visibleTasks = $derived(
		isAdmin ? $game.tasks : $game.tasks.filter((t) => t.contestantId === me?.id)
	);

	function contestant(id: string) {
		return $game.contestants.find((c) => c.id === id);
	}
	function team(contestantId: string) {
		const c = contestant(contestantId);
		return c ? $game.teams.find((t) => t.id === c.teamId) : null;
	}

	let doneCount = $derived($game.tasks.filter((t) => t.completed).length);
	let earned = $derived($game.tasks.filter((t) => t.completed).reduce((s, t) => s + t.points, 0));
</script>

<section class="stack">
	<div class="card">
		{#if isAdmin}
			<div class="row" style="justify-content: space-between">
				<h2 style="margin:0">Hemmelige opgaver</h2>
				<span class="pill" style="background: var(--accent)">{doneCount}/{$game.tasks.length} · {earned} point</span>
			</div>
			<p class="muted">
				Kryds en opgave af, når deltageren har udført den i løbet af aftenen. Pointene går til deres hold.
			</p>
		{:else}
			<h2 style="margin:0">Din opgave</h2>
			<p class="muted">
				Dette skal du udføre i løbet af turen for at give dit hold bonuspoint. Hold det hemmeligt for det
				andet hold! 🤫
			</p>
		{/if}

		<div class="stack" style="margin-top: 0.5rem">
			{#each visibleTasks as task (task.id)}
				{@const c = contestant(task.contestantId)}
				{@const t = team(task.contestantId)}
				{#if isAdmin}
					<label class="task" class:done={task.completed}>
						<input type="checkbox" checked={task.completed} onchange={() => toggleTask(task.id)} />
						<div class="body">
							<div class="desc">{task.description}</div>
							<div class="meta muted">
								{#if c}<b style="color:{t?.color ?? 'var(--text)'}">{c.name}</b>{/if}
								{#if t}· {t.name}{/if}
							</div>
						</div>
						<span class="pts">+{task.points}</span>
					</label>
				{:else}
					<div class="task readonly">
						<div class="body">
							<div class="desc">{task.description}</div>
						</div>
						<span class="pts">+{task.points}</span>
					</div>
				{/if}
			{:else}
				<p class="muted">{isAdmin ? 'Ingen opgaver endnu.' : 'Du har ingen opgaver i denne omgang.'}</p>
			{/each}
		</div>
	</div>
</section>

<style>
	.task {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.85rem;
		align-items: center;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: 12px;
		padding: 0.85rem 1rem;
		cursor: pointer;
	}
	.task.readonly {
		grid-template-columns: 1fr auto;
		cursor: default;
	}
	.task input {
		width: 22px;
		height: 22px;
		accent-color: var(--good);
	}
	.task.done .desc {
		text-decoration: line-through;
		color: var(--text-dim);
	}
	.desc {
		font-weight: 600;
	}
	.meta {
		font-size: 0.85rem;
		margin-top: 0.15rem;
	}
	.pts {
		font-weight: 800;
		font-size: 1.1rem;
		color: var(--accent);
		font-variant-numeric: tabular-nums;
	}
</style>
