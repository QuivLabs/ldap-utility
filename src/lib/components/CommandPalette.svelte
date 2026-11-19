<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { icon } from '$lib/icons';
	import { tools } from '$lib/nav';
	import { setAppearance, type Appearance } from '$lib/appearance.svelte';

	let {
		open = $bindable(false)
	}: {
		open?: boolean;
	} = $props();

	let query = $state('');
	let selected = $state(0);
	let dialog: HTMLDialogElement | undefined = $state();

	type Command = {
		label: string;
		description: string;
		group: string;
		glyph: string;
		run: () => void;
	};

	const commands = $derived.by((): Command[] => {
		const items: Command[] = tools.map((tool) => ({
			label: tool.label,
			description: $page.url.pathname === tool.href ? 'Current page' : 'Open tool',
			group: 'Navigate',
			glyph: icon(tool.icon, 20, $page.url.pathname === tool.href ? 'filled' : 'regular'),
			run: () => goto(tool.href)
		}));

		items.push({
			label: 'Help & user guide',
			description: 'Instructions and user guide',
			group: 'Navigate',
			glyph: icon('BookOpen'),
			run: () => document.querySelector<HTMLElement>('[data-info="help"]')?.click()
		});

		for (const [label, value, glyph] of [
			['Use light theme', 'light', 'WeatherSunny'],
			['Use dark theme', 'dark', 'WeatherMoon'],
			['Follow system theme', 'system', 'Desktop']
		] as const) {
			items.push({
				label,
				description: 'Change appearance on this device',
				group: 'Appearance',
				glyph: icon(glyph),
				run: () => setAppearance(value as Appearance)
			});
		}

		return items;
	});

	const filtered = $derived(
		commands.filter((command) =>
			`${command.label} ${command.description}`.toLowerCase().includes(query.trim().toLowerCase())
		)
	);

	$effect(() => {
		if (open) {
			query = '';
			selected = 0;
			queueMicrotask(() => dialog?.showModal());
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	function close() {
		open = false;
	}

	function run(index: number) {
		const command = filtered[index];
		if (!command) return;
		close();
		command.run();
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
			event.preventDefault();
			if (!filtered.length) return;
			selected = (selected + (event.key === 'ArrowDown' ? 1 : -1) + filtered.length) % filtered.length;
		}
		if (event.key === 'Enter' && filtered[selected]) {
			event.preventDefault();
			run(selected);
		}
	}
</script>

<dialog
	bind:this={dialog}
	class="info-dialog command-dialog"
	aria-labelledby="command-title"
	onclose={close}
	onclick={(event) => {
		if (event.target === dialog) close();
	}}
>
	<h2 id="command-title" class="sr-only">Search tools and actions</h2>
	<div class="command-search">
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html icon('Search')}
		<label for="command-query" class="sr-only">Search tools and actions</label>
		<input
			id="command-query"
			placeholder="Where would you like to go?"
			autocomplete="off"
			role="combobox"
			aria-autocomplete="list"
			aria-expanded="true"
			aria-controls="command-results"
			bind:value={query}
			oninput={() => (selected = 0)}
			onkeydown={onKeydown}
		/>
		<button type="button" class="btn-icon" aria-label="Close search" title="Close search (Esc)" onclick={close}>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html icon('Dismiss')}
		</button>
	</div>
	<div id="command-results" class="command-results" role="listbox" aria-label="Tools and actions">
		{#each filtered as command, index (command.label + command.group)}
			{#if index === 0 || filtered[index - 1].group !== command.group}
				<div class="command-group" role="presentation">{command.group}</div>
			{/if}
			<button
				type="button"
				class="command-option"
				role="option"
				id={`command-option-${index}`}
				aria-selected={index === selected}
				tabindex={-1}
				onclick={() => run(index)}
			>
				<!-- eslint-disable-next-line svelte/no-at-html-tags -->
				{@html command.glyph}
				<span>{command.label}<span class="command-description">{command.description}</span></span>
				<kbd>Enter</kbd>
			</button>
		{:else}
			<p class="command-empty">No matching actions. Try “CSV”, “cleaner”, or “theme”.</p>
		{/each}
	</div>
	<span id="command-count" class="sr-only" role="status">{filtered.length} actions available</span>
	<div class="command-footer">
		<span><kbd>↑</kbd><kbd>↓</kbd> to navigate <kbd>Enter</kbd> to open</span>
		<span><kbd>Esc</kbd> to close</span>
	</div>
</dialog>
