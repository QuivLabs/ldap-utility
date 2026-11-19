<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import UploadZone from '$lib/components/UploadZone.svelte';
	import PageFooter from '$lib/components/PageFooter.svelte';
	import { downloadBlob } from '$lib/download';
	import { normalizeAttrName } from '$lib/ldif/normalize';
	import type { LdifEntry } from '$lib/ldif/parse';
	import {
		applyFixOperations,
		buildDuplicatesReport,
		entriesToLdif,
		findDuplicates,
		getImportantAttributes,
		parseLdif,
		type DuplicateInfo,
		type FixOperation
	} from '$lib/ldif-cleaner/ops';

	let mode = $state<'fix' | 'dedup'>('fix');
	let fixStatus = $state('No file selected');
	let fixHasFile = $state(false);
	let fixContent = $state('');
	let fixEntries = $state<LdifEntry[]>([]);
	let fixedEntries = $state<LdifEntry[]>([]);
	let fixOps = $state<FixOperation[]>([]);
	let opId = $state(0);
	let repeatable = $state(new Set(['objectclass', 'replace']));
	let preset = $state('objectClass');
	let customRepeatable = $state('');
	let extractStatus = $state('No file selected');
	let extractHas = $state(false);
	let extractEntries = $state<LdifEntry[]>([]);
	let masterStatus = $state('No file selected');
	let masterHas = $state(false);
	let masterEntries = $state<LdifEntry[]>([]);
	let cleaned = $state<LdifEntry[]>([]);
	let duplicates = $state<DuplicateInfo[]>([]);
	let stats = $state({ totalEntries: 0, duplicatesFound: 0, cleanedCount: 0 });
	let fixedLdif = $state('');
	let cleanedLdif = $state('');
	let error = $state('');

	function onFix(file: File, text: string) {
		fixContent = text;
		fixEntries = parseLdif(text);
		fixStatus = `${file.name}; ${fixEntries.length} entries`;
		fixHasFile = true;
		reapplyFixes();
	}

	function reapplyFixes() {
		fixedEntries = applyFixOperations(fixEntries, fixOps, repeatable);
		fixedLdif = entriesToLdif(fixedEntries);
	}

	function addOp() {
		fixOps = [...fixOps, { id: ++opId, field: 'mail', action: 'replace', value: '' }];
		reapplyFixes();
	}

	function updateOp<K extends keyof FixOperation>(id: number, field: K, value: FixOperation[K]) {
		fixOps = fixOps.map((op) => (op.id === id ? { ...op, [field]: value } : op));
		reapplyFixes();
	}

	function removeOp(id: number) {
		fixOps = fixOps.filter((op) => op.id !== id);
		reapplyFixes();
	}

	function onExtract(file: File, text: string) {
		extractEntries = parseLdif(text);
		extractStatus = `${file.name}; ${extractEntries.length} entries`;
		extractHas = true;
		runDedup();
	}

	function onMaster(file: File, text: string) {
		masterEntries = parseLdif(text);
		masterStatus = `${file.name}; ${masterEntries.length} entries`;
		masterHas = true;
		runDedup();
	}

	function runDedup() {
		if (!extractEntries.length || !masterEntries.length) return;
		const result = findDuplicates(masterEntries, extractEntries);
		duplicates = result.duplicates;
		cleaned = result.cleanedEntries;
		stats = result.stats;
		cleanedLdif = entriesToLdif(cleaned);
	}

	function reset() {
		mode = 'fix';
		fixStatus = 'No file selected';
		fixHasFile = false;
		fixContent = '';
		fixEntries = [];
		fixedEntries = [];
		fixOps = [];
		opId = 0;
		repeatable = new Set(['objectclass', 'replace']);
		extractStatus = 'No file selected';
		extractHas = false;
		extractEntries = [];
		masterStatus = 'No file selected';
		masterHas = false;
		masterEntries = [];
		cleaned = [];
		duplicates = [];
		stats = { totalEntries: 0, duplicatesFound: 0, cleanedCount: 0 };
		fixedLdif = '';
		cleanedLdif = '';
		error = '';
	}
</script>

<svelte:head><title>LDIF cleaner | LDIF Builder</title></svelte:head>

<header class="header">
	<div>
		<h1>LDIF cleaner</h1>
		<p class="subtitle">Update attribute values or remove entries found in a comparison file.</p>
	</div>
	<div class="header-actions">
		<button class="btn btn-secondary" type="button" onclick={reset}><Icon name="ArrowCounterclockwise" />Reset</button>
	</div>
</header>

<div class="content">
	{#if error}<p class="inline-error" role="alert">{error}</p>{/if}

	<section class="card mode-selector-card">
		<div class="card-body">
			<div class="mode-selector">
				<label class="mode-option">
					<input type="radio" name="cleanMode" value="fix" bind:group={mode} />
					<div class="mode-content"><div class="mode-text"><strong>Fix attributes</strong><span>Add, replace, or remove attribute values</span></div></div>
				</label>
				<label class="mode-option">
					<input type="radio" name="cleanMode" value="dedup" bind:group={mode} />
					<div class="mode-content"><div class="mode-text"><strong>Remove duplicates</strong><span>Drop master entries also present in an extract</span></div></div>
				</label>
			</div>
		</div>
	</section>

	{#if mode === 'fix'}
		<section class="card">
			<div class="card-header"><div class="step-badge">1</div><div><h2>Choose LDIF to fix</h2></div></div>
			<div class="card-body">
				<UploadZone id="fixDropZone" label="LDIF file" accept=".ldif,.txt" status={fixStatus} hasFile={fixHasFile} onFile={onFix} />
			</div>
		</section>
		<section class="card">
			<div class="card-header">
				<div class="step-badge">2</div>
				<div><h2>Fix operations</h2></div>
				<button class="btn btn-outline btn-sm" type="button" onclick={addOp}><Icon name="Add" />Add operation</button>
			</div>
			<div class="card-body">
				<div class="literal-row">
					<label>Repeatable attributes</label>
					<div class="literal-controls">
						<select class="input" bind:value={preset}><option value="objectClass">objectClass</option><option value="replace">replace</option></select>
						<button class="btn btn-outline btn-sm" type="button" onclick={() => (repeatable = new Set([...repeatable, normalizeAttrName(preset)]))}>Add preset</button>
					</div>
					<div class="literal-controls space-before">
						<input class="input" bind:value={customRepeatable} />
						<button class="btn btn-outline btn-sm" type="button" onclick={() => { if (customRepeatable.trim()) { repeatable = new Set([...repeatable, normalizeAttrName(customRepeatable)]); customRepeatable = ''; } }}>Add custom</button>
					</div>
					<div class="selected-list space-before">
						{#each [...repeatable] as attr}
							<span class="selected-chip">{attr}
								<button type="button" onclick={() => { const n = new Set(repeatable); n.delete(attr); repeatable = n; }}>×</button>
							</span>
						{/each}
					</div>
				</div>
				{#each fixOps as op}
					<div class="operation-card">
						<div class="operation-header">
							<h4>Operation #{op.id}</h4>
							<button class="btn btn-secondary btn-sm" type="button" onclick={() => removeOp(op.id)}>Remove</button>
						</div>
						<div class="operation-row">
							<div class="form-group">
								<label>Attribute</label>
								<input class="input" value={op.field} onchange={(e) => updateOp(op.id, 'field', (e.currentTarget as HTMLInputElement).value)} />
							</div>
							<div class="form-group">
								<label>Action</label>
								<select class="input" value={op.action} onchange={(e) => updateOp(op.id, 'action', (e.currentTarget as HTMLSelectElement).value as FixOperation['action'])}>
									<option value="add">Add</option>
									<option value="replace">Replace</option>
									<option value="remove">Remove</option>
								</select>
							</div>
							<div class="form-group">
								<label>Value</label>
								<input class="input" value={op.value} onchange={(e) => updateOp(op.id, 'value', (e.currentTarget as HTMLInputElement).value)} />
							</div>
						</div>
					</div>
				{:else}
					<p class="hint">No operations yet. Add one to update attributes across every entry.</p>
				{/each}
			</div>
		</section>
		<section class="card">
			<div class="card-header">
				<div class="step-badge">3</div>
				<div><h2>Fixed output</h2></div>
				<button class="btn btn-success" type="button" disabled={!fixedLdif} onclick={() => downloadBlob(fixedLdif, 'fixed.ldif')}><Icon name="ArrowDownload" />Download</button>
			</div>
			<div class="card-body"><pre class="preview-code">{fixedLdif || 'Load an LDIF and configure operations to see output…'}</pre></div>
		</section>
	{:else}
		<section class="card">
			<div class="card-header"><div class="step-badge">1</div><div><h2>Comparison files</h2><p>Extract entries are removed from the master when DNs match.</p></div></div>
			<div class="card-body">
				<div class="upload-grid">
					<UploadZone id="extractDropZone" label="Extract LDIF" accept=".ldif,.txt" status={extractStatus} hasFile={extractHas} onFile={onExtract} />
					<UploadZone id="masterDropZone" label="Master LDIF" accept=".ldif,.txt" status={masterStatus} hasFile={masterHas} onFile={onMaster} />
				</div>
			</div>
		</section>
		<section class="card">
			<div class="card-header">
				<div class="step-badge">2</div>
				<div><h2>Results</h2></div>
				<div class="header-actions">
					<button class="btn btn-success" type="button" disabled={!cleanedLdif} onclick={() => downloadBlob(cleanedLdif, 'cleaned.ldif')}><Icon name="ArrowDownload" />Cleaned LDIF</button>
					<button class="btn btn-secondary" type="button" disabled={!duplicates.length} onclick={() => downloadBlob(buildDuplicatesReport(duplicates), 'duplicates-report.txt')}><Icon name="Document" />Duplicates report</button>
				</div>
			</div>
			<div class="card-body">
				{#if masterHas && extractHas}
					<p class="hint">Master {stats.totalEntries} · Duplicates {stats.duplicatesFound} · Remaining {stats.cleanedCount}</p>
					{#each duplicates.slice(0, 20) as dup}
						<div class="operation-card"><strong>{dup.dn}</strong><p class="hint">{getImportantAttributes(dup.original)}</p></div>
					{/each}
					{#if duplicates.length > 20}<p class="hint">Showing first 20 of {duplicates.length} duplicates.</p>{/if}
					<pre class="preview-code">{cleanedLdif || 'No cleaned output yet.'}</pre>
				{:else}
					<div class="empty-state"><p>Upload extract and master files</p></div>
				{/if}
			</div>
		</section>
	{/if}
</div>

<PageFooter />
