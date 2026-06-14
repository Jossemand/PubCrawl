<script lang="ts">
	// A one-shot drawing pad: click Start → the animal is revealed and a timed
	// canvas opens. When the timer hits 0 (or "Færdig" is pressed) it captures the
	// drawing as a PNG data URL and hands it back via onfinish. The parent then
	// swaps this out for the saved image, so there's no "locked" state here.

	let {
		seconds = 60,
		onstart,
		onfinish
	}: {
		seconds?: number;
		/** Called when drawing starts; returns the animal to draw. */
		onstart: () => string;
		onfinish: (dataUrl: string) => void;
	} = $props();

	const W = 640;
	const H = 420;

	let started = $state(false);
	let done = $state(false); // locked the moment drawing finishes — no second attempt
	let savedUrl = $state('');
	let animal = $state('');
	let remaining = $state(0); // set to `seconds` when drawing starts
	let canvas = $state<HTMLCanvasElement | null>(null);

	let ctx: CanvasRenderingContext2D | null = null;
	let painting = false;

	function start() {
		if (done) return; // one shot only
		animal = onstart();
		remaining = seconds;
		ctx = null;
		started = true;
	}

	// Initialise the canvas once it's in the DOM.
	$effect(() => {
		if (started && canvas && !ctx) {
			canvas.width = W;
			canvas.height = H;
			ctx = canvas.getContext('2d');
			if (ctx) {
				ctx.fillStyle = '#ffffff';
				ctx.fillRect(0, 0, W, H);
				ctx.lineWidth = 4;
				ctx.lineCap = 'round';
				ctx.lineJoin = 'round';
				ctx.strokeStyle = '#111111';
			}
		}
	});

	// Countdown while drawing.
	$effect(() => {
		if (!started) return;
		const id = setInterval(() => {
			remaining -= 1;
			if (remaining <= 0) finish();
		}, 1000);
		return () => clearInterval(id);
	});

	function point(e: PointerEvent) {
		const rect = canvas!.getBoundingClientRect();
		return {
			x: (e.clientX - rect.left) * (W / rect.width),
			y: (e.clientY - rect.top) * (H / rect.height)
		};
	}
	function down(e: PointerEvent) {
		if (!ctx) return;
		e.preventDefault();
		painting = true;
		canvas!.setPointerCapture(e.pointerId);
		const p = point(e);
		ctx.beginPath();
		ctx.moveTo(p.x, p.y);
		ctx.lineTo(p.x + 0.01, p.y); // a dot for taps
		ctx.stroke();
	}
	function move(e: PointerEvent) {
		if (!painting || !ctx) return;
		e.preventDefault();
		const p = point(e);
		ctx.lineTo(p.x, p.y);
		ctx.stroke();
	}
	function up() {
		painting = false;
	}
	function clearCanvas() {
		if (!ctx) return;
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, W, H);
	}
	function finish() {
		if (done) return;
		const url = canvas ? canvas.toDataURL('image/png') : '';
		savedUrl = url;
		done = true;
		started = false;
		ctx = null;
		onfinish(url);
	}
</script>

{#if done}
	<div class="locked">
		<img class="thumb" src={savedUrl} alt="Din tegning" />
		<div>
			<div class="lockbadge">🔒 Låst</div>
			<p class="muted" style="margin:0.2rem 0 0">Du tegnede: <b>{animal}</b></p>
		</div>
	</div>
{:else if started}
	<div class="bar">
		<span class="time" class:warn={remaining <= 10}>⏳ {remaining}s</span>
		<span class="animal">Tegn: <b>{animal}</b></span>
	</div>
	<canvas
		bind:this={canvas}
		onpointerdown={down}
		onpointermove={move}
		onpointerup={up}
		onpointerleave={up}
	></canvas>
	<div class="row" style="margin-top:0.6rem">
		<button class="ghost" onclick={clearCanvas}>Ryd</button>
		<button onclick={finish}>Færdig</button>
	</div>
{:else}
	<button onclick={start}>🎨 Start tegning ({seconds}s)</button>
{/if}

<style>
	.bar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}
	.time {
		font-weight: 800;
		font-variant-numeric: tabular-nums;
		font-size: 1.2rem;
	}
	.time.warn {
		color: var(--bad);
	}
	.animal {
		font-size: 1.1rem;
	}
	canvas {
		width: 100%;
		max-width: 100%;
		aspect-ratio: 640 / 420;
		background: #fff;
		border: 2px solid var(--border);
		border-radius: 10px;
		touch-action: none;
		cursor: crosshair;
		display: block;
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
</style>
