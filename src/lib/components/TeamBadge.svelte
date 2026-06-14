<script lang="ts">
	import type { Team } from '$lib/types';

	let { team, size = 'md' }: { team: Team; size?: 'sm' | 'md' } = $props();
</script>

<span class="pill" style="background:{team.color}" class:sm={size === 'sm'}>
	{team.name}
</span>

<style>
	.pill.sm {
		font-size: 0.75rem;
		padding: 0.1rem 0.55rem;
	}
</style>
