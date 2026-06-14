<script lang="ts">
	import {
		game,
		recordRound,
		roundPlayed,
		contestantsOfTeam,
		answerFor,
		lockedDrawingsFor,
		ratingFor,
		setRating
	} from '$lib/stores';
	import { shuffle, scoreRound } from '$lib/game';
	import { config } from '$lib/config';
	import Scoreboard from '$lib/components/Scoreboard.svelte';
	import type { Contestant } from '$lib/types';

	// drawRate is a UI-only round (no guessing team, scored via ratings), so the
	// selection union is wider than the recordable RoundType.
	type GameRound = 'match' | 'who' | 'what' | 'drawGuess' | 'drawRate';

	type Slot = { value: string; authorId: string }; // 'match'
	type JudgeItem = { personId: string; name: string; answer: string; drawing?: string; animal?: string };

	const ROUND_TYPES: { id: GameRound; label: string; hint: string }[] = [
		{ id: 'match', label: 'Match alle svar', hint: 'Det gættende hold matcher alle svar til de rigtige personer. Scores automatisk.' },
		{ id: 'who', label: 'Hvem svarede dette?', hint: 'Ét svar ad gangen — gæt hvem der skrev det. Du dømmer rigtigt/forkert.' },
		{ id: 'what', label: 'Hvad svarede personen?', hint: 'Én person ad gangen — gæt hvad de svarede. Du dømmer rigtigt/forkert.' },
		{ id: 'drawGuess', label: 'Gæt tegningen', hint: 'Det andet hold ser hver tegning og gætter dyret. Du dømmer rigtigt/forkert.' },
		{ id: 'drawRate', label: 'Mors bedømmelse', hint: 'Alle har tegnet samme dyr — kår de tre bedste tegninger.' }
	];

	let roundType = $state<GameRound>('match');
	let questionId = $state('');
	let authoringTeamId = $state('');

	let usesTeams = $derived(roundType !== 'drawRate');

	// Questions compatible with the chosen round type.
	let availableQuestions = $derived.by(() => {
		const qs = $game.questions;
		if (roundType === 'drawGuess') return qs.filter((q) => q.kind === 'drawing' && q.animalMode === 'random');
		if (roundType === 'drawRate') return qs.filter((q) => q.kind === 'drawing' && q.animalMode === 'fixed');
		return qs.filter((q) => q.kind !== 'drawing');
	});

	// Reset an incompatible question selection when the round type changes.
	$effect(() => {
		if (questionId && !availableQuestions.some((q) => q.id === questionId)) questionId = '';
	});

	let guessingTeamId = $derived($game.teams.find((t) => t.id !== authoringTeamId)?.id ?? '');
	let question = $derived($game.questions.find((q) => q.id === questionId) ?? null);
	let authoringTeam = $derived($game.teams.find((t) => t.id === authoringTeamId) ?? null);
	let guessingTeam = $derived($game.teams.find((t) => t.id === guessingTeamId) ?? null);

	let answeredMembers = $derived.by((): Contestant[] => {
		if (!question || !authoringTeam) return [];
		return contestantsOfTeam($game, authoringTeam.id).filter(
			(c) => answerFor($game, question!.id, c.id)?.value?.trim()
		);
	});

	// For drawRate: everyone who finished a drawing for this question.
	let galleryDrawers = $derived(question ? lockedDrawingsFor($game, question.id) : []);

	let alreadyPlayed = $derived(
		roundType !== 'drawRate' && question && authoringTeam && guessingTeam
			? roundPlayed($game, roundType, question.id, authoringTeam.id, guessingTeam.id)
			: false
	);
	let alreadyRated = $derived(roundType === 'drawRate' && question ? !!ratingFor($game, question.id) : false);

	let minMembers = $derived(roundType === 'match' || roundType === 'who' ? 2 : 1);
	let canStart = $derived(
		roundType === 'drawRate'
			? galleryDrawers.length >= 1
			: answeredMembers.length >= minMembers && !alreadyPlayed
	);

	// Active round.
	let phase = $state<'setup' | 'playing' | 'result'>('setup');
	let activeType = $state<GameRound>('match');

	let slots = $state<Slot[]>([]);
	let guesses = $state<string[]>([]);

	let items = $state<JudgeItem[]>([]);
	let verdicts = $state<(boolean | null)[]>([]);
	let revealed = $state<boolean[]>([]);

	let podium = $state<string[]>(['', '', '']); // drawRate: [1st, 2nd, 3rd] contestant ids

	let correctCount = $state(0);
	let roundTotal = $state(0);
	let pointsAwarded = $state(0);

	function nameOf(id: string) {
		return $game.contestants.find((c) => c.id === id)?.name ?? '—';
	}
	function teamOf(contestantId: string) {
		const c = $game.contestants.find((c) => c.id === contestantId);
		return c ? $game.teams.find((t) => t.id === c.teamId) : null;
	}

	function startRound() {
		if (!question) return;
		activeType = roundType;

		if (roundType === 'drawRate') {
			const existing = ratingFor($game, question.id)?.podium ?? [];
			podium = [existing[0] ?? '', existing[1] ?? '', existing[2] ?? ''];
			phase = 'playing';
			return;
		}

		if (!authoringTeam) return;
		const members = shuffle(answeredMembers);

		if (roundType === 'match') {
			slots = members.map((c) => ({ value: answerFor($game, question!.id, c.id)!.value, authorId: c.id }));
			guesses = slots.map(() => '');
		} else {
			items = members.map((c) => {
				const a = answerFor($game, question!.id, c.id)!;
				return {
					personId: c.id,
					name: c.name,
					answer: a.value,
					drawing: question!.kind === 'drawing' ? a.value : undefined,
					animal: a.animal
				};
			});
			verdicts = items.map(() => null);
			revealed = items.map(() => false);
		}
		phase = 'playing';
	}

	let usedNames = $derived(new Set(guesses.filter(Boolean)));
	let allGuessed = $derived(guesses.length > 0 && guesses.every((g) => g !== ''));
	let allJudged = $derived(verdicts.length > 0 && verdicts.every((v) => v !== null));
	let podiumHasOne = $derived(podium.some(Boolean));

	function setRank(rank: number, contestantId: string) {
		const next = [...podium];
		for (let r = 0; r < next.length; r++) if (next[r] === contestantId) next[r] = '';
		next[rank] = next[rank] === contestantId ? '' : contestantId;
		podium = next;
	}

	function finish() {
		if (!question) return;

		if (activeType === 'drawRate') {
			setRating(question.id, podium.filter(Boolean));
			phase = 'result';
			return;
		}

		if (!authoringTeam || !guessingTeam) return;
		if (activeType === 'match') {
			correctCount = slots.reduce((n, s, i) => n + (guesses[i] === s.authorId ? 1 : 0), 0);
			roundTotal = slots.length;
		} else {
			correctCount = verdicts.filter((v) => v === true).length;
			roundTotal = items.length;
		}
		pointsAwarded = scoreRound(correctCount, roundTotal);
		recordRound({
			type: activeType,
			questionId: question.id,
			authoringTeamId: authoringTeam.id,
			guessingTeamId: guessingTeam.id,
			correctCount,
			totalCount: roundTotal,
			pointsAwarded
		});
		phase = 'result';
	}

	function newRound() {
		phase = 'setup';
		slots = [];
		guesses = [];
		items = [];
		verdicts = [];
		revealed = [];
		podium = ['', '', ''];
		correctCount = 0;
		roundTotal = 0;
		pointsAwarded = 0;
	}
</script>

<section class="stack">
	<div class="card">
		<h2>Live-spil</h2>

		{#if phase === 'setup'}
			<div class="types">
				{#each ROUND_TYPES as rt (rt.id)}
					<button class="type" class:active={roundType === rt.id} onclick={() => (roundType = rt.id)}>
						{rt.label}
					</button>
				{/each}
			</div>
			<p class="muted">
				{ROUND_TYPES.find((r) => r.id === roundType)?.hint}
				{#if roundType === 'drawRate'}
					Point: {config.scoring.drawingPodium.join(' / ')} for 1./2./3. plads.
				{:else}
					{config.scoring.pointsPerCorrectMatch} point pr. rigtig, +{config.scoring.perfectRoundBonus} for fuldt hus.
				{/if}
			</p>

			<div class="grid2">
				<label>
					<span class="muted">Spørgsmål</span>
					<select bind:value={questionId}>
						<option value="" disabled>Vælg et spørgsmål</option>
						{#each availableQuestions as q (q.id)}
							<option value={q.id}>{q.text}</option>
						{/each}
					</select>
				</label>
				{#if usesTeams}
					<label>
						<span class="muted">{roundType === 'what' ? 'Personer fra…' : 'Vis svar fra…'}</span>
						<select bind:value={authoringTeamId}>
							<option value="" disabled>Vælg et hold</option>
							{#each $game.teams as t (t.id)}
								<option value={t.id}>{t.name}</option>
							{/each}
						</select>
					</label>
				{/if}
			</div>

			{#if availableQuestions.length === 0}
				<p class="status">⚠️ Ingen spørgsmål passer til denne rundetype endnu. Opret et i Opsætning.</p>
			{:else if question}
				<p class="status">
					{#if roundType === 'drawRate'}
						{#if galleryDrawers.length === 0}
							⚠️ Ingen har tegnet dette dyr endnu.
						{:else}
							{galleryDrawers.length} tegninger klar til bedømmelse{alreadyRated ? ' · allerede bedømt (kan rettes)' : ''}.
						{/if}
					{:else if authoringTeam}
						{#if alreadyPlayed}
							⚠️ <b>{guessingTeam?.name}</b> har allerede spillet denne runde. Vælg en anden kombination.
						{:else if answeredMembers.length < minMembers}
							⚠️ Kun {answeredMembers.length} af {authoringTeam.name}s medlemmer har svaret — der skal mindst {minMembers} til.
						{:else}
							<b>{guessingTeam?.name}</b> gætter på {answeredMembers.length} fra <b>{authoringTeam.name}</b>.
						{/if}
					{/if}
				</p>
			{/if}

			<button onclick={startRound} disabled={!canStart}>Start runde →</button>
		{/if}

		<!-- ============ MATCH ============ -->
		{#if phase === 'playing' && activeType === 'match' && question && guessingTeam && authoringTeam}
			<div class="banner">
				<b>{guessingTeam.name}</b>, match hvert svar med den rigtige person på {authoringTeam.name}.
			</div>
			<p class="qtext">“{question.text}”</p>
			<div class="stack">
				{#each slots as slot, i (i)}
					<div class="slot">
						<div class="ans">“{slot.value}”</div>
						<select bind:value={guesses[i]}>
							<option value="" disabled>Hvem skrev dette?</option>
							{#each answeredMembers as m (m.id)}
								<option value={m.id} disabled={usedNames.has(m.id) && guesses[i] !== m.id}>{m.name}</option>
							{/each}
						</select>
					</div>
				{/each}
			</div>
			<div class="row" style="margin-top:1rem">
				<button onclick={finish} disabled={!allGuessed}>Afslør &amp; giv point</button>
				<button class="ghost" onclick={newRound}>Annullér</button>
			</div>
		{/if}

		<!-- ============ JUDGED: who / what / drawGuess ============ -->
		{#if phase === 'playing' && (activeType === 'who' || activeType === 'what' || activeType === 'drawGuess') && question && guessingTeam && authoringTeam}
			<div class="banner">
				<b>{guessingTeam.name}</b>
				{#if activeType === 'who'}— gæt hvem på {authoringTeam.name}, der skrev hvert svar.
				{:else if activeType === 'what'}— gæt hvad hver person på {authoringTeam.name} svarede.
				{:else}— gæt hvilket dyr hver tegning fra {authoringTeam.name} forestiller.{/if}
			</div>
			<p class="qtext">“{question.text}”</p>

			<div class="stack">
				{#each items as item, i (item.personId)}
					<div class="slot judge" class:ok={verdicts[i] === true} class:no={verdicts[i] === false}>
						{#if activeType === 'drawGuess'}
							<img class="drawing" src={item.drawing} alt="Tegning" />
							<div class="prompt muted">Hvad forestiller tegningen?</div>
						{:else if activeType === 'who'}
							<div class="show">“{item.answer}”</div>
							<div class="prompt muted">Hvem skrev dette?</div>
						{:else}
							<div class="show">{item.name}</div>
							<div class="prompt muted">Hvad svarede {item.name}?</div>
						{/if}

						{#if revealed[i]}
							<div class="facit">
								Facit:
								{#if activeType === 'drawGuess'}<b>{item.animal}</b> (af {item.name})
								{:else if activeType === 'who'}<b>{item.name}</b>
								{:else}<b>“{item.answer}”</b>{/if}
							</div>
							<div class="row controls">
								<button class:sel={verdicts[i] === true} onclick={() => (verdicts[i] = true)}>✓ Rigtigt</button>
								<button class="danger" class:sel={verdicts[i] === false} onclick={() => (verdicts[i] = false)}>✗ Forkert</button>
							</div>
						{:else}
							<div class="row controls">
								<button class="ghost" onclick={() => (revealed[i] = true)}>Vis facit</button>
							</div>
						{/if}
					</div>
				{/each}
			</div>
			<div class="row" style="margin-top:1rem">
				<button onclick={finish} disabled={!allJudged}>Afslut runde &amp; giv point</button>
				<button class="ghost" onclick={newRound}>Annullér</button>
			</div>
		{/if}

		<!-- ============ DRAW RATE (mom) ============ -->
		{#if phase === 'playing' && activeType === 'drawRate' && question}
			<div class="banner">Mor: kår de tre bedste tegninger af <b>{question.animal}</b>.</div>
			<div class="gallery">
				{#each galleryDrawers as d (d.contestant.id)}
					{@const rank = podium.indexOf(d.contestant.id)}
					<div class="draw-card" class:ranked={rank >= 0}>
						<img class="drawing" src={d.answer.value} alt={d.contestant.name} />
						<div class="who">
							<b>{d.contestant.name}</b>
							<span class="dot" style="background:{teamOf(d.contestant.id)?.color}"></span>
						</div>
						<div class="medals">
							{#each ['🥇', '🥈', '🥉'] as medal, r (r)}
								<button class="medal" class:sel={rank === r} onclick={() => setRank(r, d.contestant.id)}>{medal}</button>
							{/each}
						</div>
					</div>
				{/each}
			</div>
			<div class="row" style="margin-top:1rem">
				<button onclick={finish} disabled={!podiumHasOne}>Gem bedømmelse</button>
				<button class="ghost" onclick={newRound}>Annullér</button>
			</div>
		{/if}

		<!-- ============ RESULT ============ -->
		{#if phase === 'result' && question}
			{#if activeType === 'drawRate'}
				<div class="banner result">🎨 Bedømmelse gemt for <b>{question.animal}</b>!</div>
				<div class="stack">
					{#each podium as id, r (r)}
						{#if id}
							<div class="slot reveal ok">
								<div class="ans">{['🥇', '🥈', '🥉'][r]} <b>{nameOf(id)}</b> ({teamOf(id)?.name})</div>
								<div class="verdict">+{config.scoring.drawingPodium[r] ?? 0} point</div>
							</div>
						{/if}
					{/each}
				</div>
			{:else}
				<div class="banner result">
					🎉 {guessingTeam?.name} fik <b>{correctCount}/{roundTotal}</b> rigtige — +{pointsAwarded} point
					{#if correctCount === roundTotal && roundTotal > 0}<span> (fuldt hus!)</span>{/if}
				</div>
				{#if activeType === 'match'}
					<div class="stack">
						{#each slots as slot, i (i)}
							{@const right = guesses[i] === slot.authorId}
							<div class="slot reveal" class:ok={right} class:no={!right}>
								<div class="ans">“{slot.value}”</div>
								<div class="verdict">
									{right ? '✓' : '✗'} gættede <b>{nameOf(guesses[i])}</b>
									{#if !right}<span class="muted"> · var faktisk {nameOf(slot.authorId)}</span>{/if}
								</div>
							</div>
						{/each}
					</div>
				{:else}
					<div class="stack">
						{#each items as item, i (item.personId)}
							<div class="slot reveal" class:ok={verdicts[i]} class:no={!verdicts[i]}>
								<div class="ans">
									{#if activeType === 'drawGuess'}
										<img class="drawing small" src={item.drawing} alt="Tegning" /> <b>{item.animal}</b> (af {item.name})
									{:else if activeType === 'who'}“{item.answer}” → <b>{item.name}</b>
									{:else}<b>{item.name}</b> → “{item.answer}”{/if}
								</div>
								<div class="verdict">{verdicts[i] ? '✓ rigtigt' : '✗ forkert'}</div>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
			<button onclick={newRound} style="margin-top:1rem">Næste runde →</button>
		{/if}
	</div>

	<div class="card">
		<h3>Stilling</h3>
		<Scoreboard compact />
	</div>
</section>

<style>
	.types {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		margin-bottom: 0.75rem;
	}
	.type {
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		color: var(--text);
		font-weight: 600;
		font-size: 0.9rem;
	}
	.type.active {
		background: var(--accent);
		color: #2a1c00;
		border-color: var(--accent);
	}
	.grid2 {
		display: grid;
		gap: 1rem;
		grid-template-columns: 1fr 1fr;
	}
	label span {
		display: block;
		margin-bottom: 0.3rem;
	}
	.status {
		margin: 0.85rem 0;
	}
	.banner {
		background: var(--accent-soft);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.75rem 1rem;
		margin-bottom: 0.5rem;
	}
	.banner.result {
		background: #1c2a20;
		border-color: var(--good);
	}
	.qtext {
		font-size: 1.15rem;
		font-weight: 600;
		margin: 0.5rem 0 1rem;
	}
	.slot {
		display: grid;
		grid-template-columns: 1fr minmax(160px, 220px);
		gap: 0.75rem;
		align-items: center;
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.6rem 0.75rem;
	}
	.slot .ans {
		font-style: italic;
	}
	.slot.reveal {
		grid-template-columns: 1fr;
	}
	.slot.judge {
		grid-template-columns: 1fr;
		gap: 0.4rem;
	}
	.slot.judge .show {
		font-size: 1.1rem;
		font-weight: 600;
	}
	.slot.judge .prompt {
		font-size: 0.9rem;
	}
	.facit {
		padding-top: 0.2rem;
	}
	.controls {
		gap: 0.5rem;
	}
	.controls .sel {
		outline: 2px solid var(--text);
	}
	.slot.ok {
		border-color: var(--good);
	}
	.slot.no {
		border-color: var(--bad);
	}
	.verdict {
		margin-top: 0.3rem;
	}
	.drawing {
		width: 100%;
		max-width: 360px;
		background: #fff;
		border: 1px solid var(--border);
		border-radius: 8px;
		display: block;
	}
	.drawing.small {
		max-width: 90px;
		display: inline-block;
		vertical-align: middle;
	}
	.gallery {
		display: grid;
		gap: 0.85rem;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
	}
	.draw-card {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.5rem;
		background: var(--bg-elevated);
	}
	.draw-card.ranked {
		border-color: var(--accent);
	}
	.draw-card .drawing {
		max-width: 100%;
	}
	.draw-card .who {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		margin: 0.4rem 0;
	}
	.draw-card .dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
	}
	.medals {
		display: flex;
		gap: 0.3rem;
	}
	.medal {
		flex: 1;
		background: var(--bg-card);
		border: 1px solid var(--border);
		padding: 0.3rem;
		filter: grayscale(0.7);
		opacity: 0.7;
	}
	.medal.sel {
		filter: none;
		opacity: 1;
		border-color: var(--accent);
		background: var(--accent-soft);
	}
	@media (max-width: 560px) {
		.grid2,
		.slot {
			grid-template-columns: 1fr;
		}
	}
</style>
