<script lang="ts">
	// A player's own quiz. One question per card, saved as you type.
	import {
		game,
		session,
		saveAnswer,
		answerFor,
		contestantById,
		questionsForContestant,
		startDrawing,
		saveDrawing,
		drawingSecondsFor
	} from '$lib/stores';
	import DrawingPad from '$lib/components/DrawingPad.svelte';

	// The logged-in contestant answers their own assigned questions. No picking
	// who you are — that's decided by the login.
	let me = $derived(contestantById($game, $session?.contestantId));
	let team = $derived(me ? $game.teams.find((t) => t.id === me!.teamId) : null);
	let myQuestions = $derived(me ? questionsForContestant($game, me) : []);

	let answered = $derived(
		me ? myQuestions.filter((q) => answerFor($game, q.id, me!.id)?.value?.trim()).length : 0
	);
	let allDone = $derived(myQuestions.length > 0 && answered === myQuestions.length);
	let pct = $derived(myQuestions.length ? (answered / myQuestions.length) * 100 : 0);

	function onInput(questionId: string, value: string) {
		if (me) saveAnswer(questionId, me.id, value);
	}

	function isAnswered(questionId: string) {
		return !!(me && answerFor($game, questionId, me.id)?.value?.trim());
	}
</script>

{#if me}
	<div class="stack">
		<header class="head">
			<div class="head-row">
				<div>
					<h1>Hej {me.name} 👋</h1>
					{#if team}
						<span class="team" style="--c:{team.color}"><span class="dot"></span>{team.name}</span>
					{/if}
				</div>
				<div class="progress">
					<span class="frac">{answered}<span class="of">/{myQuestions.length}</span></span>
					<span class="muted lbl">udfyldt</span>
				</div>
			</div>
			<div class="bar"><span style="width:{pct}%"></span></div>
			<p class="hint">
				Svar ærligt — dine svar er skjulte for alle andre. På turen skal det modsatte hold gætte,
				hvem der skrev hvad. Alt gemmes automatisk, og du kan rette til lige indtil vi går i byen.
			</p>
		</header>

		{#if allDone}
			<div class="done-banner">
				<span aria-hidden="true">🎉</span>
				<div>
					<b>Du er færdig!</b>
					<span class="muted">Tak. Kig forbi «Min opgave» — og ellers ses vi på turen.</span>
				</div>
			</div>
		{/if}

		<ol class="questions">
			{#each myQuestions as q, i (q.id)}
				{@const ans = answerFor($game, q.id, me.id)}
				<li class="q card" class:filled={isAnswered(q.id)}>
					<div class="q-head">
						<span class="num">{i + 1}</span>
						<span class="qtext">{q.text}</span>
						{#if isAnswered(q.id)}<span class="tick" title="Gemt">✓</span>{/if}
					</div>

					{#if q.kind === 'drawing'}
						{#if ans?.locked && ans.value}
							<div class="locked">
								<img class="thumb" src={ans.value} alt="Din tegning" />
								<div>
									<div class="lockbadge">🔒 Afleveret</div>
									<p class="muted">Du tegnede: <b>{ans.animal ?? q.animal}</b></p>
								</div>
							</div>
						{:else}
							<DrawingPad
								seconds={drawingSecondsFor(q)}
								onstart={() => startDrawing(q.id, me!.id)}
								onfinish={(url) => saveDrawing(q.id, me!.id, url)}
							/>
						{/if}
					{:else}
						<textarea
							rows="2"
							placeholder="Dit svar…"
							aria-label={q.text}
							value={ans?.value ?? ''}
							oninput={(e) => onInput(q.id, e.currentTarget.value)}
						></textarea>
					{/if}
				</li>
			{/each}
		</ol>
	</div>
{:else}
	<div class="card">
		<h2>Ingen quiz her</h2>
		<p class="muted">Denne side er for deltagere. Som taskmaster har du ikke en quiz at udfylde.</p>
		<a href="/">← Til oversigten</a>
	</div>
{/if}

<style>
	.head h1 {
		margin: 0;
	}
	.head-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 0.6rem;
	}
	.team {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		font-size: 0.9rem;
		color: var(--text-dim);
		font-weight: 600;
	}
	.dot {
		width: 9px;
		height: 9px;
		border-radius: 50%;
		background: var(--c);
	}
	.progress {
		text-align: right;
		flex: none;
	}
	.frac {
		font-size: 1.5rem;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		line-height: 1;
	}
	.of {
		font-size: 1rem;
		color: var(--text-dim);
	}
	.lbl {
		display: block;
		font-size: 0.78rem;
	}

	.done-banner {
		display: flex;
		gap: 0.8rem;
		align-items: center;
		background: var(--good-soft);
		border: 1px solid var(--good);
		border-radius: var(--radius);
		padding: 0.85rem 1rem;
		font-size: 1.4rem;
	}
	.done-banner div {
		display: flex;
		flex-direction: column;
		font-size: 0.95rem;
		line-height: 1.35;
	}
	.done-banner .muted {
		font-size: 0.87rem;
	}

	.questions {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.q {
		transition: border-color 0.15s ease;
	}
	.q.filled {
		border-color: color-mix(in srgb, var(--good) 45%, var(--border));
	}
	.q-head {
		display: flex;
		align-items: flex-start;
		gap: 0.65rem;
		margin-bottom: 0.65rem;
	}
	.num {
		flex: none;
		width: 24px;
		height: 24px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		background: var(--bg-sunken);
		color: var(--text-dim);
		font-size: 0.78rem;
		font-weight: 700;
	}
	.filled .num {
		background: var(--good);
		color: #fff;
	}
	.qtext {
		font-weight: 600;
		line-height: 1.35;
		padding-top: 0.1rem;
	}
	.tick {
		margin-left: auto;
		color: var(--good);
		font-weight: 700;
	}

	.locked {
		display: flex;
		align-items: center;
		gap: 0.85rem;
	}
	.thumb {
		width: 110px;
		height: 72px;
		object-fit: cover;
		border: 2px solid var(--good);
		border-radius: 8px;
		background: #fff;
		flex: none;
	}
	.lockbadge {
		font-weight: 700;
		color: var(--good);
	}
	.locked p {
		margin: 0.2rem 0 0;
	}
</style>
