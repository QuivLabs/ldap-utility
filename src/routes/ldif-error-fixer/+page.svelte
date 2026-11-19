<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import UploadZone from '$lib/components/UploadZone.svelte';
	import PageFooter from '$lib/components/PageFooter.svelte';
	import { downloadBlob } from '$lib/download';
	import { normalizeAttrName } from '$lib/ldif/normalize';
	import {
		applyFixes,
		buildFixReport,
		getPendingFallbackAttributes,
		parseErrorLog,
		splitLdifBlocks,
		type FixReport,
		type LdifBlock,
		type ParsedError
	} from '$lib/ldif-error-fixer/fix';

	let status = $state('No file selected');
	let hasFile = $state(false);
	let blocks = $state<LdifBlock[]>([]);
	let errorLog = $state('');
	let parsedErrors = $state<ParsedError[]>([]);
	let fallbackValues = $state<Record<string, string>>({});
	let pendingFallbacks = $state<Array<{ attribute: string; count: number }>>([]);
	let fixedLdif = $state('');
	let report = $state<FixReport>({ fixed: [], unresolved: [] });
	let analyzed = $state(false);
	let error = $state('');

	function onLdif(file: File, text: string) {
		blocks = splitLdifBlocks(text);
		status = `${file.name}; ${blocks.length} entries`;
		hasFile = true;
		analyzed = false;
	}

	function analyze() {
		error = '';
		if (!blocks.length) {
			error = 'Choose the submitted LDIF first.';
			return;
		}
		if (!errorLog.trim()) {
			error = 'Paste the LDAP error output before analyzing.';
			return;
		}
		parsedErrors = parseErrorLog(errorLog);
		pendingFallbacks = getPendingFallbackAttributes(blocks, parsedErrors);
		const result = applyFixes(blocks, parsedErrors, fallbackValues);
		fixedLdif = result.fixedLdifText;
		report = result.report;
		analyzed = true;
	}

	function setFallback(attr: string, value: string) {
		fallbackValues = { ...fallbackValues, [normalizeAttrName(attr)]: value };
		const result = applyFixes(blocks, parsedErrors, fallbackValues);
		fixedLdif = result.fixedLdifText;
		report = result.report;
		pendingFallbacks = getPendingFallbackAttributes(blocks, parsedErrors);
	}

	function reset() {
		status = 'No file selected';
		hasFile = false;
		blocks = [];
		errorLog = '';
		parsedErrors = [];
		fallbackValues = {};
		pendingFallbacks = [];
		fixedLdif = '';
		report = { fixed: [], unresolved: [] };
		analyzed = false;
		error = '';
	}
</script>

<svelte:head><title>Error fixer | LDIF Builder</title></svelte:head>

<header class="header">
	<div>
		<h1>Error fixer</h1>
		<p class="subtitle">Match LDAP error output to source entries and review proposed fixes.</p>
	</div>
	<div class="header-actions">
		<button class="btn btn-secondary" type="button" onclick={reset}><Icon name="ArrowCounterclockwise" />Reset</button>
	</div>
</header>

<div class="content">
	{#if error}<p class="inline-error" role="alert">{error}</p>{/if}

	<section class="card">
		<div class="card-header"><div class="step-badge">1</div><div><h2>Submitted LDIF</h2><p>The file that produced the LDAP errors</p></div></div>
		<div class="card-body">
			<UploadZone id="efLdifDropZone" label="LDIF file" accept=".ldif,.txt" status={status} hasFile={hasFile} onFile={onLdif} />
		</div>
	</section>

	<section class="card">
		<div class="card-header"><div class="step-badge">2</div><div><h2>Error log</h2><p>Paste compact lines like <code>[49] dn -> message</code></p></div></div>
		<div class="card-body">
			<textarea class="paste-textarea" bind:value={errorLog} placeholder="[68] cn=amal,ou=People,dc=example,dc=com -> Entry already exists"></textarea>
			<button class="btn btn-primary" type="button" onclick={analyze}><Icon name="ArrowSync" />Analyze and propose fixes</button>
		</div>
	</section>

	{#if pendingFallbacks.length}
		<section class="card">
			<div class="card-header"><div class="step-badge">*</div><div><h2>Fallback values</h2><p>Supply values for missing required attributes</p></div></div>
			<div class="card-body">
				{#each pendingFallbacks as item}
					<div class="form-group">
						<label for={`fb-${item.attribute}`}>{item.attribute} ({item.count})</label>
						<input
							id={`fb-${item.attribute}`}
							class="input"
							value={fallbackValues[normalizeAttrName(item.attribute)] || ''}
							oninput={(e) => setFallback(item.attribute, (e.currentTarget as HTMLInputElement).value)}
						/>
					</div>
				{/each}
			</div>
		</section>
	{/if}

	{#if analyzed}
		<section class="card">
			<div class="card-header">
				<div class="step-badge">3</div>
				<div><h2>Results</h2><p>Fixed {report.fixed.length} · Unresolved {report.unresolved.length}</p></div>
				<div class="header-actions">
					<button class="btn btn-success" type="button" disabled={!fixedLdif} onclick={() => downloadBlob(fixedLdif, 'fixed.ldif')}><Icon name="ArrowDownload" />Fixed LDIF</button>
					<button class="btn btn-secondary" type="button" onclick={() => downloadBlob(buildFixReport(report), 'error-fix-report.txt')}><Icon name="Document" />Report</button>
				</div>
			</div>
			<div class="card-body">
				{#each [...report.fixed, ...report.unresolved] as issue}
					<div class="operation-card">
						<strong>[{issue.code || '-'}] {issue.dn || '(no dn)'}</strong>
						<p class="hint">{issue.message}</p>
						<p class="hint">{issue.action || issue.reason}</p>
					</div>
				{/each}
				<pre class="preview-code">{fixedLdif}</pre>
			</div>
		</section>
	{/if}
</div>

<PageFooter />
