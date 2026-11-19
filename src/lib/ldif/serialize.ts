export function escapeLdif(val: string): string {
	let out = val.replace(/\\/g, '\\\\').replace(/\n/g, '\\n');
	if (/^\s/.test(out) || /^#/.test(out)) {
		out = ': ' + btoa(unescape(encodeURIComponent(out)));
	}
	return out;
}

export type LdifEntry = Record<string, string[]>;

export function entriesToLdif(entries: LdifEntry[]): string {
	const blocks: string[] = [];
	for (const entry of entries) {
		const lines: string[] = [];
		const dn = entry.dn?.[0] ?? entry.DN?.[0];
		if (dn) lines.push(`dn: ${dn}`);
		for (const [attr, values] of Object.entries(entry)) {
			if (attr.toLowerCase() === 'dn') continue;
			for (const value of values) {
				lines.push(`${attr}: ${escapeLdif(value)}`);
			}
		}
		blocks.push(lines.join('\n'));
	}
	return blocks.join('\n\n') + (blocks.length ? '\n' : '');
}
