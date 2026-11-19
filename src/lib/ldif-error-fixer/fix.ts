import { normalizeAttrName, normalizeDn } from '$lib/ldif/normalize';

export type LdifBlock = { dn: string; raw: string };

export type ParsedError = {
	raw: string;
	code: string;
	dn: string;
	message: string;
	type: string;
	attribute: string;
	action?: string;
	reason?: string;
};

export type FixReport = {
	fixed: ParsedError[];
	unresolved: ParsedError[];
};

export function splitLdifBlocks(text: string): LdifBlock[] {
	const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
	const lines = normalized.split('\n');
	const blocks: Array<{ dn: string; lines: string[]; raw?: string }> = [];
	let current: { dn: string; lines: string[]; raw?: string } | null = null;

	lines.forEach((line) => {
		const isNewDn = /^dn:/i.test(line);
		if (isNewDn) {
			if (current) blocks.push(current);
			const colonIndex = line.indexOf(':');
			let dnValue = line.substring(colonIndex + 1);
			if (dnValue.startsWith(':')) dnValue = dnValue.substring(1);
			current = { dn: dnValue.trim(), lines: [line] };
		} else if (current) {
			current.lines.push(line);
		}
	});
	if (current) blocks.push(current);

	return blocks.map((b) => {
		while (b.lines.length && b.lines[b.lines.length - 1].trim() === '') b.lines.pop();
		return { dn: b.dn, raw: b.lines.join('\n') };
	});
}

export function parseEntryBlock(rawBlockText: string): Record<string, string[]> {
	const entry: Record<string, string[]> = {};
	let currentAttr: string | null = null;
	let currentValue = '';
	let isBase64 = false;

	const flush = () => {
		if (!currentAttr) return;
		let finalValue = currentValue;
		if (isBase64) {
			try {
				finalValue = atob(currentValue.trim());
			} catch {
				finalValue = currentValue;
			}
		}
		if (!entry[currentAttr]) entry[currentAttr] = [];
		entry[currentAttr].push(finalValue.trim());
	};

	rawBlockText.split('\n').forEach((line) => {
		if (line.startsWith(' ') && currentAttr) {
			currentValue += line.substring(1);
			return;
		}
		flush();
		currentAttr = null;
		currentValue = '';
		isBase64 = false;
		if (line.trim() === '' || line.startsWith('#')) return;
		const colonIndex = line.indexOf(':');
		if (colonIndex <= 0) return;
		currentAttr = line.substring(0, colonIndex).trim();
		const afterColon = line.substring(colonIndex + 1);
		if (afterColon.startsWith(':')) {
			isBase64 = true;
			currentValue = afterColon.substring(1).trim();
		} else if (afterColon.startsWith('<')) {
			currentValue = afterColon.substring(1).trim();
		} else {
			currentValue = afterColon.trim();
		}
	});
	flush();
	return entry;
}

export function classifyError(message: string): string {
	const m = message.toLowerCase();
	if (/already exists/.test(m) && !/type or value|attribute or value/.test(m)) return 'entry_exists';
	if (/type or value exists|attribute or value exists/.test(m)) return 'value_exists';
	if (/no such attribute/.test(m)) return 'no_such_attribute';
	if (/object class violation|required attribute|missing.*attribute|attribute.*required/.test(m))
		return 'missing_attribute';
	if (/no such object/.test(m)) return 'no_such_object';
	if (/invalid dn syntax|invalid syntax|naming violation/.test(m)) return 'invalid_syntax';
	return 'unknown';
}

export function extractAttribute(message: string, type: string): string {
	if (!['missing_attribute', 'no_such_attribute', 'value_exists'].includes(type)) return '';
	const quoted = message.match(/['"]([a-zA-Z][\w;-]*)['"]/);
	if (quoted) return quoted[1];
	const paren = message.match(/\(([a-zA-Z][\w;-]*)\)/);
	if (paren) return paren[1];
	return '';
}

export function parseErrorLog(text: string): ParsedError[] {
	const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
	const errors: ParsedError[] = [];
	lines.forEach((rawLine) => {
		const line = rawLine.trim();
		if (!line) return;
		const bracketMatch = line.match(/^\[(\d+)\]\s*(.+?)\s*->\s*(.+)$/);
		const plainMatch = line.match(/^(.+?)\s*->\s*(.+)$/);
		if (bracketMatch) {
			const type = classifyError(bracketMatch[3]);
			errors.push({
				raw: line,
				code: bracketMatch[1],
				dn: bracketMatch[2].trim(),
				message: bracketMatch[3].trim(),
				type,
				attribute: extractAttribute(bracketMatch[3], type)
			});
		} else if (plainMatch) {
			const type = classifyError(plainMatch[2]);
			errors.push({
				raw: line,
				code: '',
				dn: plainMatch[1].trim(),
				message: plainMatch[2].trim(),
				type,
				attribute: extractAttribute(plainMatch[2], type)
			});
		} else {
			errors.push({ raw: line, code: '', dn: '', message: line, type: 'unparsed', attribute: '' });
		}
	});
	return errors;
}

export function buildModifyBlock(dn: string, entryMap: Record<string, string[]>): string {
	const lines = [`dn: ${dn}`, 'changetype: modify'];
	const attrNames = Object.keys(entryMap).filter(
		(k) => !['dn', 'changetype'].includes(normalizeAttrName(k))
	);
	attrNames.sort((a, b) => {
		if (normalizeAttrName(a) === 'objectclass') return -1;
		if (normalizeAttrName(b) === 'objectclass') return 1;
		return 0;
	});
	attrNames.forEach((attr) => {
		const values = Array.isArray(entryMap[attr]) ? entryMap[attr] : [entryMap[attr]];
		const unique = Array.from(new Set(values.map((v) => String(v).trim()).filter(Boolean)));
		if (!unique.length) return;
		lines.push(`replace: ${attr}`);
		unique.forEach((v) => lines.push(`${attr}: ${v}`));
		lines.push('-');
	});
	return lines.join('\n');
}

export function isModifyBlock(rawBlockText: string): boolean {
	return /^changetype:\s*modify\s*$/im.test(rawBlockText);
}

export function applyFixes(
	blocks: LdifBlock[],
	parsedErrors: ParsedError[],
	fallbackValues: Record<string, string>
): { fixedLdifText: string; report: FixReport } {
	const report: FixReport = { fixed: [], unresolved: [] };
	const dnFixes = new Map<
		string,
		{ block: LdifBlock; convertToModify: boolean; patches: Array<{ attr: string; value: string }> }
	>();

	const matchBlock = (dn: string) => {
		const norm = normalizeDn(dn);
		if (!norm) return null;
		return blocks.find((b) => normalizeDn(b.dn) === norm) || null;
	};

	parsedErrors.forEach((err) => {
		if (err.type === 'unparsed') {
			report.unresolved.push({
				...err,
				reason: 'Could not parse this line — expected format "[code] dn -> message".'
			});
			return;
		}
		if (!err.dn) {
			report.unresolved.push({ ...err, reason: 'Could not extract a DN from this error line.' });
			return;
		}
		const block = matchBlock(err.dn);
		if (!block) {
			report.unresolved.push({ ...err, reason: 'DN not found in the uploaded source LDIF.' });
			return;
		}
		const normDn = normalizeDn(block.dn);
		const fix = dnFixes.get(normDn) || { block, convertToModify: false, patches: [] };

		switch (err.type) {
			case 'entry_exists':
				fix.convertToModify = true;
				dnFixes.set(normDn, fix);
				report.fixed.push({
					...err,
					action: 'Converted changetype: add → changetype: modify (replace operations)'
				});
				break;
			case 'value_exists':
				report.fixed.push({
					...err,
					action: 'Duplicate attribute value detected — deduplicated on output'
				});
				break;
			case 'missing_attribute': {
				if (!err.attribute) {
					report.unresolved.push({
						...err,
						reason:
							'Object class violation reported, but the missing attribute name could not be determined from the message text.'
					});
					break;
				}
				if (isModifyBlock(block.raw)) {
					report.unresolved.push({
						...err,
						reason: `Entry already uses changetype: modify — add the "${err.attribute}" operation manually to avoid guessing the wrong LDAP operation.`
					});
					break;
				}
				const attrKey = normalizeAttrName(err.attribute);
				const fallback = fallbackValues[attrKey];
				if (!fallback) {
					report.unresolved.push({
						...err,
						reason: `Missing required attribute "${err.attribute}" — supply a fallback value to auto-fix.`
					});
					break;
				}
				fix.patches.push({ attr: err.attribute, value: fallback });
				dnFixes.set(normDn, fix);
				report.fixed.push({ ...err, action: `Added fallback value for "${err.attribute}"` });
				break;
			}
			case 'no_such_attribute':
				report.unresolved.push({
					...err,
					reason: `Server reports attribute "${err.attribute || '(unknown)'}" does not exist on this entry — the modify operation (replace/delete) needs manual correction.`
				});
				break;
			case 'no_such_object':
				report.unresolved.push({
					...err,
					reason: 'Parent entry does not exist in the directory — create the parent DN first, then retry.'
				});
				break;
			case 'invalid_syntax':
				report.unresolved.push({
					...err,
					reason: 'Attribute or DN syntax is invalid — requires manual correction of the value.'
				});
				break;
			default:
				report.unresolved.push({ ...err, reason: 'Unrecognized error type — flagged for manual review.' });
		}
	});

	const outputBlocks = blocks.map((block) => {
		const normDn = normalizeDn(block.dn);
		const fix = dnFixes.get(normDn);
		if (!fix) return block.raw;
		if (fix.convertToModify) {
			const entryMap = parseEntryBlock(block.raw);
			delete entryMap.dn;
			fix.patches.forEach((p) => {
				entryMap[p.attr] = [p.value];
			});
			return buildModifyBlock(block.dn, entryMap);
		}
		if (fix.patches.length) {
			let raw = block.raw;
			fix.patches.forEach((p) => {
				raw = `${raw}\n${p.attr}: ${p.value}`;
			});
			return raw;
		}
		return block.raw;
	});

	return { fixedLdifText: outputBlocks.join('\n\n'), report };
}

export function getPendingFallbackAttributes(blocks: LdifBlock[], parsedErrors: ParsedError[]) {
	const attrs = new Map<string, { attribute: string; count: number }>();
	parsedErrors.forEach((err) => {
		if (err.type !== 'missing_attribute' || !err.attribute) return;
		const block = blocks.find((b) => normalizeDn(b.dn) === normalizeDn(err.dn));
		if (!block || isModifyBlock(block.raw)) return;
		const key = normalizeAttrName(err.attribute);
		const entry = attrs.get(key) || { attribute: err.attribute, count: 0 };
		entry.count += 1;
		attrs.set(key, entry);
	});
	return Array.from(attrs.values());
}

export function buildFixReport(report: FixReport): string {
	const lines = [
		'LDIF Error Fixer — report',
		`Generated: ${new Date().toISOString()}`,
		`Fixed: ${report.fixed.length}`,
		`Unresolved: ${report.unresolved.length}`,
		'',
		'=== Fixed ==='
	];
	report.fixed.forEach((item, i) => {
		lines.push(`${i + 1}. [${item.code || '-'}] ${item.dn}`);
		lines.push(`   ${item.message}`);
		lines.push(`   → ${item.action}`);
		lines.push('');
	});
	lines.push('=== Unresolved ===');
	report.unresolved.forEach((item, i) => {
		lines.push(`${i + 1}. [${item.code || '-'}] ${item.dn || '(no dn)'}`);
		lines.push(`   ${item.message}`);
		lines.push(`   → ${item.reason}`);
		lines.push('');
	});
	return lines.join('\n');
}
