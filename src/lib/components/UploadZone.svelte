<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import { readFileAsText } from '$lib/download';

	let {
		id,
		label,
		hint = 'Drag a file here or choose a file',
		accept,
		status = 'No file selected',
		hasFile = false,
		iconName = 'ArrowUpload',
		iconSize = 24,
		onFile
	}: {
		id: string;
		label: string;
		hint?: string;
		accept: string;
		status?: string;
		hasFile?: boolean;
		iconName?: string;
		iconSize?: number;
		onFile: (file: File, text: string) => void;
	} = $props();

	let input: HTMLInputElement | undefined = $state();
	let dragover = $state(false);
	let busy = $state(false);
	let loadedAt = $state<number | null>(null);
	let relative = $state('');

	$effect(() => {
		if (!loadedAt) {
			relative = '';
			return;
		}
		const update = () => {
			const minutes = Math.max(0, Math.floor((Date.now() - loadedAt!) / 60000));
			const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
			if (minutes >= 10080) relative = new Date(loadedAt!).toLocaleDateString();
			else if (minutes >= 1440) relative = fmt.format(-Math.floor(minutes / 1440), 'day');
			else if (minutes >= 60) relative = fmt.format(-Math.floor(minutes / 60), 'hour');
			else if (minutes >= 1) relative = fmt.format(-minutes, 'minute');
			else relative = 'just now';
		};
		update();
		const timer = setInterval(update, 60000);
		return () => clearInterval(timer);
	});

	async function handleFile(file: File | undefined) {
		if (!file) return;
		busy = true;
		const text = await readFileAsText(file);
		busy = false;
		if (text === null) return;
		loadedAt = Date.now();
		onFile(file, text);
	}

	function openPicker() {
		input?.click();
	}
</script>

<div
	class="upload-zone"
	class:has-file={hasFile}
	class:dragover
	id={id}
	role="button"
	tabindex="0"
	aria-label={`${label}. Choose a file. Accepted formats: ${accept}`}
	aria-busy={busy}
	ondragover={(e) => {
		e.preventDefault();
		dragover = true;
	}}
	ondragleave={() => (dragover = false)}
	ondrop={(e) => {
		e.preventDefault();
		dragover = false;
		handleFile(e.dataTransfer?.files?.[0]);
	}}
	onclick={openPicker}
	onkeydown={(e) => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			openPicker();
		}
	}}
>
	<input
		bind:this={input}
		type="file"
		{accept}
		hidden
		onclick={(e) => e.stopPropagation()}
		onchange={(e) => handleFile((e.currentTarget as HTMLInputElement).files?.[0])}
	/>
	<div class="upload-icon">
		<Icon name={iconName} size={iconSize} />
	</div>
	<div class="upload-text">
		<strong>{label}</strong>
		<span>{hint}</span>
	</div>
	<span class="upload-status" role="status" aria-live="polite">{status}</span>
	{#if relative}
		<time
			class="file-updated"
			datetime={new Date(loadedAt!).toISOString()}
			title={new Date(loadedAt!).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
		>
			Loaded {relative}
		</time>
	{/if}
	<span class="hint" style="display:block;margin-block-start:var(--space-2)">
		{accept.split(',').join(', ')} files. Size is limited by available browser memory.
	</span>
</div>
