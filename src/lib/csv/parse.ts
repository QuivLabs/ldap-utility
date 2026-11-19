export function detectDelimiter(line: string): string {
	const candidates = [',', ';', '\t', '|'];
	const scores = candidates.map((delim) => {
		let count = 0;
		for (let i = 0; i < line.length; i++) {
			if (line[i] === delim) count++;
		}
		return count;
	});
	const maxIdx = scores.indexOf(Math.max(...scores));
	return candidates[maxIdx] || ',';
}

export function parseCsv(text: string, delimiter: string): string[][] {
	const rows: string[][] = [];
	let field = '';
	let row: string[] = [];
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const ch = text[i];
		const next = text[i + 1];

		if (inQuotes) {
			if (ch === '"' && next === '"') {
				field += '"';
				i++;
			} else if (ch === '"') {
				inQuotes = false;
			} else {
				field += ch;
			}
		} else if (ch === '"') {
			inQuotes = true;
		} else if (ch === delimiter) {
			row.push(field.trim());
			field = '';
		} else if (ch === '\n') {
			row.push(field.trim());
			if (row.some((cell) => cell)) rows.push(row);
			row = [];
			field = '';
		} else if (ch !== '\r') {
			field += ch;
		}
	}

	if (field || row.length) {
		row.push(field.trim());
		if (row.some((cell) => cell)) rows.push(row);
	}

	return rows;
}

export function extractHeaders(rows: string[][]): string[] {
	if (!rows.length) return [];
	return rows[0].map((h) => h.trim()).filter(Boolean);
}

export function rowsToObjects(rows: string[][]): Record<string, string>[] {
	if (rows.length < 2) return [];
	const headers = rows[0];
	return rows.slice(1).map((r) => {
		const obj: Record<string, string> = {};
		headers.forEach((h, idx) => {
			obj[h] = r[idx] || '';
		});
		return obj;
	});
}

export function escapeCsvValue(value: string, delimiter = ',', quoteChar = '"'): string {
	const str = String(value ?? '');
	if (str.includes(quoteChar) || str.includes(delimiter) || str.includes('\n') || str.includes('\r')) {
		return quoteChar + str.replaceAll(quoteChar, quoteChar + quoteChar) + quoteChar;
	}
	return str;
}
