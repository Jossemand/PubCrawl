<script lang="ts">
	// The guide rail: every step of the evening, in order, with the one you're
	// on called out. Vertical next to the content on a laptop, a swipeable
	// strip across the top on a phone — same markup, different layout.
	import { page } from '$app/stores';
	import type { JourneyStep } from '$lib/journey';

	let { steps, orientation = 'auto' }: { steps: JourneyStep[]; orientation?: 'auto' | 'vertical' } =
		$props();

	let path = $derived($page.url.pathname);
	let doneCount = $derived(steps.filter((s) => s.status === 'done').length);

	// On a phone the steps scroll sideways, so bring the one you're on into
	// view — otherwise step 1 fills the strip and "what now?" is off-screen.
	let list = $state<HTMLOListElement | null>(null);
	let currentId = $derived(steps.find((s) => s.status === 'now')?.id);
	$effect(() => {
		if (!list || !currentId) return;
		const el = list.querySelector(`[data-step="${currentId}"]`);
		el?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
	});
</script>

<nav class="timeline" class:forced-vertical={orientation === 'vertical'} aria-label="Sådan gør du">
	<div class="head">
		<span class="label">Sådan gør du</span>
		<span class="count">{doneCount}/{steps.length}</span>
	</div>

	<ol class="steps" bind:this={list}>
		{#each steps as step, i (step.id)}
			<!-- Several steps can point at the same page (most of setup does), so
			     only the step you're actually on gets the "you are here" tint. -->
			{@const active = !!step.href && path === step.href && step.status === 'now'}
			<li
				class="step {step.status}"
				class:active
				data-step={step.id}
				aria-current={step.status === 'now' ? 'step' : undefined}
			>
				<svelte:element
					this={step.href ? 'a' : 'div'}
					href={step.href}
					class="hit"
					role={step.href ? undefined : 'group'}
				>
					<span class="marker" aria-hidden="true">
						{#if step.status === 'done'}✓{:else}{i + 1}{/if}
					</span>
					<span class="body">
						<span class="title">
							{step.title}
							{#if step.meta}<span class="meta">{step.meta}</span>{/if}
						</span>
						{#if step.status === 'now'}
							<span class="blurb">{step.blurb}</span>
							{#if step.progress && step.progress.total > 0}
								<span class="bar">
									<span style="width:{(step.progress.done / step.progress.total) * 100}%"></span>
								</span>
							{/if}
						{/if}
					</span>
				</svelte:element>
			</li>
		{/each}
	</ol>
</nav>

<style>
	.timeline {
		display: flex;
		flex-direction: column;
		gap: 0.6rem;
	}

	.head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.label {
		font-size: 0.75rem;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-dim);
	}
	.count {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-dim);
		font-variant-numeric: tabular-nums;
	}

	.steps {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}

	.step {
		position: relative;
	}

	/* The connector line, drawn behind the markers. */
	.step:not(:last-child)::before {
		content: '';
		position: absolute;
		left: 13px;
		top: 30px;
		bottom: -2px;
		width: 2px;
		background: var(--border);
		border-radius: 2px;
	}
	.step.done:not(:last-child)::before {
		background: var(--good);
		opacity: 0.55;
	}

	.hit {
		position: relative;
		display: flex;
		gap: 0.7rem;
		align-items: flex-start;
		padding: 0.4rem 0.5rem 0.55rem;
		margin: 0 -0.5rem;
		border-radius: var(--radius-sm);
		color: var(--text);
		text-decoration: none;
	}
	a.hit:hover {
		background: var(--bg-sunken);
		text-decoration: none;
	}

	.marker {
		flex: none;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: grid;
		place-items: center;
		font-size: 0.8rem;
		font-weight: 700;
		background: var(--bg-card);
		border: 2px solid var(--border);
		color: var(--text-dim);
		z-index: 1;
	}
	.done .marker {
		background: var(--good);
		border-color: var(--good);
		color: #fff;
	}
	.now .marker {
		background: var(--accent);
		border-color: var(--accent);
		color: var(--on-strong);
		box-shadow: 0 0 0 4px var(--accent-ring);
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		min-width: 0;
		padding-top: 0.15rem;
	}
	.title {
		font-size: 0.92rem;
		font-weight: 600;
		line-height: 1.3;
		display: flex;
		align-items: baseline;
		gap: 0.45rem;
		flex-wrap: wrap;
	}
	.todo .title,
	.done .title {
		color: var(--text-dim);
		font-weight: 500;
	}
	.done .title {
		text-decoration: line-through;
		text-decoration-color: var(--border-strong);
	}
	.now .title {
		color: var(--text);
		font-weight: 700;
	}
	.meta {
		font-size: 0.75rem;
		font-weight: 700;
		color: var(--text-dim);
		background: var(--bg-sunken);
		border-radius: 999px;
		padding: 0.05rem 0.45rem;
		font-variant-numeric: tabular-nums;
	}
	.now .meta {
		background: var(--accent-soft);
		color: var(--accent);
	}
	.blurb {
		font-size: 0.82rem;
		color: var(--text-dim);
		line-height: 1.4;
	}

	.bar {
		display: block;
		height: 5px;
		margin-top: 0.3rem;
		border-radius: 999px;
		background: var(--bg-sunken);
		overflow: hidden;
	}
	.bar > :global(span) {
		display: block;
		height: 100%;
		background: var(--accent);
		border-radius: 999px;
		transition: width 0.35s ease;
	}

	.step.active .hit {
		background: var(--accent-soft);
	}

	/* ---- Phone / tablet: a horizontal strip you can swipe ---------------- */
	@media (max-width: 899px) {
		.timeline:not(.forced-vertical) .steps {
			flex-direction: row;
			overflow-x: auto;
			gap: 0.15rem;
			padding-bottom: 0.25rem;
			scrollbar-width: none;
			/* Fade the trailing edge so it's obvious there's more to the right. */
			mask-image: linear-gradient(to right, #000 calc(100% - 28px), transparent 100%);
		}
		.timeline:not(.forced-vertical) .steps::-webkit-scrollbar {
			display: none;
		}
		.timeline:not(.forced-vertical) .step {
			flex: 0 0 auto;
			max-width: 62vw;
		}
		/* Connector runs sideways between the markers instead. */
		.timeline:not(.forced-vertical) .step:not(:last-child)::before {
			left: auto;
			right: -2px;
			top: 19px;
			bottom: auto;
			width: 100%;
			height: 2px;
			max-width: 40px;
		}
		.timeline:not(.forced-vertical) .hit {
			flex-direction: row;
			align-items: center;
			gap: 0.5rem;
			padding: 0.35rem 0.6rem;
			margin: 0;
		}
		.timeline:not(.forced-vertical) .marker {
			width: 24px;
			height: 24px;
			font-size: 0.72rem;
		}
		/* Only the step you're on keeps its description on a narrow screen. */
		.timeline:not(.forced-vertical) .blurb {
			display: none;
		}
		.timeline:not(.forced-vertical) .title {
			white-space: nowrap;
			font-size: 0.85rem;
		}
		.timeline:not(.forced-vertical) .todo .title {
			opacity: 0.75;
		}
		.timeline:not(.forced-vertical) .bar {
			display: none;
		}
	}
</style>
