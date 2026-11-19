import { browser } from '$app/environment';

export type Appearance = 'light' | 'dark' | 'system';

function readAppearance(): Appearance {
	if (!browser) return 'system';
	try {
		const value = localStorage.getItem('ldif-appearance');
		if (value === 'light' || value === 'dark' || value === 'system') return value;
	} catch {
		/* ignore */
	}
	return 'system';
}

function readCollapsed(): boolean {
	if (!browser) return false;
	try {
		return localStorage.getItem('ldif-navigation') === 'collapsed';
	} catch {
		return false;
	}
}

function resolvedTheme(preference: Appearance): 'light' | 'dark' {
	if (preference !== 'system') return preference;
	if (!browser) return 'light';
	return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

let appearance = $state<Appearance>(readAppearance());
let collapsed = $state(readCollapsed());

export function getAppearance() {
	return appearance;
}

export function getCollapsed() {
	return collapsed;
}

export function setAppearance(preference: Appearance) {
	appearance = preference;
	if (!browser) return;
	document.documentElement.dataset.appearance = preference;
	document.documentElement.dataset.theme = resolvedTheme(preference);
	try {
		localStorage.setItem('ldif-appearance', preference);
	} catch {
		/* ignore */
	}
}

export function toggleRail() {
	collapsed = !collapsed;
	if (!browser) return;
	document.documentElement.classList.toggle('rail-collapsed', collapsed);
	try {
		localStorage.setItem('ldif-navigation', collapsed ? 'collapsed' : 'expanded');
	} catch {
		/* ignore */
	}
}

export function syncDocumentTheme() {
	if (!browser) return;
	document.documentElement.dataset.appearance = appearance;
	document.documentElement.dataset.theme = resolvedTheme(appearance);
	document.documentElement.classList.toggle('rail-collapsed', collapsed);
}

if (browser) {
	matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
		if (appearance === 'system') setAppearance('system');
	});
}
