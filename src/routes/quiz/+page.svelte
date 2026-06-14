<script lang="ts">
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

	function onInput(questionId: string, value: string) {
		if (me) saveAnswer(questionId, me.id, value);
	}
</script>

<section class="stack">
	{#if me}
		<div class="card">
			<div class="row" style="justify-content: space-between">
				<div>
					<h2 style="margin:0">Hej {me.name} 👋</h2>
					{#if team}<span class="muted">{team.name}</span>{/if}
				</div>
				<span class="pill" style="background: var(--accent)">{answered} / {myQuestions.length} udfyldt</span>
			</div>
			<p class="muted" style="margin-top:0.75rem">
				Svar ærligt på dine spørgsmål. Dine svar er skjulte for alle andre — det modsatte hold
				skal gætte, hvem der skrev hvad på selve turen. Dine svar gemmes automatisk.
			</p>
		</div>

		<div class="card">
			<div class="stack">
				{#each myQuestions as q, i (q.id)}
					{@const ans = answerFor($game, q.id, me.id)}
					{#if q.kind === 'drawing'}
						<div class="q">
							<span class="qtext"><b>{i + 1}.</b> {q.text}</span>
							{#if ans?.locked && ans.value}
								<div class="locked">
									<img class="thumb" src={ans.value} alt="Din tegning" />
									<div class="lockinfo">
										<div class="lockbadge">🔒 Låst</div>
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
						</div>
					{:else}
						<label class="q">
							<span class="qtext"><b>{i + 1}.</b> {q.text}</span>
							<textarea
								rows="2"
								placeholder="Dit svar…"
								value={ans?.value ?? ''}
								oninput={(e) => onInput(q.id, e.currentTarget.value)}
							></textarea>
						</label>
					{/if}
				{/each}
			</div>

			{#if allDone}
				<p class="done">✅ Alt er udfyldt — tak! Du kan roligt logge ud nu.</p>
			{/if}
		</div>
	{:else}
		<div class="card">
			<p class="muted">Denne side er for deltagere. Som taskmaster har du ikke en quiz at udfylde.</p>
			<a href="/">← Til oversigten</a>
		</div>
	{/if}
</section>

<style>
	label span {
		display: block;
		margin-bottom: 0.3rem;
	}
	.q {
		display: block;
	}
	.q .qtext {
		display: block;
		font-size: 1rem;
		color: var(--text);
		margin-bottom: 0.4rem;
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
	.lockinfo p {
		margin: 0.2rem 0 0;
	}
	.done {
		margin-top: 1rem;
		color: var(--good);
		font-weight: 600;
	}
</style>
