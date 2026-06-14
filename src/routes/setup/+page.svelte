<script lang="ts">
	import {
		game,
		adjustBonus,
		setAdminCredentials,
		generateMissingLogins,
		resetContestantPassword,
		accountForContestant,
		setContestantHiddenQuestions,
		answerFor,
		deleteAnswer,
		syncConfigChanges,
		cleanupContestant,
		resetEverything,
		replaceState
	} from '$lib/stores';
	import { config } from '$lib/config';
	import type { AnimalMode, GameState } from '$lib/types';

	let admin = $derived($game.accounts.find((a) => a.role === 'admin'));
	let drawingQuestions = $derived($game.questions.filter((q) => q.kind === 'drawing'));
	let confirmUnlock = $state(''); // "<questionId>|<contestantId>" awaiting confirmation

	function setQuestionKind(id: string, isDrawing: boolean) {
		game.update((s) => {
			const q = s.questions.find((q) => q.id === id);
			if (!q) return s;
			if (isDrawing) {
				q.kind = 'drawing';
				if (!q.animalMode) q.animalMode = 'random';
			} else {
				q.kind = undefined;
				q.animalMode = undefined;
				q.animal = undefined;
			}
			return s;
		});
		syncConfigChanges();
	}
	function setAnimalMode(id: string, mode: AnimalMode) {
		game.update((s) => {
			const q = s.questions.find((q) => q.id === id);
			if (q) q.animalMode = mode;
			return s;
		});
		syncConfigChanges();
	}
	function setAnimal(id: string, animal: string) {
		game.update((s) => {
			const q = s.questions.find((q) => q.id === id);
			if (q) q.animal = animal;
			return s;
		});
		syncConfigChanges();
	}
	function setSeconds(id: string, value: string) {
		game.update((s) => {
			const q = s.questions.find((q) => q.id === id);
			if (q) {
				const n = Number(value);
				q.seconds = n > 0 ? n : undefined;
			}
			return s;
		});
		syncConfigChanges();
	}

	let loginsText = $derived(
		$game.contestants
			.map((c) => {
				const a = accountForContestant($game, c.id);
				return a
					? `${c.name}: brugernavn "${a.username}", kode "${a.password || a.username}"`
					: `${c.name}: (intet login endnu)`;
			})
			.join('\n')
	);

	let copied = $state('');
	async function copy(text: string, label: string) {
		try {
			await navigator.clipboard.writeText(text);
			copied = label;
			setTimeout(() => (copied = copied === label ? '' : copied), 1500);
		} catch {
			/* clipboard blocked — user can select manually */
		}
	}

	function toggleQuestionForContestant(contestantId: string, questionId: string, on: boolean) {
		const c = $game.contestants.find((c) => c.id === contestantId);
		const hidden = new Set(c?.hiddenQuestionIds ?? []);
		if (on) hidden.delete(questionId);
		else hidden.add(questionId);
		setContestantHiddenQuestions(contestantId, [...hidden]);
	}

	function hasQuestion(contestantId: string, questionId: string): boolean {
		const c = $game.contestants.find((c) => c.id === contestantId);
		return !(c?.hiddenQuestionIds ?? []).includes(questionId); // everyone gets all by default
	}

	function uid(prefix: string) {
		return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
	}

	// ---- Teams ----
	function setTeam(id: string, field: 'name' | 'color', value: string) {
		game.update((s) => {
			const t = s.teams.find((t) => t.id === id);
			if (t) t[field] = value;
			return s;
		});
		syncConfigChanges();
	}

	// ---- Contestants ----
	function addContestant() {
		game.update((s) => {
			s.contestants.push({ id: uid('c'), name: 'Ny deltager', teamId: s.teams[0]?.id ?? '' });
			return s;
		});
		syncConfigChanges();
	}
	function setContestant(id: string, field: 'name' | 'teamId', value: string) {
		game.update((s) => {
			const c = s.contestants.find((c) => c.id === id);
			if (c) (c[field] as string) = value;
			return s;
		});
		syncConfigChanges();
	}
	function removeContestant(id: string) {
		game.update((s) => {
			s.contestants = s.contestants.filter((c) => c.id !== id);
			s.answers = s.answers.filter((a) => a.contestantId !== id);
			s.tasks = s.tasks.filter((t) => t.contestantId !== id);
			return s;
		});
		cleanupContestant(id); // syncs config + removes their answers/login from the backend
	}

	// ---- Questions ----
	function addQuestion() {
		game.update((s) => {
			s.questions.push({ id: uid('q'), text: 'Nyt spørgsmål?' });
			return s;
		});
		syncConfigChanges();
	}
	function setQuestion(id: string, text: string) {
		game.update((s) => {
			const q = s.questions.find((q) => q.id === id);
			if (q) q.text = text;
			return s;
		});
		syncConfigChanges();
	}
	function removeQuestion(id: string) {
		game.update((s) => {
			s.questions = s.questions.filter((q) => q.id !== id);
			s.answers = s.answers.filter((a) => a.questionId !== id);
			return s;
		});
		syncConfigChanges();
	}

	// ---- Tasks ----
	function addTask() {
		game.update((s) => {
			s.tasks.push({
				id: uid('t'),
				description: 'Ny opgave',
				contestantId: s.contestants[0]?.id ?? '',
				points: 5,
				completed: false
			});
			return s;
		});
		syncConfigChanges();
	}
	function setTask(id: string, field: 'description' | 'contestantId' | 'points', value: string) {
		game.update((s) => {
			const t = s.tasks.find((t) => t.id === id);
			if (!t) return s;
			if (field === 'points') t.points = Number(value) || 0;
			else if (field === 'contestantId') t.contestantId = value;
			else t.description = value;
			return s;
		});
		syncConfigChanges();
	}
	function removeTask(id: string) {
		game.update((s) => {
			s.tasks = s.tasks.filter((t) => t.id !== id);
			return s;
		});
		syncConfigChanges();
	}

	// ---- Danger zone ----
	let confirmingReset = $state(false);
	function reset() {
		resetEverything();
		confirmingReset = false;
	}
	function clearRounds() {
		game.update((s) => {
			s.rounds = [];
			s.bonus = Object.fromEntries(s.teams.map((t) => [t.id, 0]));
			return s;
		});
		syncConfigChanges();
	}

	// ---- Export / import ----
	let importText = $state('');
	let importError = $state('');

	function exportJson() {
		const blob = new Blob([JSON.stringify($game, null, 2)], { type: 'application/json' });
		const url = URL.createObjectURL(blob);
		const a = document.createElement('a');
		a.href = url;
		a.download = 'pubcrawl-data.json';
		a.click();
		URL.revokeObjectURL(url);
	}
	function importJson() {
		importError = '';
		try {
			const parsed = JSON.parse(importText) as GameState;
			if (!parsed.teams || !parsed.contestants || !parsed.questions) {
				throw new Error('Mangler påkrævede felter (hold/deltagere/spørgsmål).');
			}
			replaceState(parsed);
			importText = '';
		} catch (e) {
			importError = e instanceof Error ? e.message : 'Ugyldig JSON.';
		}
	}
</script>

<section class="stack">
	<div class="card">
		<h2>Hold</h2>
		{#each $game.teams as t (t.id)}
			<div class="row">
				<input type="color" style="width:48px; padding:2px" value={t.color}
					oninput={(e) => setTeam(t.id, 'color', e.currentTarget.value)} />
				<input value={t.name} oninput={(e) => setTeam(t.id, 'name', e.currentTarget.value)} />
				<div class="row" style="gap:0.3rem">
					<button class="ghost" onclick={() => adjustBonus(t.id, -1)}>−</button>
					<span class="pill" style="background:{t.color}">bonus {$game.bonus[t.id] ?? 0}</span>
					<button class="ghost" onclick={() => adjustBonus(t.id, 1)}>＋</button>
				</div>
			</div>
		{/each}
	</div>

	<div class="card">
		<div class="row" style="justify-content:space-between">
			<h2 style="margin:0">Deltagere</h2>
			<button class="ghost" onclick={addContestant}>+ Tilføj</button>
		</div>
		{#each $game.contestants as c (c.id)}
			<div class="row">
				<input value={c.name} oninput={(e) => setContestant(c.id, 'name', e.currentTarget.value)} />
				<select style="max-width:200px" value={c.teamId}
					onchange={(e) => setContestant(c.id, 'teamId', e.currentTarget.value)}>
					{#each $game.teams as t (t.id)}<option value={t.id}>{t.name}</option>{/each}
				</select>
				<button class="ghost" onclick={() => removeContestant(c.id)}>✕</button>
			</div>
		{/each}
	</div>

	<div class="card">
		<div class="row" style="justify-content:space-between">
			<h2 style="margin:0">Spørgsmål</h2>
			<button class="ghost" onclick={addQuestion}>+ Tilføj</button>
		</div>
		{#each $game.questions as q (q.id)}
			<div class="qblock">
				<div class="row">
					<input value={q.text} oninput={(e) => setQuestion(q.id, e.currentTarget.value)} />
					<button class="ghost" onclick={() => removeQuestion(q.id)}>✕</button>
				</div>
				<div class="row" style="margin-top:0.4rem">
					<select
						style="max-width:150px"
						value={q.kind === 'drawing' ? 'drawing' : 'text'}
						onchange={(e) => setQuestionKind(q.id, e.currentTarget.value === 'drawing')}
					>
						<option value="text">Tekstsvar</option>
						<option value="drawing">Tegning</option>
					</select>
					{#if q.kind === 'drawing'}
						<select
							style="max-width:220px"
							value={q.animalMode ?? 'random'}
							onchange={(e) => setAnimalMode(q.id, e.currentTarget.value as AnimalMode)}
						>
							<option value="random">Tilfældigt dyr (gæt)</option>
							<option value="fixed">Fast dyr (mor bedømmer)</option>
						</select>
						{#if q.animalMode === 'fixed'}
							<input
								style="max-width:160px"
								list="animal-list"
								placeholder="Dyr, fx Elefant"
								value={q.animal ?? ''}
								oninput={(e) => setAnimal(q.id, e.currentTarget.value)}
							/>
						{/if}
						<input
							type="number"
							min="3"
							style="width:95px"
							placeholder="sek"
							title="Sekunder (tom = standard for typen)"
							value={q.seconds ?? ''}
							oninput={(e) => setSeconds(q.id, e.currentTarget.value)}
						/>
					{/if}
				</div>
			</div>
		{/each}
		<datalist id="animal-list">
			{#each config.animals as a (a)}<option value={a}></option>{/each}
		</datalist>
	</div>

	<div class="card">
		<div class="row" style="justify-content:space-between">
			<h2 style="margin:0">Opgaver</h2>
			<button class="ghost" onclick={addTask}>+ Tilføj</button>
		</div>
		{#each $game.tasks as task (task.id)}
			<div class="row">
				<input style="flex:2; min-width:160px" value={task.description}
					oninput={(e) => setTask(task.id, 'description', e.currentTarget.value)} />
				<select style="max-width:160px" value={task.contestantId}
					onchange={(e) => setTask(task.id, 'contestantId', e.currentTarget.value)}>
					{#each $game.contestants as c (c.id)}<option value={c.id}>{c.name}</option>{/each}
				</select>
				<input type="number" min="0" style="width:80px" value={task.points}
					oninput={(e) => setTask(task.id, 'points', e.currentTarget.value)} />
				<button class="ghost" onclick={() => removeTask(task.id)}>✕</button>
			</div>
		{/each}
	</div>

	<div class="card">
		<h2>Logins &amp; adgang</h2>
		<p class="note">
			⚠️ Indtil der er en server, ligger adgangskoder i klartekst i browseren. Det styrer hvad folk
			ser, men er ikke rigtig sikkerhed. Brug det kun til at holde vennerne i deres egen bane.
		</p>

		<h3 style="margin-top:1rem">Din taskmaster-login</h3>
		<div class="row">
			<input
				style="max-width:200px"
				value={admin?.username ?? ''}
				oninput={(e) => setAdminCredentials(e.currentTarget.value, admin?.password ?? '')}
			/>
			<input
				style="max-width:200px"
				value={admin?.password ?? ''}
				oninput={(e) => setAdminCredentials(admin?.username ?? '', e.currentTarget.value)}
			/>
		</div>

		<div class="row" style="justify-content:space-between; margin-top:1.25rem">
			<h3 style="margin:0">Deltager-logins</h3>
			<div class="row" style="gap:0.4rem">
				<button class="ghost" onclick={() => copy(loginsText, 'all')}>
					{copied === 'all' ? '✓ Kopieret' : 'Kopiér alle'}
				</button>
				<button onclick={generateMissingLogins}>Generér manglende</button>
			</div>
		</div>

		{#each $game.contestants as c (c.id)}
			{@const acc = accountForContestant($game, c.id)}
			<div class="login-row">
				<span class="who">{c.name}</span>
				{#if acc}
					<code class="cred">{acc.username}</code>
					<code class="cred">{acc.password || acc.username}</code>
					<button class="ghost sm" onclick={() => copy(`${acc.username} / ${acc.password || acc.username}`, c.id)}>
						{copied === c.id ? '✓' : 'Kopiér'}
					</button>
					<button class="ghost sm" onclick={() => resetContestantPassword(c.id)} title="Nyt kodeord">↻</button>
				{:else}
					<span class="muted">intet login</span>
					<button class="ghost sm" onclick={() => resetContestantPassword(c.id)}>Opret</button>
				{/if}
			</div>
		{/each}
	</div>

	<div class="card">
		<h2>Spørgsmål pr. deltager</h2>
		<p class="muted">
			Vælg hvilke spørgsmål hver deltager får. Ingen markeringer = alle spørgsmål (standard).
		</p>
		{#each $game.contestants as c (c.id)}
			<details class="qassign">
				<summary>{c.name}</summary>
				<div class="checks">
					{#each $game.questions as q (q.id)}
						<label class="check">
							<input
								type="checkbox"
								checked={hasQuestion(c.id, q.id)}
								onchange={(e) => toggleQuestionForContestant(c.id, q.id, e.currentTarget.checked)}
							/>
							<span>{q.text}</span>
						</label>
					{/each}
				</div>
			</details>
		{/each}
	</div>

	<div class="card">
		<h2>Tegninger — lås op pr. spiller</h2>
		<p class="muted">
			Hver tegning hentes fra storage og vises som miniature. Sletter du en spillers tegning, er der
			ingen post i storage længere — så åbnes deres canvas igen, og de kan tegne på ny.
		</p>
		{#if drawingQuestions.length === 0}
			<p class="muted">Ingen tegnespørgsmål endnu.</p>
		{/if}
		{#each drawingQuestions as q (q.id)}
			<h3 style="margin-top:1rem">{q.text}</h3>
			{#each $game.contestants as c (c.id)}
				{@const ans = answerFor($game, q.id, c.id)}
				{@const key = `${q.id}|${c.id}`}
				<div class="login-row">
					<span class="who">{c.name}</span>
					{#if ans?.locked && ans.value}
						<img class="dthumb" src={ans.value} alt="tegning af {c.name}" />
						<span class="muted">{ans.animal}</span>
						{#if confirmUnlock === key}
							<button class="danger sm" onclick={() => { deleteAnswer(q.id, c.id); confirmUnlock = ''; }}>
								Bekræft sletning
							</button>
							<button class="ghost sm" onclick={() => (confirmUnlock = '')}>Fortryd</button>
						{:else}
							<button class="ghost sm" onclick={() => (confirmUnlock = key)}>Lås op</button>
						{/if}
					{:else}
						<span class="muted">ikke tegnet endnu · canvas er åben</span>
					{/if}
				</div>
			{/each}
		{/each}
	</div>

	<div class="card">
		<h2>Data</h2>
		<div class="row">
			<button class="ghost" onclick={exportJson}>⬇ Eksportér JSON</button>
			<button class="ghost" onclick={clearRounds}>Ryd runder &amp; bonus</button>
			{#if confirmingReset}
				<button class="danger" onclick={reset}>Bekræft nulstilling</button>
				<button class="ghost" onclick={() => (confirmingReset = false)}>Annullér</button>
			{:else}
				<button class="danger" onclick={() => (confirmingReset = true)}>Nulstil alt</button>
			{/if}
		</div>
		<details style="margin-top:1rem">
			<summary class="muted">Importér JSON</summary>
			<textarea rows="5" placeholder="Indsæt eksporteret JSON her…" bind:value={importText}
				style="margin-top:0.5rem"></textarea>
			{#if importError}<p style="color:var(--bad)">{importError}</p>{/if}
			<button onclick={importJson} disabled={!importText.trim()} style="margin-top:0.5rem">Importér &amp; erstat</button>
		</details>
	</div>
</section>

<style>
	.qblock {
		border-top: 1px solid var(--border);
		padding: 0.6rem 0;
	}
	.note {
		background: var(--accent-soft);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.6rem 0.85rem;
		font-size: 0.9rem;
	}
	.login-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.4rem 0;
		border-top: 1px solid var(--border);
		flex-wrap: wrap;
	}
	.who {
		font-weight: 600;
		min-width: 110px;
	}
	.cred {
		background: var(--bg-elevated);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 0.2rem 0.55rem;
		font-family: ui-monospace, Menlo, Consolas, monospace;
	}
	button.sm {
		padding: 0.3rem 0.6rem;
		font-size: 0.85rem;
	}
	.dthumb {
		width: 64px;
		height: 42px;
		object-fit: cover;
		border: 1px solid var(--border);
		border-radius: 6px;
		background: #fff;
	}
	.qassign {
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 0.5rem 0.85rem;
		margin-bottom: 0.5rem;
		background: var(--bg-elevated);
	}
	.qassign summary {
		cursor: pointer;
		font-weight: 600;
	}
	.checks {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-top: 0.6rem;
	}
	.check {
		display: flex;
		gap: 0.5rem;
		align-items: flex-start;
	}
	.check input {
		width: 18px;
		height: 18px;
		margin-top: 0.15rem;
		accent-color: var(--accent);
	}
</style>
