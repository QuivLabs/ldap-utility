<script lang="ts">
	import Icon from '$lib/components/Icon.svelte';
	import UploadZone from '$lib/components/UploadZone.svelte';
	import AttributeDialog from '$lib/components/AttributeDialog.svelte';
	import PageFooter from '$lib/components/PageFooter.svelte';
	import { detectDelimiter, parseCsv, extractHeaders, rowsToObjects } from '$lib/csv/parse';
	import {
		applyParentToTemplate,
		buildGroupOperationsLdif,
		buildLdif,
		buildParentDn,
		extractLdifAttributes,
		normalizeMapping
	} from '$lib/csv-to-ldif/build';
	import type { BuildResult, GroupOperation, Mapping } from '$lib/csv-to-ldif/types';
	import { copyText, downloadBlob } from '$lib/download';
	import { normalizeAttrName } from '$lib/ldif/normalize';

	let appMode = $state<'create' | 'groups'>('create');
	let csvRows = $state<Record<string, string>[]>([]);
	let csvHeaders = $state<string[]>([]);
	let csvStatus = $state('No file selected');
	let csvHasFile = $state(false);
	let ldifStatus = $state('No file selected');
	let ldifHasFile = $state(false);
	let ldifAttrs = $state<string[]>([]);
	let ldifPaste = $state('');
	let delimiter = $state(',');
	let dnTemplate = $state('dn: cn={cn},ou=People,dc=example,dc=com');
	let userRecordMode = $state<'new' | 'modify'>('new');
	let useDynamicDn = $state(false);
	let dynamicDnColumn = $state('');
	let dynamicDnTemplate = $state('ou={value}');
	let mappings = $state(new Map<string, Mapping>());
	let selectedAttribute = $state<string | null>(null);
	let literalValue = $state('');
	let concatSeparator = $state(' ');
	let concatTrim = $state(true);
	let concatSkipEmpty = $state(true);
	let useCustomSeparator = $state(false);
	let customSeparator = $state(',');
	let attrType = $state<'text' | 'dn'>('text');
	let attrDnTemplate = $state('');
	let repeatableAttrs = $state(new Set(['objectclass', 'replace']));
	let repeatablePreset = $state('objectClass');
	let customRepeatable = $state('');
	let operations = $state<GroupOperation[]>([]);
	let operationIdCounter = $state(0);
	let lastResult = $state<BuildResult | null>(null);
	let preview = $state('Upload a CSV and configure mappings to see preview...');
	let warnings = $state('');
	let warningsHidden = $state(true);
	let inlineError = $state('');
	let attrDialogOpen = $state(false);
	let copyLabel = $state('Copy to clipboard');

	const allAttrs = $derived([...new Set([...ldifAttrs])]);
	const selectedMapping = $derived(
		selectedAttribute ? normalizeMapping(mappings.get(selectedAttribute)) : null
	);
	const dynamicPreview = $derived.by(() => {
		if (!useDynamicDn || appMode !== 'create') return '';
		if (!csvRows.length) return 'Upload a CSV to see a DN preview.';
		const parentDn = buildParentDn(csvRows[0][dynamicDnColumn], dynamicDnTemplate);
		if (!parentDn) return `Row 1 has an empty "${dynamicDnColumn}" value.`;
		return 'Row 1 DN: ' + applyParentToTemplate(dnTemplate.replace(/^dn:\s*/i, ''), parentDn);
	});

	function bumpMappings() {
		mappings = new Map(mappings);
	}

	function onCsv(file: File, text: string) {
		inlineError = '';
		const firstLine = text.split(/\r?\n/)[0] || '';
		const guess = detectDelimiter(firstLine);
		delimiter = guess;
		const rows = parseCsv(text, guess);
		csvHeaders = extractHeaders(rows);
		csvRows = rowsToObjects(rows);
		csvStatus = `${file.name}; ${csvRows.length} rows, ${csvHeaders.length} columns`;
		csvHasFile = true;
		if (!dynamicDnColumn || !csvHeaders.includes(dynamicDnColumn)) {
			dynamicDnColumn =
				csvHeaders.find((h) => /parent|^ou$|org|dept|department|manager.?dn/i.test(h)) ||
				csvHeaders[0] ||
				'';
		}
	}

	function processLdifText(text: string, sourceName: string) {
		ldifAttrs = extractLdifAttributes(text);
		ldifStatus = ldifAttrs.length
			? `${sourceName}; ${ldifAttrs.length} attributes found`
			: `${sourceName}; No attributes detected`;
		ldifHasFile = true;
	}

	function onLdif(file: File, text: string) {
		processLdifText(text, file.name);
	}

	function selectAttr(attr: string) {
		selectedAttribute = attr;
		const m = normalizeMapping(mappings.get(attr));
		concatSeparator = m.separator;
		concatTrim = m.trim;
		concatSkipEmpty = m.skipEmptyParts;
		useCustomSeparator = m.useCustomSeparator;
		customSeparator = m.customSeparator;
		attrType = m.attrType;
		attrDnTemplate = m.dnTemplate || dnTemplate.replace(/^dn:\s*/i, '').replace(/\{[^}]+\}/, '{value}');
		literalValue = '';
	}

	function toggleCsvColumn(col: string) {
		if (!selectedAttribute) return;
		const mapping = normalizeMapping(mappings.get(selectedAttribute));
		const idx = mapping.sourceParts.findIndex((p) => p.type === 'csv' && p.value === col);
		if (idx > -1) mapping.sourceParts.splice(idx, 1);
		else mapping.sourceParts.push({ type: 'csv', value: col });
		if (mapping.sourceParts.length) mappings.set(selectedAttribute, mapping);
		else mappings.delete(selectedAttribute);
		bumpMappings();
	}

	function removePart(type: string, value: string) {
		if (!selectedAttribute) return;
		const mapping = normalizeMapping(mappings.get(selectedAttribute));
		mapping.sourceParts = mapping.sourceParts.filter((p) => !(p.value === value && p.type === type));
		if (!mapping.sourceParts.length) mappings.delete(selectedAttribute);
		else mappings.set(selectedAttribute, mapping);
		bumpMappings();
	}

	function syncMappingFields() {
		if (!selectedAttribute) return;
		const current = normalizeMapping(mappings.get(selectedAttribute));
		mappings.set(selectedAttribute, {
			...current,
			separator: concatSeparator,
			trim: concatTrim,
			skipEmptyParts: concatSkipEmpty,
			attrType,
			dnTemplate: attrDnTemplate,
			useCustomSeparator,
			customSeparator
		});
		bumpMappings();
	}

	function addLiteral() {
		if (!selectedAttribute) return;
		const trimmed = literalValue.trim();
		if (!trimmed) return;
		const mapping = normalizeMapping(mappings.get(selectedAttribute));
		mapping.sourceParts.push({ type: 'literal', value: trimmed });
		mappings.set(selectedAttribute, mapping);
		literalValue = '';
		bumpMappings();
	}

	function addRepeatable(name: string) {
		const normalized = normalizeAttrName(name);
		if (!normalized) return;
		repeatableAttrs = new Set([...repeatableAttrs, normalized]);
	}

	function removeRepeatable(name: string) {
		const next = new Set(repeatableAttrs);
		next.delete(normalizeAttrName(name));
		repeatableAttrs = next;
	}

	function addOperation() {
		if (!csvHeaders.length) {
			inlineError = 'Choose a CSV file before adding an operation.';
			return;
		}
		operations = [
			...operations,
			{
				id: ++operationIdCounter,
				targetType: 'group',
				groupDn: 'cn=GroupName,cn=groups,dc=example,dc=com',
				operation: 'add',
				memberAttr: 'member',
				csvColumn: csvHeaders[0],
				memberDnTemplate: 'cn={value},cn=users,dc=example,dc=com',
				useGroupColumn: false,
				groupColumn: '',
				groupDnTemplate: 'cn={value},cn=groups,dc=example,dc=com',
				groupDelimiter: ';',
				userCnColumn: csvHeaders[0],
				userValueColumn: csvHeaders[Math.min(1, csvHeaders.length - 1)] || csvHeaders[0],
				userAttrName: 'mail',
				userDnTemplate: 'cn={cn},cn=users,dc=example,dc=com'
			}
		];
	}

	function updateOperation<K extends keyof GroupOperation>(id: number, field: K, value: GroupOperation[K]) {
		operations = operations.map((op) => (op.id === id ? { ...op, [field]: value } : op));
	}

	function removeOperation(id: number) {
		operations = operations.filter((op) => op.id !== id);
	}

	function convert() {
		inlineError = '';
		if (!csvRows.length) {
			inlineError = 'Choose a CSV file before converting to LDIF.';
			return;
		}
		let result: BuildResult;
		if (appMode === 'groups') {
			if (!operations.length) {
				preview = 'Please add at least one operation.';
				return;
			}
			result = buildGroupOperationsLdif(csvRows, operations);
		} else {
			const mappingsArray = Array.from(mappings.entries()).map(([targetAttribute, config]) => ({
				targetAttribute,
				...normalizeMapping(config)
			}));
			if (useDynamicDn && !dynamicDnColumn) {
				preview = 'Select a parent column for the dynamic DN.';
				return;
			}
			result = buildLdif(csvRows, {
				dnTemplate,
				dynamicDn: { enabled: useDynamicDn, column: dynamicDnColumn, template: dynamicDnTemplate },
				mappings: mappingsArray,
				repeatableAttributes: Array.from(repeatableAttrs),
				entryMode: userRecordMode
			});
		}
		lastResult = result;
		preview = result.ldif || 'No output generated. Check your configuration.';
		if (result.warnings.length) {
			warningsHidden = false;
			warnings =
				result.warnings.slice(0, 5).join(' | ') +
				(result.warnings.length > 5 ? ` (+${result.warnings.length - 5} more)` : '');
		} else {
			warningsHidden = true;
			warnings = '';
		}
	}

	async function copyPreview() {
		if (!lastResult?.ldif) return;
		const ok = await copyText(lastResult.ldif);
		copyLabel = ok ? 'Copied to clipboard' : 'Clipboard unavailable';
		setTimeout(() => (copyLabel = 'Copy to clipboard'), 1500);
	}

	function reset() {
		csvRows = [];
		csvHeaders = [];
		ldifAttrs = [];
		mappings = new Map();
		selectedAttribute = null;
		lastResult = null;
		ldifPaste = '';
		csvStatus = 'No file selected';
		ldifStatus = 'No file selected';
		csvHasFile = false;
		ldifHasFile = false;
		delimiter = ',';
		dnTemplate = 'dn: cn={cn},ou=People,dc=example,dc=com';
		preview = 'Upload a CSV and configure mappings to see preview...';
		warningsHidden = true;
		operations = [];
		operationIdCounter = 0;
		repeatableAttrs = new Set(['objectclass', 'replace']);
		userRecordMode = 'new';
		useDynamicDn = false;
		dynamicDnTemplate = 'ou={value}';
		dynamicDnColumn = '';
		inlineError = '';
	}
</script>

<svelte:head>
	<title>CSV to LDIF | LDIF Builder</title>
</svelte:head>

<header class="header">
	<div>
		<h1>CSV to LDIF</h1>
		<p class="subtitle">Map CSV columns to directory attributes, then review and download your LDIF.</p>
	</div>
	<div class="header-actions">
		<button class="btn btn-secondary" type="button" onclick={reset}>
			<Icon name="ArrowCounterclockwise" />
			Reset
		</button>
	</div>
</header>

<div class="content">
	{#if inlineError}
		<p class="inline-error" role="alert">{inlineError}</p>
	{/if}

	<section class="card mode-selector-card">
		<div class="card-body">
			<div class="mode-selector">
				<label class="mode-option">
					<input type="radio" name="appMode" value="create" bind:group={appMode} />
					<div class="mode-content">
						<div class="mode-icon create"><Icon name="DocumentAdd" /></div>
						<div class="mode-text">
							<strong>Create entries</strong>
							<span>Create new LDIF entries from CSV data</span>
						</div>
					</div>
				</label>
				<label class="mode-option">
					<input type="radio" name="appMode" value="groups" bind:group={appMode} />
					<div class="mode-content">
						<div class="mode-icon groups"><Icon name="People" /></div>
						<div class="mode-text">
							<strong>Group operations</strong>
							<span>Add/remove members to/from groups</span>
						</div>
					</div>
				</label>
			</div>
		</div>
	</section>

	<section class="card">
		<div class="card-header">
			<div class="step-badge">1</div>
			<div>
				<h2>Choose your files</h2>
				{#if appMode === 'create'}
					<p>Upload your CSV data and optionally a sample LDIF to infer attributes</p>
				{:else}
					<p>Upload CSV file with member identifiers (e.g., civil IDs)</p>
				{/if}
			</div>
		</div>
		<div class="card-body">
			<div class="upload-grid">
				<UploadZone id="csvDropZone" label="CSV file" accept=".csv" status={csvStatus} hasFile={csvHasFile} onFile={onCsv} />
				{#if appMode === 'create'}
					<UploadZone
						id="ldifDropZone"
						label="Sample LDIF (optional)"
						hint="To infer target attributes"
						accept=".ldif,.txt"
						status={ldifStatus}
						hasFile={ldifHasFile}
						onFile={onLdif}
					/>
				{/if}
			</div>

			{#if appMode === 'create'}
				<div class="paste-section">
					<div class="paste-header">
						<span>Or paste LDIF content directly:</span>
						<button class="btn btn-outline btn-sm" type="button" onclick={() => (ldifPaste = '')}>Clear</button>
					</div>
					<textarea class="paste-textarea" bind:value={ldifPaste} placeholder="Paste LDIF content here to extract attributes..."></textarea>
					<button
						class="btn btn-secondary"
						type="button"
						onclick={() => {
							if (!ldifPaste.trim()) {
								inlineError = 'Paste LDIF content before reading its attributes.';
								return;
							}
							processLdifText(ldifPaste, 'Pasted Content');
						}}
					>
						<Icon name="Document" size={16} />
						Read LDIF
					</button>
				</div>
			{/if}

			<div class="settings-row">
				<div class="form-group">
					<label for="delimiter">Delimiter</label>
					<input id="delimiter" class="input" bind:value={delimiter} />
					<span class="hint">Auto-detected from CSV</span>
				</div>
				{#if appMode === 'create'}
					<div class="form-group">
						<label for="userRecordMode">Entry operation</label>
						<select id="userRecordMode" class="input" bind:value={userRecordMode}>
							<option value="new">Create new entries</option>
							<option value="modify">Modify existing entries</option>
						</select>
					</div>
					<div class="form-group flex-grow">
						<label for="dnTemplate">DN template</label>
						<input id="dnTemplate" class="input" bind:value={dnTemplate} />
						<span class="hint">Use {'{attribute}'} placeholders. Add <code>{'{parent}'}</code> for dynamic parent placement.</span>
					</div>
				{/if}
			</div>

			{#if appMode === 'create'}
				<div class="settings-row">
					<div class="form-group">
						<label class="toggle-item">
							<input type="checkbox" bind:checked={useDynamicDn} />
							<span>Dynamic parent DN from CSV</span>
						</label>
					</div>
					{#if useDynamicDn}
						<div class="form-group">
							<label for="dynamicDnColumn">Parent column</label>
							<select id="dynamicDnColumn" class="input" bind:value={dynamicDnColumn}>
								{#each csvHeaders as col}<option value={col}>{col}</option>{/each}
							</select>
						</div>
						<div class="form-group flex-grow">
							<label for="dynamicDnTemplate">Parent format</label>
							<input id="dynamicDnTemplate" class="input" bind:value={dynamicDnTemplate} />
						</div>
					{/if}
				</div>
				{#if useDynamicDn}
					<div class="hint">{dynamicPreview}</div>
				{/if}
			{/if}
		</div>
	</section>

	<section class="card">
		<div class="card-header">
			<div class="step-badge">2</div>
			<div>
				{#if appMode === 'create'}
					<h2>Map your fields</h2>
					<p>Map CSV columns to LDIF attributes - select multiple columns to concatenate</p>
				{:else}
					<h2>Configure operations</h2>
					<p>Define group operations or single-user attribute modifications.</p>
				{/if}
			</div>
			{#if appMode === 'groups'}
				<button class="btn btn-outline btn-sm" type="button" onclick={addOperation}>
					<Icon name="Add" />Add Operation
				</button>
			{/if}
		</div>
		<div class="card-body">
			{#if !csvHeaders.length}
				<div class="empty-state">
					<Icon name="Table" size={48} />
					<p>No CSV file loaded</p>
					<span>Upload a CSV file to start mapping fields</span>
				</div>
			{:else if appMode === 'create'}
				<div class="mapping-interface">
					<div class="mapping-columns">
						<div class="mapping-column">
							<div class="column-header">
								<h3>LDIF attributes (target)</h3>
								<button class="btn btn-outline btn-sm" type="button" onclick={() => (attrDialogOpen = true)}>
									<Icon name="Add" />Add custom
								</button>
							</div>
							<div class="attribute-list">
								{#each allAttrs as attr}
									{@const mapped = mappings.has(attr)}
									{@const count = mapped ? normalizeMapping(mappings.get(attr)).sourceParts.length : 0}
									<button
										type="button"
										class="attribute-item"
										class:selected={selectedAttribute === attr}
										class:mapped
										onclick={() => selectAttr(attr)}
									>
										<span>{attr}</span>
										{#if count > 0}<span class="badge">{count}</span>{/if}
									</button>
								{:else}
									<div class="empty-state-sm">
										<p>Add a target attribute</p>
										<span>Choose Add custom, or read a sample LDIF to list its attributes.</span>
									</div>
								{/each}
							</div>
						</div>
						<div class="mapping-arrow"><Icon name="ArrowRight" /></div>
						<div class="mapping-column">
							<div class="column-header">
								<h3>CSV columns (source)</h3>
								<span class="hint">{csvHeaders.length} columns</span>
							</div>
							<div class="attribute-list">
								{#each csvHeaders as col}
									{@const selected =
										!!selectedAttribute &&
										normalizeMapping(mappings.get(selectedAttribute)).sourceParts.some(
											(p) => p.type === 'csv' && p.value === col
										)}
									<button
										type="button"
										class="attribute-item"
										class:selected
										disabled={!selectedAttribute}
										onclick={() => toggleCsvColumn(col)}
									>
										<span>{col}</span>
									</button>
								{/each}
							</div>
						</div>
					</div>

					{#if selectedAttribute && selectedMapping}
						<div class="mapping-details">
							<div class="details-header">
								<h3>Mapping configuration: <span>{selectedAttribute}</span></h3>
								<button
									class="btn btn-secondary btn-sm"
									type="button"
									onclick={() => {
										mappings.delete(selectedAttribute!);
										bumpMappings();
									}}
								>
									Clear mapping
								</button>
							</div>
							<div class="details-body">
								<div class="selected-fields">
									<label>Selected CSV columns:</label>
									<div class="selected-list">
										{#each selectedMapping.sourceParts as part}
											<span class="selected-chip">
												{part.type === 'literal' ? `“${part.value}”` : part.value}
												<button type="button" aria-label={`Remove ${part.value}`} onclick={() => removePart(part.type, part.value)}>
													<Icon name="Dismiss" size={16} />
												</button>
											</span>
										{:else}
											<span style="color: var(--text-muted); font-size: 13px;">No inputs selected. Click CSV columns or add a literal.</span>
										{/each}
									</div>
								</div>
								<div class="literal-row">
									<label for="literalValue">Add literal value</label>
									<div class="literal-controls">
										<input id="literalValue" class="input" bind:value={literalValue} placeholder="e.g., @example.com" />
										<button class="btn btn-outline btn-sm" type="button" onclick={addLiteral}>Add literal</button>
									</div>
								</div>
								<div class="type-options">
									<div class="form-group">
										<label for="attrType">Attribute type</label>
										<select
											id="attrType"
											class="input"
											bind:value={attrType}
											onchange={() => {
												if (attrType === 'dn' && !attrDnTemplate) {
													attrDnTemplate = dnTemplate.replace(/^dn:\s*/i, '').replace(/\{[^}]+\}/, '{value}');
												}
												syncMappingFields();
											}}
										>
											<option value="text">Text (plain value)</option>
											<option value="dn">DN (Distinguished Name)</option>
										</select>
									</div>
									{#if attrType === 'dn'}
										<div class="form-group">
											<label for="attrDnTemplate">DN template for this attribute</label>
											<input id="attrDnTemplate" class="input" bind:value={attrDnTemplate} oninput={syncMappingFields} />
										</div>
									{/if}
								</div>
								<div class="concat-options">
									<div class="form-group">
										<label>Concatenation separator</label>
										<input class="input" bind:value={concatSeparator} oninput={syncMappingFields} />
									</div>
									<label class="toggle-item">
										<input type="checkbox" bind:checked={useCustomSeparator} onchange={syncMappingFields} />
										<span>Use a custom separator to combine columns</span>
									</label>
									{#if useCustomSeparator}
										<div class="form-group">
											<label>Custom separator</label>
											<input class="input" bind:value={customSeparator} oninput={syncMappingFields} />
										</div>
									{/if}
									<div class="toggle-group">
										<label class="toggle-item">
											<input type="checkbox" bind:checked={concatTrim} onchange={syncMappingFields} />
											<span>Trim whitespace</span>
										</label>
										<label class="toggle-item">
											<input type="checkbox" bind:checked={concatSkipEmpty} onchange={syncMappingFields} />
											<span>Skip empty parts</span>
										</label>
									</div>
								</div>
								<div class="literal-row">
									<label>Repeatable attributes</label>
									<div class="literal-controls">
										<select class="input" bind:value={repeatablePreset}>
											<option value="objectClass">objectClass</option>
											<option value="replace">replace</option>
										</select>
										<button class="btn btn-outline btn-sm" type="button" onclick={() => addRepeatable(repeatablePreset)}>Add preset</button>
									</div>
									<div class="literal-controls space-before">
										<input class="input" bind:value={customRepeatable} placeholder="Custom attribute" />
										<button
											class="btn btn-outline btn-sm"
											type="button"
											onclick={() => {
												addRepeatable(customRepeatable);
												customRepeatable = '';
											}}>Add custom</button
										>
									</div>
									<div class="selected-list space-before">
										{#each [...repeatableAttrs] as attr}
											<span class="selected-chip">
												{attr}
												<button type="button" aria-label={`Remove ${attr}`} onclick={() => removeRepeatable(attr)}>
													<Icon name="Dismiss" size={16} />
												</button>
											</span>
										{/each}
									</div>
								</div>
							</div>
						</div>
					{/if}
				</div>
			{:else}
				{#if !operations.length}
					<div class="empty-state">
						<Icon name="People" size={48} />
						<p>No operations configured</p>
						<span>Choose "Add operation" to add group membership updates or single-user attribute modifications</span>
					</div>
				{/if}
				<div class="operations-list">
					{#each operations as op (op.id)}
						<div class="operation-card">
							<div class="operation-header">
								<h4>Operation #{op.id}</h4>
								<button class="btn btn-secondary btn-sm" type="button" onclick={() => removeOperation(op.id)}>Remove</button>
							</div>
							<div class="operation-body">
								<div class="form-group">
									<label>Operation target</label>
									<select class="input" value={op.targetType} onchange={(e) => updateOperation(op.id, 'targetType', (e.currentTarget as HTMLSelectElement).value as 'group' | 'user')}>
										<option value="group">Group membership</option>
										<option value="user">Single user attribute</option>
									</select>
								</div>
								{#if op.targetType === 'group'}
									<label class="toggle-item">
										<input type="checkbox" checked={op.useGroupColumn} onchange={(e) => updateOperation(op.id, 'useGroupColumn', (e.currentTarget as HTMLInputElement).checked)} />
										<span>Use Group names from CSV?</span>
									</label>
									{#if !op.useGroupColumn}
										<div class="form-group">
											<label>Group DN</label>
											<input class="input" value={op.groupDn} onchange={(e) => updateOperation(op.id, 'groupDn', (e.currentTarget as HTMLInputElement).value)} />
										</div>
									{:else}
										<div class="form-group">
											<label>Group column</label>
											<select class="input" value={op.groupColumn} onchange={(e) => updateOperation(op.id, 'groupColumn', (e.currentTarget as HTMLSelectElement).value)}>
												<option value="">-- Select column --</option>
												{#each csvHeaders as col}<option value={col}>{col}</option>{/each}
											</select>
										</div>
										<div class="form-group">
											<label>Group DN template</label>
											<input class="input" value={op.groupDnTemplate} onchange={(e) => updateOperation(op.id, 'groupDnTemplate', (e.currentTarget as HTMLInputElement).value)} />
										</div>
										<div class="form-group">
											<label>Group delimiter</label>
											<input class="input" value={op.groupDelimiter} onchange={(e) => updateOperation(op.id, 'groupDelimiter', (e.currentTarget as HTMLInputElement).value)} />
										</div>
									{/if}
									<div class="operation-row">
										<div class="form-group">
											<label>Operation</label>
											<select class="input" value={op.operation} onchange={(e) => updateOperation(op.id, 'operation', (e.currentTarget as HTMLSelectElement).value as GroupOperation['operation'])}>
												<option value="add">Add Members</option>
												<option value="delete">Delete Members</option>
												<option value="replace">Replace Members</option>
											</select>
										</div>
										<div class="form-group">
											<label>Member attribute</label>
											<select class="input" value={op.memberAttr} onchange={(e) => updateOperation(op.id, 'memberAttr', (e.currentTarget as HTMLSelectElement).value)}>
												<option value="member">member</option>
												<option value="uniqueMember">uniqueMember</option>
											</select>
										</div>
										<div class="form-group">
											<label>Member column</label>
											<select class="input" value={op.csvColumn} onchange={(e) => updateOperation(op.id, 'csvColumn', (e.currentTarget as HTMLSelectElement).value)}>
												{#each csvHeaders as col}<option value={col}>{col}</option>{/each}
											</select>
										</div>
									</div>
									<div class="form-group">
										<label>Member DN template</label>
										<input class="input" value={op.memberDnTemplate} onchange={(e) => updateOperation(op.id, 'memberDnTemplate', (e.currentTarget as HTMLInputElement).value)} />
									</div>
								{:else}
									<div class="operation-row">
										<div class="form-group">
											<label>Operation</label>
											<select class="input" value={op.operation} onchange={(e) => updateOperation(op.id, 'operation', (e.currentTarget as HTMLSelectElement).value as GroupOperation['operation'])}>
												<option value="add">Add Value</option>
												<option value="delete">Delete Value</option>
												<option value="replace">Replace Value</option>
											</select>
										</div>
										<div class="form-group">
											<label>CN Column</label>
											<select class="input" value={op.userCnColumn} onchange={(e) => updateOperation(op.id, 'userCnColumn', (e.currentTarget as HTMLSelectElement).value)}>
												{#each csvHeaders as col}<option value={col}>{col}</option>{/each}
											</select>
										</div>
										<div class="form-group">
											<label>Value column</label>
											<select class="input" value={op.userValueColumn} onchange={(e) => updateOperation(op.id, 'userValueColumn', (e.currentTarget as HTMLSelectElement).value)}>
												{#each csvHeaders as col}<option value={col}>{col}</option>{/each}
											</select>
										</div>
									</div>
									<div class="form-group">
										<label>Target Attribute</label>
										<input class="input" value={op.userAttrName} onchange={(e) => updateOperation(op.id, 'userAttrName', (e.currentTarget as HTMLInputElement).value)} />
									</div>
									<div class="form-group">
										<label>User DN template</label>
										<input class="input" value={op.userDnTemplate} onchange={(e) => updateOperation(op.id, 'userDnTemplate', (e.currentTarget as HTMLInputElement).value)} />
									</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	</section>

	<section class="card">
		<div class="card-header">
			<div class="step-badge">3</div>
			<div>
				<h2>Preview and download</h2>
				<p>Review the generated LDIF output before downloading</p>
			</div>
			<div class="header-actions">
				<button class="btn btn-primary" type="button" onclick={convert}>
					<Icon name="ArrowSync" />Convert to LDIF
				</button>
				<button class="btn btn-success" type="button" disabled={!lastResult?.ldif} onclick={() => lastResult?.ldif && downloadBlob(lastResult.ldif, 'output.ldif')}>
					<Icon name="ArrowDownload" />Download LDIF
				</button>
			</div>
		</div>
		<div class="card-body">
			<div class="alert alert-warning" hidden={warningsHidden}>{warnings}</div>
			<div class="preview-container">
				<div class="preview-header">
					<span>output.ldif</span>
					<button class="btn-icon" type="button" title={copyLabel} aria-label={copyLabel} onclick={copyPreview}>
						<Icon name={copyLabel.startsWith('Copied') ? 'Checkmark' : 'Copy'} />
					</button>
				</div>
				<pre class="preview-code">{preview}</pre>
			</div>
		</div>
	</section>
</div>

<PageFooter />
<AttributeDialog
	bind:open={attrDialogOpen}
	onAdd={(name) => {
		const cleaned = name.trim().toLowerCase().replace(/\s+/g, '');
		if (!ldifAttrs.includes(cleaned)) ldifAttrs = [...ldifAttrs, cleaned];
		selectAttr(cleaned);
	}}
/>
