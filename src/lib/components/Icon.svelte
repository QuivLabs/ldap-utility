<script lang="ts">
	import { icon } from '$lib/icons';

	let {
		name,
		size = 20,
		variant = 'regular' as 'regular' | 'filled',
		class: className = ''
	}: {
		name: string;
		size?: number;
		variant?: 'regular' | 'filled';
		class?: string;
	} = $props();

	const svg = $derived(icon(name, size, variant));
</script>

{#if svg}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -->
	{@html svg.replace('<svg ', `<svg class="${className}" `)}
{/if}
