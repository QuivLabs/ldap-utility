import { escapeLdif } from '$lib/ldif/serialize';
import type { BuildRequest, BuildResult, GroupOperation, Mapping } from './types';

export function extractLdifAttributes(text: string): string[] {
	const set = new Set<string>();
	text
		.split(/\r?\n/)
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('#'))
		.forEach((line) => {
			const [left] = line.split(':');
			if (!left) return;
			const key = left.trim().toLowerCase();
			if (key === 'dn' || key === 'objectclass') return;
			if (/^[a-z0-9_-]+$/i.test(key)) set.add(key);
		});
	return Array.from(set).sort();
}

export function normalizeMapping(mapping?: Partial<Mapping> | null): Mapping {
	const base: Mapping = {
		sourceParts: [],
		separator: ' ',
		trim: true,
		skipEmptyParts: true,
		attrType: 'text',
		dnTemplate: '',
		useCustomSeparator: false,
		customSeparator: ','
	};
	if (!mapping) return base;
	const next = { ...base, ...mapping };
	if (!next.sourceParts?.length && next.sourceFields) {
		next.sourceParts = next.sourceFields.map((v) => ({ type: 'csv' as const, value: v }));
		delete next.sourceFields;
	}
	if (!next.sourceParts) next.sourceParts = [];
	return next;
}

export function buildAttributeValue(row: Record<string, string>, mapping: Mapping): string | undefined {
	const m = normalizeMapping(mapping);
	const parts = m.sourceParts
		.map((part) => (part.type === 'literal' ? (part.value ?? '') : (row[part.value] ?? '')))
		.filter((v) => (m.skipEmptyParts ? String(v).trim() !== '' : true));
	if (!parts.length) return undefined;
	const sep = m.useCustomSeparator ? (m.customSeparator ?? ',') : (m.separator ?? ' ');
	const raw = parts.join(sep);
	const val = m.trim ? raw.trim() : raw;
	if (m.attrType === 'dn' && m.dnTemplate) {
		return m.dnTemplate.replace(/\{value\}/gi, val);
	}
	return val;
}

export function applyDnTemplate(
	template: string,
	row: Record<string, string>,
	mappings: Array<Mapping & { targetAttribute: string }>
): string {
	let dn = template;
	mappings.forEach((m) => {
		const key = `{${m.targetAttribute}}`;
		if (dn.includes(key)) {
			const val = buildAttributeValue(row, m) ?? '';
			dn = dn.replaceAll(key, val);
		}
	});
	return dn;
}

export function splitFirstRdn(template: string): [string, string] {
	for (let i = 0; i < template.length; i++) {
		if (template[i] === '\\') {
			i++;
			continue;
		}
		if (template[i] === ',') return [template.slice(0, i), template.slice(i + 1)];
	}
	return [template, ''];
}

export function buildParentDn(rawValue: string, parentFormat: string): string {
	const val = String(rawValue ?? '')
		.trim()
		.replace(/^,+|,+$/g, '')
		.trim();
	if (!val) return '';
	if (val.includes('=')) return val;
	const fmt = (parentFormat || '').trim() || '{value}';
	return fmt.replace(/\{value\}/gi, () => val);
}

export function applyParentToTemplate(template: string, parentDn: string): string {
	if (/\{parent\}/i.test(template)) {
		return template.replace(/\{parent\}/gi, () => parentDn);
	}
	const [head, rest] = splitFirstRdn(template);
	return [head.trim(), parentDn, rest.trim()].filter(Boolean).join(',');
}

export function buildLdif(rows: Record<string, string>[], req: BuildRequest): BuildResult {
	const lines: string[] = [];
	const warnings: string[] = [];
	const entryMode = req.entryMode === 'modify' ? 'modify' : 'new';
	const repeatableAttrs = new Set(
		(req.repeatableAttributes?.length ? req.repeatableAttributes : ['objectclass', 'replace'])
			.map((attr) => String(attr || '').trim().toLowerCase())
			.filter(Boolean)
	);

	rows.forEach((row, idx) => {
		const attrLines: string[] = [];
		const usedAttrs = new Set<string>();
		const repeatableBuckets = new Map<string, { attributeName: string; values: string[] }>();
		const modifyOperations: Array<{ attributeName: string; values: string[] }> = [];
		let rowTemplate = req.dnTemplate;
		const dyn = req.dynamicDn;
		if (dyn?.enabled) {
			const parentDn = buildParentDn(row[dyn.column], dyn.template);
			if (!parentDn) {
				warnings.push(`Row ${idx + 1}: Empty parent value in column "${dyn.column}", entry skipped.`);
				return;
			}
			rowTemplate = applyParentToTemplate(rowTemplate, parentDn);
		}
		const dn = applyDnTemplate(rowTemplate, row, req.mappings);

		if (!dn || /\{.+\}/.test(dn)) {
			warnings.push(`Row ${idx + 1}: DN template not fully resolved.`);
			return;
		}

		req.mappings.forEach((m) => {
			const v = buildAttributeValue(row, m);
			if (v === undefined || v === '') return;
			const target = (m.targetAttribute || '').trim();
			if (!target) return;

			const lower = target.toLowerCase();
			if (repeatableAttrs.has(lower)) {
				const parts = String(v)
					.split(/[\s,;]+/)
					.map((p) => p.trim())
					.filter(Boolean);
				if (!repeatableBuckets.has(lower)) {
					repeatableBuckets.set(lower, { attributeName: target, values: [] });
				}
				const bucket = repeatableBuckets.get(lower)!;
				if (parts.length) parts.forEach((p) => bucket.values.push(p));
				else bucket.values.push(v.trim());
				return;
			}

			if (usedAttrs.has(lower)) {
				warnings.push(`Row ${idx + 1}: Duplicate attribute "${target}" skipped.`);
				return;
			}

			usedAttrs.add(lower);
			if (entryMode === 'modify') {
				modifyOperations.push({ attributeName: target, values: [v] });
			} else {
				attrLines.push(`${target}: ${escapeLdif(v)}`);
			}
		});

		const entryLines = [`dn: ${dn}`];
		const repeatableEntries = Array.from(repeatableBuckets.entries()).sort((a, b) => {
			if (a[0] === 'objectclass') return -1;
			if (b[0] === 'objectclass') return 1;
			return 0;
		});

		if (entryMode === 'modify') {
			entryLines.push('changetype: modify');
			repeatableEntries.forEach(([, bucket]) => {
				const uniqueValues = Array.from(new Set(bucket.values.map((val) => val.trim()).filter(Boolean)));
				if (!uniqueValues.length) return;
				modifyOperations.push({ attributeName: bucket.attributeName, values: uniqueValues });
			});
			modifyOperations.forEach((op) => {
				entryLines.push(`replace: ${op.attributeName}`);
				op.values.forEach((val) => entryLines.push(`${op.attributeName}: ${escapeLdif(val)}`));
				entryLines.push('-');
			});
		} else {
			repeatableEntries.forEach(([, bucket]) => {
				const uniqueValues = Array.from(new Set(bucket.values.map((val) => val.trim()).filter(Boolean)));
				uniqueValues.forEach((val) => entryLines.push(`${bucket.attributeName}: ${escapeLdif(val)}`));
			});
			entryLines.push(...attrLines);
		}

		lines.push(entryLines.join('\n'));
		lines.push('');
	});

	return { ldif: lines.join('\n'), warnings };
}

export function buildGroupOperationsLdif(
	rows: Record<string, string>[],
	operations: GroupOperation[]
): BuildResult {
	const lines: string[] = [];
	const warnings: string[] = [];

	operations.forEach((op) => {
		if ((op.targetType || 'group') === 'user') {
			const attrName = (op.userAttrName || '').trim();
			if (!attrName) {
				warnings.push(`Operation #${op.id}: Target attribute is required for single-user modify.`);
				return;
			}
			if (!op.userCnColumn) {
				warnings.push(`Operation #${op.id}: CN column is required for single-user modify.`);
				return;
			}

			rows.forEach((row, idx) => {
				const cnValue = String(row[op.userCnColumn] ?? '').trim();
				if (!cnValue) {
					warnings.push(`Row ${idx + 1}: Empty CN value for column "${op.userCnColumn}"`);
					return;
				}
				const userDn = (op.userDnTemplate || 'cn={cn},cn=users,dc=example,dc=com')
					.replace(/\{cn\}/gi, cnValue)
					.replace(/\{value\}/gi, cnValue);
				const value = String(row[op.userValueColumn] ?? '').trim();
				if ((op.operation === 'add' || op.operation === 'replace') && !value) {
					warnings.push(`Row ${idx + 1}: Empty value for column "${op.userValueColumn}"`);
					return;
				}
				lines.push(`dn: ${userDn}`);
				lines.push('changetype: modify');
				lines.push(`${op.operation}: ${attrName}`);
				if (op.operation !== 'delete' || value) {
					lines.push(`${attrName}: ${escapeLdif(value)}`);
				}
				lines.push('');
			});
			return;
		}

		if (op.useGroupColumn) {
			const groupMap = new Map<string, string[]>();
			rows.forEach((row, idx) => {
				const memberValue = row[op.csvColumn] ?? '';
				if (!memberValue?.trim()) {
					warnings.push(`Row ${idx + 1}: Empty value for member column "${op.csvColumn}"`);
					return;
				}
				const groupValue = row[op.groupColumn] ?? '';
				if (!groupValue?.trim()) {
					warnings.push(`Row ${idx + 1}: Empty value for group column "${op.groupColumn}"`);
					return;
				}
				const groups = groupValue
					.split(op.groupDelimiter || ';')
					.map((g) => g.trim())
					.filter(Boolean);
				const memberDn = op.memberDnTemplate.replace(/\{value\}/gi, memberValue.trim());
				groups.forEach((group) => {
					const groupDn = op.groupDnTemplate ? op.groupDnTemplate.replace(/\{value\}/gi, group) : group;
					if (!groupMap.has(groupDn)) groupMap.set(groupDn, []);
					groupMap.get(groupDn)!.push(memberDn);
				});
			});
			if (groupMap.size === 0) {
				warnings.push(`Operation (dynamic groups): No valid group/member combinations found`);
				return;
			}
			groupMap.forEach((members, groupDn) => {
				lines.push(`dn: ${groupDn}`);
				lines.push('changetype: modify');
				lines.push(`${op.operation}: ${op.memberAttr}`);
				members.forEach((dn) => lines.push(`${op.memberAttr}: ${dn}`));
				lines.push('');
			});
		} else {
			const members: string[] = [];
			rows.forEach((row, idx) => {
				const value = row[op.csvColumn] ?? '';
				if (!value?.trim()) {
					warnings.push(`Row ${idx + 1}: Empty value for column "${op.csvColumn}"`);
					return;
				}
				members.push(op.memberDnTemplate.replace(/\{value\}/gi, value.trim()));
			});
			if (!members.length) {
				warnings.push(`Operation "${op.groupDn}": No valid members found`);
				return;
			}
			lines.push(`dn: ${op.groupDn}`);
			lines.push('changetype: modify');
			lines.push(`${op.operation}: ${op.memberAttr}`);
			members.forEach((dn) => lines.push(`${op.memberAttr}: ${dn}`));
			lines.push('');
		}
	});

	return { ldif: lines.join('\n'), warnings };
}
