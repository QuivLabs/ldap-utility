<script lang="ts">
	let {
		open = $bindable(false),
		onAdd
	}: {
		open?: boolean;
		onAdd: (name: string) => void;
	} = $props();

	let dialog: HTMLDialogElement | undefined = $state();
	let value = $state('');
	let error = $state('');

	$effect(() => {
		if (open) {
			value = '';
			error = '';
			queueMicrotask(() => dialog?.showModal());
		} else if (dialog?.open) dialog.close();
	});

	function close() {
		open = false;
	}

	function submit(event: Event) {
		event.preventDefault();
		const cleaned = value.trim();
		if (!/^[a-z0-9_-]+$/i.test(cleaned)) {
			error = 'Enter an attribute name using letters, numbers, hyphens, or underscores.';
			return;
		}
		onAdd(cleaned);
		close();
	}
</script>

<dialog
	bind:this={dialog}
	class="info-dialog"
	aria-labelledby="attribute-dialog-title"
	onclose={close}
	onclick={(e) => {
		if (e.target === dialog) close();
	}}
>
	<h2 id="attribute-dialog-title">Add a directory attribute</h2>
	<form onsubmit={submit}>
		{#if error}
			<p class="inline-error" role="alert">{error}</p>
		{/if}
		<div class="form-group">
			<label for="attribute-name">Attribute name</label>
			<input
				id="attribute-name"
				class="input"
				autocomplete="off"
				spellcheck="false"
				bind:value
				aria-describedby="attribute-hint"
			/>
			<span class="hint" id="attribute-hint">Use letters, numbers, hyphens, or underscores.</span>
		</div>
		<div class="dialog-actions">
			<button class="btn btn-secondary" type="button" onclick={close}>Cancel</button>
			<button class="btn btn-primary" type="submit">Add attribute</button>
		</div>
	</form>
</dialog>
