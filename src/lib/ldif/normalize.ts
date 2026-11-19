export function normalizeAttrName(attr: string): string {
	return String(attr || '')
		.trim()
		.toLowerCase();
}

export function normalizeDn(dn: string): string {
	return String(dn || '')
		.trim()
		.toLowerCase()
		.replace(/\s*,\s*/g, ',');
}

export function formatAttrName(attr: string): string {
	const lower = normalizeAttrName(attr);
	if (lower === 'objectclass') return 'objectClass';
	return attr;
}
