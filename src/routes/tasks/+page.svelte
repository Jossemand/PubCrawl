<script lang="ts">
	// Two views of the same data: the taskmaster ticks tasks off, a player just
	// reads the one thing they have to pull off tonight.
	import { game, session, toggleTask, contestantById, taskSeen } from '$lib/stores';

	let isAdmin = $derived($session?.role === 'admin');
	let me = $derived(contestantById($game, $session?.contestantId));

	// Admin sees every task; a contestant sees only the ones assigned to them.
	let visibleTasks = $derived(
		isAdmin ? $game.tasks : $game.tasks.filter((t) => t.contestantId === me?.id)
	);

	// Opening this page is what ticks "read your secret task" off the timeline.
	$effect(() => {
		if (!isAdmin && me && visibleTasks.length) taskSeen.mark(me.id);
	});

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

<div class="stack">
	{#if isAdmin}
		<header>
			<h1>Hemmelige opgaver</h1>
			<p class="muted">
				Kryds en opgave af, når deltageren har udført den i løbet af aftenen. Pointene går til
				deres hold.
			</p>
		</header>

		<div class="summary">
			<div><strong>{doneCount}<span class="of">/{$game.tasks.length}</span></strong><span class="muted">udført</span></div>
			<div><strong>{earned}</strong><span class="muted">point givet</span></div>
		</div>

		<ul class="list">
			{#each visibleTasks as task (task.id)}
				{@const c = contestant(task.contestantId)}
				{@const t = team(task.contestantId)}
				<li>
					<label class="task" class:done={task.completed}>
						<input type="checkbox" checked={task.completed} onchange={() => toggleTask(task.id)} />
						<span class="body">
							<span class="desc">{task.description}</span>
							<span class="meta muted">
								{#if c}<b style="color:{t?.color ?? 'var(--text)'}">{c.name}</b>{/if}
								{#if t}· {t.name}{/if}
							</span>
						</span>
						<span class="pts">+{task.points}</span>
					</label>
				</li>
			{:else}
				<li class="empty card muted">Ingen opgaver endnu. Opret dem i Opsætning.</li>
			{/each}
		</ul>
	{:else}
		<header>
			<h1>Din hemmelige opgave</h1>
			<p class="muted">
				Dette skal du udføre i løbet af turen for at give dit hold bonuspoint. Hold det hemmeligt
				for det andet hold! 🤫
			</p>
		</header>

		{#each visibleTasks as task (task.id)}
			<article class="secret">
				<div class="secret-top">
					<span class="badge">Hemmelig opgave</span>
					<span class="worth">+{task.points} point</span>
				</div>
				<p class="mission">{task.description}</p>
			</article>
		{:else}
			<div class="card">
				<p class="muted" style="margin:0">
					Du har ingen opgave endnu. Taskmasteren fordeler dem inden turen — kig forbi igen senere.
				</p>
			</div>
		{/each}
	{/if}
</div>

<style>
	header h1 {
		margin: 0 0 0.25rem;
	}
	header p {
		margin: 0;
	}

	.summary {
		display: flex;
		gap: 0.75rem;
	}
	.summary div {
		flex: 1;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.7rem 0.95rem;
		display: flex;
		flex-direction: column;
	}
	.summary strong {
		font-size: 1.4rem;
		line-height: 1.1;
		font-variant-numeric: tabular-nums;
	}
	.summary .of {
		font-size: 0.95rem;
		color: var(--text-dim);
	}
	.summary .muted {
		font-size: 0.8rem;
	}

	.list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}
	.task {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 0.85rem;
		align-items: center;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 0.8rem 1rem;
		cursor: pointer;
		transition: border-color 0.15s ease, background 0.15s ease;
	}
	.task:hover {
		border-color: var(--border-strong);
	}
	.task.done {
		background: var(--good-soft);
		border-color: color-mix(in srgb, var(--good) 40%, var(--border));
	}
	.task input {
		width: 21px;
		height: 21px;
		accent-color: var(--good);
	}
	.body {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.task.done .desc {
		text-decoration: line-through;
		color: var(--text-dim);
	}
	.desc {
		font-weight: 600;
		line-height: 1.35;
	}
	.meta {
		font-size: 0.83rem;
		margin-top: 0.1rem;
	}
	.pts {
		font-weight: 800;
		font-size: 1.05rem;
		color: var(--highlight);
		font-variant-numeric: tabular-nums;
	}
	.empty {
		text-align: center;
	}

	/* The player's single mission, styled like something worth keeping quiet. */
	.secret {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 5px solid var(--highlight);
		border-radius: var(--radius);
		padding: 1.2rem 1.35rem;
		box-shadow: var(--shadow-sm);
	}
	.secret-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		margin-bottom: 0.6rem;
	}
	.badge {
		font-size: 0.7rem;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--highlight);
	}
	.worth {
		font-weight: 800;
		color: var(--highlight);
		font-variant-numeric: tabular-nums;
	}
	.mission {
		margin: 0;
		font-size: 1.2rem;
		font-weight: 600;
		line-height: 1.4;
	}
</style>
