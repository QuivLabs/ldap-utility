export type LdifEntry = Record<string, string[]>;

export function parseLdif(ldifText: string): LdifEntry[] {
	const entries: LdifEntry[] = [];
	let currentEntry: LdifEntry | null = null;
	let currentAttr: string | null = null;
	let currentValue = '';
	let isBase64 = false;

	const lines = ldifText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

	const flushAttr = () => {
		if (!currentAttr || !currentEntry) return;
		let finalValue = currentValue;
		if (isBase64) {
			try {
				finalValue = atob(currentValue.trim());
			} catch {
				finalValue = currentValue;
			}
		}
		if (!currentEntry[currentAttr]) currentEntry[currentAttr] = [];
		currentEntry[currentAttr].push(finalValue.trim());
	};

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];

		if (line.startsWith(' ') && currentAttr) {
			currentValue += line.substring(1);
			continue;
		}

		flushAttr();
		currentAttr = null;
		currentValue = '';
		isBase64 = false;

		if (line.startsWith('#')) continue;

		if (line.trim() === '') {
			if (currentEntry && Object.keys(currentEntry).length > 0) entries.push(currentEntry);
			currentEntry = null;
			continue;
		}

		if (line.toLowerCase().startsWith('version:')) continue;

		const colonIndex = line.indexOf(':');
		if (colonIndex > 0) {
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

			if (currentAttr.toLowerCase() === 'dn') {
				currentEntry = {};
			}
		}
	}

	flushAttr();
	if (currentEntry && Object.keys(currentEntry).length > 0) entries.push(currentEntry);

	return entries;
}

export function extractAttributeStats(entries: LdifEntry[]) {
	const attributeCounts: Record<string, number> = {};
	const attributeSet = new Set<string>();

	entries.forEach((entry) => {
		Object.keys(entry).forEach((attr) => {
			attributeSet.add(attr);
			attributeCounts[attr] = (attributeCounts[attr] || 0) + 1;
		});
	});

	const attributes = Array.from(attributeSet).sort((a, b) => {
		if (a.toLowerCase() === 'dn') return -1;
		if (b.toLowerCase() === 'dn') return 1;
		return a.toLowerCase().localeCompare(b.toLowerCase());
	});

	return {
		attributes,
		counts: attributeCounts,
		available: attributes.map((attr) => ({
			name: attr,
			count: attributeCounts[attr] || 0,
			percentage: entries.length
				? Math.round(((attributeCounts[attr] || 0) / entries.length) * 100)
				: 0
		}))
	};
}
