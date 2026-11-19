export function downloadBlob(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
	const blob = new Blob([content], { type: mime });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = filename;
	a.click();
	URL.revokeObjectURL(url);
}

export async function copyText(text: string): Promise<boolean> {
	try {
		if (!navigator.clipboard) return false;
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}

export function readFileAsText(file: File): Promise<string | null> {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.addEventListener('load', () => resolve(String(reader.result ?? '')), { once: true });
		reader.addEventListener('error', () => resolve(null), { once: true });
		reader.readAsText(file);
	});
}
