import { normalizeAttrName, normalizeDn } from '$lib/ldif/normalize';
import { parseLdif, type LdifEntry } from '$lib/ldif/parse';

export type FixOperation = {
	id: number;
	field: string;
	action: 'add' | 'replace' | 'remove';
	value: string;
};

export type DuplicateInfo = {
	original: LdifEntry;
	index: number;
	dn: string;
};

export function getNormalizedDn(entry: LdifEntry): string {
	const dn = entry.dn?.[0] ?? entry.DN?.[0] ?? '';
	return normalizeDn(dn);
}

export function findDuplicates(masterEntries: LdifEntry[], extractedEntries: LdifEntry[]) {
	const extractDns = new Set(extractedEntries.map(getNormalizedDn));
	const duplicates: DuplicateInfo[] = [];
	masterEntries.forEach((masterEntry, index) => {
		const normalized = getNormalizedDn(masterEntry);
		if (extractDns.has(normalized)) {
			duplicates.push({
				original: masterEntry,
				index,
				dn: masterEntry.dn?.[0] ?? 'Unknown'
			});
		}
	});
	const cleanedEntries = masterEntries.filter((entry) => !extractDns.has(getNormalizedDn(entry)));
	return {
		duplicates,
		cleanedEntries,
		stats: {
			totalEntries: masterEntries.length,
			duplicatesFound: duplicates.length,
			cleanedCount: cleanedEntries.length
		}
	};
}

export function applyFixOperations(
	entries: LdifEntry[],
	operations: FixOperation[],
	repeatableAttributes: Set<string>
): LdifEntry[] {
	const fixed = structuredClone(entries);
	operations.forEach((operation) => {
		fixed.forEach((entry) => {
			const fieldLower = normalizeAttrName(operation.field);
			const operationValue = (operation.value || '').toString().trim();
			const isRepeatable = repeatableAttributes.has(fieldLower);

			if (fieldLower === 'dn') {
				if (operation.action === 'replace') entry.dn = [operation.value];
				return;
			}

			const attrName = fieldLower;
			if (operation.action === 'add') {
				if (!entry[attrName]) entry[attrName] = [];
				if (operationValue && !entry[attrName].includes(operationValue)) {
					entry[attrName].push(operationValue);
				}
			} else if (operation.action === 'replace') {
				if (isRepeatable) {
					if (!entry[attrName]) entry[attrName] = [];
					if (operationValue && !entry[attrName].includes(operationValue)) {
						entry[attrName].push(operationValue);
					}
				} else {
					entry[attrName] = [operation.value];
				}
			} else if (operation.action === 'remove') {
				if (isRepeatable && operationValue) {
					const currentValues = Array.isArray(entry[attrName]) ? entry[attrName] : [];
					const filteredValues = currentValues.filter((value) => value !== operationValue);
					if (filteredValues.length > 0) entry[attrName] = filteredValues;
					else delete entry[attrName];
				} else {
					delete entry[attrName];
				}
			}
		});
	});
	return fixed;
}

export function entriesToLdif(entries: LdifEntry[]): string {
	const lines: string[] = [];
	entries.forEach((entry, idx) => {
		if (idx > 0) lines.push('');
		if (entry.dn?.[0]) lines.push(`dn: ${entry.dn[0]}`);
		Object.keys(entry)
			.filter((key) => key !== 'dn')
			.sort()
			.forEach((attr) => {
				const values = Array.isArray(entry[attr]) ? entry[attr] : [entry[attr]];
				values.forEach((value) => {
					if (value) lines.push(`${attr}: ${value}`);
				});
			});
	});
	return lines.join('\n');
}

export function getImportantAttributes(entry: LdifEntry): string {
	const preferred = ['cn', 'uid', 'mail', 'sn', 'givenName', 'objectClass'];
	const parts: string[] = [];
	for (const key of preferred) {
		const match = Object.keys(entry).find((k) => normalizeAttrName(k) === normalizeAttrName(key));
		if (!match) continue;
		const values = entry[match];
		if (values?.length) parts.push(`${match}=${values.join('|')}`);
		if (parts.length >= 3) break;
	}
	return parts.join(', ') || '(no summary attributes)';
}

export function buildDuplicatesReport(duplicates: DuplicateInfo[]): string {
	const lines = [
		'LDIF Cleaner — duplicates report',
		`Generated: ${new Date().toISOString()}`,
		`Duplicates: ${duplicates.length}`,
		''
	];
	duplicates.forEach((dup, i) => {
		lines.push(`${i + 1}. ${dup.dn}`);
		lines.push(`   ${getImportantAttributes(dup.original)}`);
		lines.push('');
	});
	return lines.join('\n');
}

export { parseLdif };
