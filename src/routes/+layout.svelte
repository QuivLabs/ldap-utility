<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import Icon from '$lib/components/Icon.svelte';
	import CommandPalette from '$lib/components/CommandPalette.svelte';
	import InfoDialog from '$lib/components/InfoDialog.svelte';
	import { tools, breadcrumbs } from '$lib/nav';
	import {
		getAppearance,
		getCollapsed,
		setAppearance,
		toggleRail,
		syncDocumentTheme,
		type Appearance
	} from '$lib/appearance.svelte';

	let { children } = $props();

	let commandOpen = $state(false);
	let infoKind = $state<null | 'help' | 'privacy' | 'security'>(null);
	let offline = $state(false);

	const pathname = $derived($page.url.pathname);
	const crumb = $derived(breadcrumbs[pathname] ?? 'Workspace');
	const appearance = $derived(getAppearance());
	const collapsed = $derived(getCollapsed());
	const shortcut = $derived(
		typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K'
	);

	onMount(() => {
		syncDocumentTheme();
		offline = !navigator.onLine;
		const onOnline = () => (offline = false);
		const onOffline = () => (offline = true);
		const onKey = (event: KeyboardEvent) => {
			if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
				event.preventDefault();
				commandOpen = true;
			}
		};
		const onInfo = (event: Event) => {
			const detail = (event as CustomEvent<string>).detail;
			if (detail === 'help' || detail === 'privacy' || detail === 'security') infoKind = detail;
		};
		const onClickInfo = (event: MouseEvent) => {
			const trigger = (event.target as HTMLElement | null)?.closest?.('[data-info]');
			if (!trigger) return;
			const kind = (trigger as HTMLElement).dataset.info;
			if (kind === 'help' || kind === 'privacy' || kind === 'security') {
				event.preventDefault();
				infoKind = kind;
			}
		};
		window.addEventListener('online', onOnline);
		window.addEventListener('offline', onOffline);
		document.addEventListener('keydown', onKey);
		window.addEventListener('ldif-info', onInfo);
		document.addEventListener('click', onClickInfo);
		return () => {
			window.removeEventListener('online', onOnline);
			window.removeEventListener('offline', onOffline);
			document.removeEventListener('keydown', onKey);
			window.removeEventListener('ldif-info', onInfo);
			document.removeEventListener('click', onClickInfo);
		};
	});

	function appearancePressed(value: Appearance) {
		return appearance === value;
	}
</script>

<a class="skip-link" href="#main-content">Skip to content</a>
<div class="app">
	<aside class="sidebar" id="workspace-sidebar" aria-label="Workspace navigation">
		<a class="logo" href="/" title="LDIF Builder" aria-label="LDIF Builder">
			<span class="logo-icon"><Icon name="Document" size={32} /></span>
			<span>LDIF Builder</span>
		</a>
		<nav class="nav" aria-label="Main navigation">
			{#each tools as tool, index (tool.href)}
				{#if tool.group && (index === 0 || tools[index - 1].group !== tool.group)}
					<div class="nav-label">{tool.group}</div>
				{/if}
				<a
					href={tool.href}
					class="nav-item"
					class:active={pathname === tool.href}
					aria-current={pathname === tool.href ? 'page' : undefined}
					title={tool.label}
					aria-label={tool.label}
				>
					<Icon name={tool.icon} variant={pathname === tool.href ? 'filled' : 'regular'} />
					{tool.label}
				</a>
			{/each}
			<div class="nav-label">Resources</div>
			<button
				type="button"
				class="nav-item"
				data-info="help"
				title="Help & user guide"
				aria-label="Help & user guide"
				onclick={() => (infoKind = 'help')}
			>
				<Icon name="BookOpen" />
				Help &amp; user guide
			</button>
		</nav>
		<div class="sidebar-footer">
			<div class="local-note">
				<Icon name="LockClosed" size={16} />
				<div>
					<strong>Local file processing</strong>
					Your file contents stay in your browser.
				</div>
			</div>
			<span class="version">LDIF Builder v1.0.0</span>
		</div>
	</aside>

	<main class="main" id="main-content" tabindex="-1">
		<div class="workspace-bar">
			<div class="workspace-location">
				<button
					type="button"
					class="btn-icon rail-toggle"
					title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
					aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
					aria-expanded={!collapsed}
					aria-controls="workspace-sidebar"
					onclick={toggleRail}
				>
					<Icon name={collapsed ? 'PanelLeftExpand' : 'PanelLeftContract'} />
				</button>
				<div class="breadcrumb">
					<a href="/">Workspace</a>
					<span aria-hidden="true">/</span>
					<span>{crumb}</span>
				</div>
			</div>
			<span class="processing-note">
				<Icon name="LockClosed" size={16} />
				Browser-based processing
			</span>
			<div class="workspace-actions">
				<button
					type="button"
					class="command-trigger"
					title={`Search tools and actions (${shortcut})`}
					aria-haspopup="dialog"
					aria-keyshortcuts="Control+k Meta+k"
					onclick={() => (commandOpen = true)}
				>
					<span><Icon name="Search" />Search tools</span>
					<kbd>{shortcut}</kbd>
				</button>
				<div class="appearance-control" role="group" aria-label="Appearance">
					{#each [
						['light', 'Light theme', 'WeatherSunny'],
						['dark', 'Dark theme', 'WeatherMoon'],
						['system', 'Follow system theme', 'Desktop']
					] as [value, label, glyph]}
						<button
							type="button"
							class="btn-icon"
							data-appearance={value}
							title={label}
							aria-label={label}
							aria-pressed={appearancePressed(value as Appearance)}
							onclick={() => setAppearance(value as Appearance)}
						>
							<Icon name={glyph} />
						</button>
					{/each}
				</div>
			</div>
		</div>

		<p class="offline-banner" role="status" hidden={!offline}>
			You are offline. The loaded tools still process files locally. Keep this page open to retain your work.
		</p>

		{@render children()}
	</main>
</div>

<CommandPalette bind:open={commandOpen} />
<InfoDialog bind:kind={infoKind} />

<style>
	:global(.nav-item) {
		/* button.nav-item matches anchor.nav-item */
		font: inherit;
		border: none;
		background: transparent;
		width: 100%;
		text-align: left;
		cursor: pointer;
	}
</style>
