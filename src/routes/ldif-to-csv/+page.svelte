<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import UploadZone from '$lib/components/UploadZone.svelte';
	import PageFooter from '$lib/components/PageFooter.svelte';
	import { copyText, downloadBlob } from '$lib/download';
	import {
		convertToCsv,
		extractAttributeStats,
		getSplitPreview,
		parseLdif,
		type SplitRule
	} from '$lib/ldif-to-csv/convert';
	import type { LdifEntry } from '$lib/ldif/parse';

	let entries = $state<LdifEntry[]>([]);
	let available = $state<Array<{ name: string; count: number; percentage: number }>>([]);
	let selected = $state<string[]>([]);
	let splitRules = $state<SplitRule[]>([]);
	let status = $state('No file selected');
	let hasFile = $state(false);
	let paste = $state('');
	let delimiter = $state(',');
	let quoteChar = $state('"');
	let multiValueSeparator = $state('; ');
	let csvOutput = $state('');
	let preview = $state('Load an LDIF file to begin…');
	let error = $state('');
	let copyLabel = $state('Copy to clipboard');
	let splitOpen = $state(false);
	let splitSource = $state('');
	let splitDelimiter = $state(',');
	let splitNames = $state('part1,part2');

	function loadLdif(text: string, source: string) {
		error = '';
		entries = parseLdif(text);
		const stats = extractAttributeStats(entries);
		available = stats.available;
		selected = stats.attributes.slice();
		status = `${source}; ${entries.length} entries, ${stats.attributes.length} attributes`;
		hasFile = true;
		preview = `${entries.length} entries ready. Select attributes and convert.`;
		csvOutput = '';
	}

	function toggleAttr(name: string, checked: boolean) {
		selected = checked ? [...new Set([...selected, name])] : selected.filter((a) => a !== name);
	}

	function convert() {
		if (!entries.length) {
			error = 'Choose or paste an LDIF file first.';
			return;
		}
		if (!selected.length) {
			error = 'Select at least one attribute.';
			return;
		}
		csvOutput = convertToCsv(entries, selected, splitRules, {
			delimiter,
			quoteChar,
			multiValueSeparator
		});
		preview = csvOutput || 'No CSV output generated.';
	}

	function reset() {
		entries = [];
		available = [];
		selected = [];
		splitRules = [];
		status = 'No file selected';
		hasFile = false;
		paste = '';
		csvOutput = '';
		preview = 'Load an LDIF file to begin…';
		error = '';
	}

	function addSplitRule() {
		const columnNames = splitNames
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
		if (!splitSource || !columnNames.length) return;
		splitRules = [
			...splitRules,
			{ id: Date.now(), sourceColumn: splitSource, delimiter: splitDelimiter, columnNames, enabled: true }
		];
		splitOpen = false;
	}

	const splitPreview = $derived(
		splitSource ? getSplitPreview(entries, splitSource, splitDelimiter) : []
	);
</script>

<svelte:head><title>LDIF to CSV | LDIF Builder</title></svelte:head>

<header class="header">
	<div>
		<h1>LDIF to CSV</h1>
		<p class="subtitle">Choose directory attributes and export them as spreadsheet columns.</p>
	</div>
	<div class="header-actions">
		<button class="btn btn-secondary" type="button" onclick={reset}><Icon name="ArrowCounterclockwise" />Reset</button>
	</div>
</header>

<div class="content">
	{#if error}<p class="inline-error" role="alert">{error}</p>{/if}

	<section class="card">
		<div class="card-header">
			<div class="step-badge">1</div>
			<div><h2>Choose your LDIF</h2><p>Upload a file or paste LDIF content</p></div>
		</div>
		<div class="card-body">
			<UploadZone id="ldifDropZone" label="LDIF file" accept=".ldif,.txt" status={status} hasFile={hasFile} onFile={(f, t) => loadLdif(t, f.name)} />
			<div class="paste-section">
				<div class="paste-header">
					<span>Or paste LDIF content:</span>
					<button class="btn btn-outline btn-sm" type="button" onclick={() => (paste = '')}>Clear</button>
				</div>
				<textarea class="paste-textarea" bind:value={paste} placeholder="Paste LDIF content…"></textarea>
				<button class="btn btn-secondary" type="button" onclick={() => paste.trim() && loadLdif(paste, 'Pasted Content')}>
					<Icon name="Document" size={16} />Read LDIF
				</button>
			</div>
			<div class="settings-row">
				<div class="form-group">
					<label for="delimiter">CSV delimiter</label>
					<input id="delimiter" class="input" bind:value={delimiter} />
				</div>
				<div class="form-group">
					<label for="quoteChar">Quote character</label>
					<input id="quoteChar" class="input" bind:value={quoteChar} />
				</div>
				<div class="form-group flex-grow">
					<label for="multiValueSeparator">Multi-value separator</label>
					<input id="multiValueSeparator" class="input" bind:value={multiValueSeparator} />
				</div>
			</div>
		</div>
	</section>

	<section class="card">
		<div class="card-header">
			<div class="step-badge">2</div>
			<div><h2>Select attributes</h2><p>Choose which attributes become CSV columns</p></div>
			{#if available.length}
				<div class="header-actions">
					<button class="btn btn-outline btn-sm" type="button" onclick={() => (selected = available.map((a) => a.name))}>Select all</button>
					<button class="btn btn-outline btn-sm" type="button" onclick={() => (selected = [])}>Deselect all</button>
				</div>
			{/if}
		</div>
		<div class="card-body">
			{#if !available.length}
				<div class="empty-state"><Icon name="Table" size={48} /><p>No attributes yet</p><span>Load an LDIF file first</span></div>
			{:else}
				<p class="hint">{available.length} attributes across {entries.length} entries</p>
				<div class="attribute-list">
					{#each available as attr}
						<label class="attribute-item" class:selected={selected.includes(attr.name)}>
							<input
								type="checkbox"
								checked={selected.includes(attr.name)}
								onchange={(e) => toggleAttr(attr.name, (e.currentTarget as HTMLInputElement).checked)}
							/>
							<span>{attr.name}</span>
							<span class="badge">{attr.count} ({attr.percentage}%)</span>
						</label>
					{/each}
				</div>
			{/if}
		</div>
	</section>

	<section class="card">
		<div class="card-header">
			<div class="step-badge">3</div>
			<div><h2>Optional column splits</h2><p>Split combined values into multiple CSV columns</p></div>
			<button class="btn btn-outline btn-sm" type="button" disabled={!selected.length} onclick={() => { splitSource = selected[0] || ''; splitOpen = true; }}>
				<Icon name="Add" />Add split rule
			</button>
		</div>
		<div class="card-body">
			{#if !splitRules.length}
				<p class="hint">No split rules configured.</p>
			{:else}
				{#each splitRules as rule}
					<div class="operation-card">
						<div class="operation-header">
							<h4>{rule.sourceColumn} → {rule.columnNames.join(', ')}</h4>
							<button class="btn btn-secondary btn-sm" type="button" onclick={() => (splitRules = splitRules.filter((r) => r.id !== rule.id))}>Remove</button>
						</div>
						<label class="toggle-item">
							<input type="checkbox" checked={rule.enabled} onchange={(e) => (splitRules = splitRules.map((r) => r.id === rule.id ? { ...r, enabled: (e.currentTarget as HTMLInputElement).checked } : r))} />
							<span>Enabled (delimiter: “{rule.delimiter}”)</span>
						</label>
					</div>
				{/each}
			{/if}
		</div>
	</section>

	<section class="card">
		<div class="card-header">
			<div class="step-badge">4</div>
			<div><h2>Preview and download</h2><p>Review the CSV before saving</p></div>
			<div class="header-actions">
				<button class="btn btn-primary" type="button" onclick={convert}><Icon name="ArrowSync" />Convert to CSV</button>
				<button class="btn btn-success" type="button" disabled={!csvOutput} onclick={() => downloadBlob(csvOutput, 'output.csv', 'text/csv;charset=utf-8')}><Icon name="ArrowDownload" />Download CSV</button>
			</div>
		</div>
		<div class="card-body">
			<div class="preview-container">
				<div class="preview-header">
					<span>output.csv</span>
					<button
						class="btn-icon"
						type="button"
						title={copyLabel}
						aria-label={copyLabel}
						onclick={async () => {
							if (!csvOutput) return;
							copyLabel = (await copyText(csvOutput)) ? 'Copied to clipboard' : 'Clipboard unavailable';
							setTimeout(() => (copyLabel = 'Copy to clipboard'), 1500);
						}}
					>
						<Icon name={copyLabel.startsWith('Copied') ? 'Checkmark' : 'Copy'} />
					</button>
				</div>
				<pre class="preview-code">{preview}</pre>
			</div>
		</div>
	</section>
</div>

{#if splitOpen}
	<dialog class="info-dialog" open aria-labelledby="split-title" onclick={(e) => e.target === e.currentTarget && (splitOpen = false)}>
		<h2 id="split-title">Add column split rule</h2>
		<div class="form-group">
			<label>Source attribute</label>
			<select class="input" bind:value={splitSource}>
				{#each selected as name}<option value={name}>{name}</option>{/each}
			</select>
		</div>
		<div class="form-group">
			<label>Delimiter</label>
			<input class="input" bind:value={splitDelimiter} />
		</div>
		<div class="form-group">
			<label>Output column names (comma-separated)</label>
			<input class="input" bind:value={splitNames} />
		</div>
		{#if splitPreview.length}
			<p class="hint">Sample splits:</p>
			<pre class="preview-code">{splitPreview.map((p) => p.join(' | ')).join('\n')}</pre>
		{/if}
		<div class="dialog-actions">
			<button class="btn btn-secondary" type="button" onclick={() => (splitOpen = false)}>Cancel</button>
			<button class="btn btn-primary" type="button" onclick={addSplitRule}>Add rule</button>
		</div>
	</dialog>
{/if}

<PageFooter />
