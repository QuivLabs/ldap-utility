<script lang="ts">
	import { infoContent } from '$lib/nav';

	let {
		kind = $bindable<null | keyof typeof infoContent>(null)
	}: {
		kind?: null | keyof typeof infoContent;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	const info = $derived(kind ? infoContent[kind] : null);

	$effect(() => {
		if (kind && info) {
			queueMicrotask(() => dialog?.showModal());
		} else if (dialog?.open) {
			dialog.close();
		}
	});

	function close() {
		kind = null;
	}
</script>

{#if info}
	<dialog
		bind:this={dialog}
		class="info-dialog"
		aria-labelledby="dialog-title"
		onclose={close}
		onclick={(event) => {
			if (event.target === dialog) close();
		}}
	>
		<h2 id="dialog-title">{info.title}</h2>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		{@html info.html}
		<form method="dialog" class="dialog-actions">
			<button class="btn btn-secondary" autofocus onclick={close}>Close</button>
		</form>
	</dialog>
{/if}
