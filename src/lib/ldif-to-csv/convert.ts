import { escapeCsvValue } from '$lib/csv/parse';
import { extractAttributeStats, parseLdif, type LdifEntry } from '$lib/ldif/parse';

export type SplitRule = {
	id: number;
	sourceColumn: string;
	delimiter: string;
	columnNames: string[];
	enabled: boolean;
};

export function convertToCsv(
	entries: LdifEntry[],
	selectedAttributes: string[],
	splitRules: SplitRule[],
	options: { delimiter?: string; quoteChar?: string; multiValueSeparator?: string } = {}
): string {
	const { delimiter = ',', quoteChar = '"', multiValueSeparator = '; ' } = options;
	if (!entries.length || !selectedAttributes.length) return '';

	const headerColumns: string[] = [];
	selectedAttributes.forEach((attr) => {
		const splitRule = splitRules.find((rule) => rule.sourceColumn === attr && rule.enabled);
		if (splitRule) splitRule.columnNames.forEach((name) => headerColumns.push(name));
		else headerColumns.push(attr);
	});

	const lines = [headerColumns.map((col) => escapeCsvValue(col, delimiter, quoteChar)).join(delimiter)];

	entries.forEach((entry) => {
		const row: string[] = [];
		selectedAttributes.forEach((attr) => {
			const splitRule = splitRules.find((rule) => rule.sourceColumn === attr && rule.enabled);
			const values = entry[attr] || [];
			const combinedValue = values.join(multiValueSeparator);
			if (splitRule) {
				const parts = combinedValue.split(splitRule.delimiter);
				for (let i = 0; i < splitRule.columnNames.length; i++) {
					row.push(escapeCsvValue((parts[i] || '').trim(), delimiter, quoteChar));
				}
			} else {
				row.push(escapeCsvValue(combinedValue, delimiter, quoteChar));
			}
		});
		lines.push(row.join(delimiter));
	});

	return lines.join('\n');
}

export function getSplitPreview(
	entries: LdifEntry[],
	attribute: string,
	delimiter: string,
	limit = 5
): string[][] {
	const samples: string[][] = [];
	for (let i = 0; i < Math.min(limit, entries.length); i++) {
		const values = entries[i][attribute] || [];
		samples.push(
			values
				.join('; ')
				.split(delimiter)
				.map((p) => p.trim())
		);
	}
	return samples;
}

export { parseLdif, extractAttributeStats };
