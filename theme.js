/* Shared workspace behavior; conversion modules keep their existing contracts. */
(() => {
  'use strict';

  const icon = (name, size = 20, variant = 'regular') => window.ldifIcons?.[`${name}-${size}-${variant}`] || '';
  const root = document.documentElement;
  const systemTheme = matchMedia('(prefers-color-scheme: dark)');
  function savePreference(key, value) {
    try { localStorage.setItem(key, value); } catch { /* UI remains usable without storage. */ }
  }
  function setAppearance(preference) {
    root.dataset.appearance = preference;
    root.dataset.theme = preference === 'system' ? (systemTheme.matches ? 'dark' : 'light') : preference;
    document.querySelectorAll('[data-appearance]').forEach(button => {
      if (button !== root) button.setAttribute('aria-pressed', String(button.dataset.appearance === preference));
    });
    savePreference('ldif-appearance', preference);
  }
  function toast(message, { undo } = {}) {
    let region = document.querySelector('.toast-region');
    if (!region) {
      region = document.createElement('div');
      region.className = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      document.body.append(region);
    }
    const item = document.createElement('div');
    item.className = 'toast';
    item.innerHTML = `${icon('CheckmarkCircle', 20, 'filled')}<span class="toast-message"></span>`;
    item.querySelector('.toast-message').textContent = message;
    const dismiss = () => item.remove();
    if (undo) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Undo';
      button.addEventListener('click', () => { undo(); dismiss(); });
      item.append(button);
    }
    region.replaceChildren(item);
    setTimeout(dismiss, 5000);
  }
  systemTheme.addEventListener('change', () => {
    if (root.dataset.appearance === 'system') setAppearance('system');
  });

  const information = {
    help: {
      title: 'Using LDIF Builder',
      content: `<p>Choose a tool from the navigation. Files are processed in this browser; applying changes to a directory is a separate step.</p>
        <h3>CSV to LDIF</h3><p>Choose a CSV file, select whether to create or modify entries, map the columns to LDIF attributes, and review the output.</p>
        <h3>LDIF to CSV</h3><p>Choose a file or paste LDIF content, select attributes, and convert. Optional split rules turn combined values into separate columns.</p>
        <h3>LDIF cleaner</h3><p>Update attributes, or compare a master file with an extract and remove matching entries from the master.</p>
        <h3>Error fixer</h3><p>Choose the submitted LDIF and paste the LDAP error output. Review the proposed fixes and any unresolved errors before downloading.</p>
        <p><a href="USER_GUIDE.md" download>Download the full user guide</a></p>`,
    },
    privacy: {
      title: 'How your files are handled',
      content: `<p>File contents are read and processed in your browser. These tools do not upload your file contents or connect to your directory.</p>
        <p>Downloads are saved to the location chosen by your browser. Closing or reloading the page clears the current workspace; the app does not save your progress.</p>
        <p>Only your appearance and navigation preferences are stored on this device. Your uploaded files, pasted content, mappings, and results are not saved by the app.</p>
        <p>Use your organisation's approved browser and storage location when working with directory data.</p>`,
    },
    security: {
      title: 'Before applying directory changes',
      content: `<p>LDIF Builder prepares files. It does not authenticate to LDAP, execute imports, or verify your directory's schema.</p>
        <ul><li>Review generated DNs, attributes, and change operations.</li><li>Keep an original copy of your source files.</li><li>Test the output through your organisation's directory change process before importing it.</li></ul>
        <p>For supported behavior and known limitations, <a href="USER_GUIDE.md" download>download the user guide</a>.</p>`,
    },
  };

  function createDialog(title, content) {
    const dialog = document.createElement('dialog');
    dialog.className = 'info-dialog';
    dialog.setAttribute('aria-labelledby', 'dialog-title');
    dialog.innerHTML = `<h2 id="dialog-title">${title}</h2>${content}`;
    document.body.append(dialog);
    dialog.addEventListener('close', () => dialog.remove(), { once: true });
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) dialog.close();
    });
    return dialog;
  }

  function showError(target, message) {
    const targetElement = typeof target === 'string' ? document.getElementById(target) : target;
    const input = targetElement?.matches('input, textarea, select, [tabindex]')
      ? targetElement
      : targetElement?.querySelector('input, textarea, select') || targetElement;
    const container = input?.closest('.form-group, .paste-section, .card-body') || document.querySelector('.content');
    if (!container) return;
    let error = container.querySelector(':scope > .inline-error');
    if (!error) {
      error = document.createElement('p');
      error.className = 'inline-error';
      error.id = `validation-${target?.id || (typeof target === 'string' ? target : 'message')}`;
      error.setAttribute('role', 'alert');
      container.prepend(error);
    }
    error.innerHTML = icon('ErrorCircle', 16);
    error.append(document.createTextNode(message));
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      const descriptions = new Set((input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean));
      descriptions.add(error.id);
      input.setAttribute('aria-describedby', [...descriptions].join(' '));
      input.focus();
      input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid');
        descriptions.delete(error.id);
        if (descriptions.size) input.setAttribute('aria-describedby', [...descriptions].join(' '));
        else input.removeAttribute('aria-describedby');
        error.remove();
      }, { once: true });
    }
  }

  function askAttribute() {
    return new Promise((resolve) => {
      const dialog = createDialog('Add a directory attribute', `<form method="dialog" id="attribute-form"><div class="form-group"><label for="attribute-name">Attribute name</label><input id="attribute-name" class="input" autocomplete="off" spellcheck="false" autofocus aria-describedby="attribute-hint"><span class="hint" id="attribute-hint">Use letters, numbers, hyphens, or underscores.</span></div><div class="dialog-actions"><button class="btn btn-secondary" value="cancel" formnovalidate>Cancel</button><button class="btn btn-primary" value="add">Add attribute</button></div></form>`);
      const input = dialog.querySelector('input');
      const form = dialog.querySelector('form');
      form.addEventListener('submit', (event) => {
        if (event.submitter?.value === 'cancel') return;
        if (!/^[a-z0-9_-]+$/i.test(input.value.trim())) {
          event.preventDefault();
          showError(input, 'Enter an attribute name using letters, numbers, hyphens, or underscores.');
        } else dialog.returnValue = input.value.trim();
      });
      dialog.addEventListener('close', () => resolve(dialog.returnValue === 'cancel' || !dialog.returnValue ? null : input.value.trim()), { once: true });
      dialog.showModal();
    });
  }

  function watchFileReader(reader, status, zone) {
    let progress;
    zone?.setAttribute('aria-busy', 'true');
    const delay = setTimeout(() => {
      progress = document.createElement('progress');
      progress.setAttribute('aria-label', 'Reading file');
      const skeleton = document.createElement('span');
      skeleton.className = 'skeleton-line';
      skeleton.setAttribute('aria-hidden', 'true');
      skeleton.style.display = 'block';
      status.replaceChildren(document.createTextNode('Reading file '), progress, skeleton);
    }, 300);
    reader.addEventListener('progress', (event) => {
      if (progress && event.lengthComputable) {
        progress.max = event.total;
        progress.value = event.loaded;
      }
    });
    reader.addEventListener('loadend', () => {
      clearTimeout(delay);
      zone?.removeAttribute('aria-busy');
      if (!reader.error && zone) {
        zone.querySelector('.file-updated')?.remove();
        const time = document.createElement('time');
        time.className = 'file-updated';
        const loaded = Date.now();
        time.dataset.loaded = loaded;
        time.dateTime = new Date(loaded).toISOString();
        time.title = new Date(loaded).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
        zone.append(time);
        updateFileTimes();
      }
    }, { once: true });
    reader.addEventListener('error', () => {
      status.textContent = 'File could not be read.';
      showError(zone, 'This file could not be read. Choose the file again, or try a local copy.');
    }, { once: true });
  }

  function readFile(file, status, zone) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      watchFileReader(reader, status, zone);
      reader.addEventListener('load', () => resolve(reader.result), { once: true });
      reader.addEventListener('error', () => resolve(null), { once: true });
      reader.readAsText(file);
    });
  }

  async function copyText(text, button) {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      toast('Copied to clipboard');
      button.innerHTML = icon('Checkmark');
      button.title = 'Copied to clipboard';
      button.setAttribute('aria-label', 'Copied to clipboard');
      clearTimeout(button.copyTimer);
      button.copyTimer = setTimeout(() => {
        button.innerHTML = icon('Copy');
        button.title = 'Copy to clipboard';
        button.setAttribute('aria-label', 'Copy to clipboard');
      }, 1500);
    } catch {
      showError(button, 'Clipboard access is unavailable. Select and copy the preview text, or download the file.');
    }
  }

  window.ldifUi = { showError, askAttribute, watchFileReader, readFile, copyText, toast };

  // The same discoverable actions are available on every page.
  const bar = document.querySelector('.workspace-bar');
  const breadcrumb = bar?.querySelector('.breadcrumb');
  const sidebar = document.querySelector('.sidebar');
  const shortcut = /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Ctrl K';
  if (bar && breadcrumb) {
    const workspaceLocation = document.createElement('div');
    workspaceLocation.className = 'workspace-location';
    sidebar.id = 'workspace-sidebar';
    const menuToggle = document.createElement('button');
    menuToggle.type = 'button';
    menuToggle.className = 'btn-icon menu-toggle';
    menuToggle.innerHTML = icon('Navigation');
    menuToggle.title = 'Open navigation';
    menuToggle.setAttribute('aria-label', 'Open navigation');
    menuToggle.setAttribute('aria-controls', 'workspace-sidebar');
    menuToggle.setAttribute('aria-expanded', 'false');
    const scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    scrim.addEventListener('click', () => setNavOpen(false));
    document.querySelector('.app').append(scrim);
    function setNavOpen(open) {
      root.classList.toggle('nav-open', open);
      menuToggle.setAttribute('aria-expanded', String(open));
      if (open) sidebar.querySelector('.nav-item.active, .nav-item')?.focus();
      else if (sidebar.contains(document.activeElement)) menuToggle.focus();
    }
    menuToggle.addEventListener('click', () => setNavOpen(!root.classList.contains('nav-open')));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && root.classList.contains('nav-open') && !document.querySelector('dialog[open]')) setNavOpen(false);
    });
    const railToggle = document.createElement('button');
    railToggle.type = 'button';
    railToggle.className = 'btn-icon rail-toggle';
    function updateRail() {
      const collapsed = root.classList.contains('rail-collapsed');
      railToggle.innerHTML = icon(collapsed ? 'PanelLeftExpand' : 'PanelLeftContract');
      railToggle.title = collapsed ? 'Expand navigation' : 'Collapse navigation';
      railToggle.setAttribute('aria-label', railToggle.title);
      railToggle.setAttribute('aria-expanded', String(!collapsed));
      railToggle.setAttribute('aria-controls', 'workspace-sidebar');
    }
    document.querySelectorAll('.nav-item, .logo').forEach(link => {
      const label = link.textContent.trim();
      link.title = label;
      link.setAttribute('aria-label', label);
    });
    railToggle.addEventListener('click', () => {
      root.classList.toggle('rail-collapsed');
      savePreference('ldif-navigation', root.classList.contains('rail-collapsed') ? 'collapsed' : 'expanded');
      updateRail();
    });
    updateRail();
    workspaceLocation.append(menuToggle, railToggle, breadcrumb);
    bar.prepend(workspaceLocation);

    // The brand mark is a small tile in the accent.
    const logoIcon = sidebar.querySelector('.logo-icon');
    if (logoIcon) logoIcon.innerHTML = icon('Document', 16);

    // Search opens the command palette from the top of the frame.
    const search = document.createElement('button');
    search.type = 'button';
    search.className = 'command-trigger';
    search.innerHTML = `<span>${icon('Search')}<span class="trigger-label">Search</span></span><kbd>${shortcut}</kbd>`;
    search.title = `Search pages and actions (${shortcut})`;
    search.setAttribute('aria-label', `Search pages and actions, ${shortcut}`);
    search.setAttribute('aria-haspopup', 'dialog');
    search.setAttribute('aria-keyshortcuts', 'Control+k Meta+k');
    search.addEventListener('click', () => { setNavOpen(false); openCommands(); });
    sidebar.querySelector('.logo')?.after(search);

    const actions = document.createElement('div');
    actions.className = 'workspace-actions';
    const local = document.createElement('span');
    local.className = 'tag tag-green';
    local.innerHTML = `${icon('LockClosed', 16)}In your browser`;
    local.title = 'File contents are processed in this browser and are not uploaded.';
    const appearance = document.createElement('div');
    appearance.className = 'appearance-control';
    appearance.setAttribute('role', 'group');
    appearance.setAttribute('aria-label', 'Appearance');
    for (const [value, label, glyph] of [['light', 'Light theme', 'WeatherSunny'], ['dark', 'Dark theme', 'WeatherMoon'], ['system', 'Follow system theme', 'Desktop']]) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'btn-icon';
      button.dataset.appearance = value;
      button.title = label;
      button.setAttribute('aria-label', label);
      button.innerHTML = icon(glyph);
      button.addEventListener('click', () => setAppearance(value));
      appearance.append(button);
    }
    actions.append(local, appearance);
    bar.append(actions);
    setAppearance(root.dataset.appearance || 'system');
  }

  // Every page opens like a document: icon tile, title, one-line description, properties.
  const pageProps = {
    'csv-to-ldif': { glyph: 'Document', input: 'CSV file', output: 'LDIF file' },
    'ldif-to-csv': { glyph: 'Table', input: 'LDIF file or pasted LDIF', output: 'CSV file' },
    'ldif-cleaner': { glyph: 'Broom', input: 'LDIF file, plus a comparison file to remove entries', output: 'Updated LDIF file' },
    'ldif-error-fixer': { glyph: 'ShieldCheckmark', input: 'Submitted LDIF and LDAP error output', output: 'Corrected LDIF file' },
  };
  const slug = window.location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
  const pageHeader = document.querySelector('.header');
  const pageConfig = pageProps[slug];
  if (pageHeader && (pageConfig || slug === 'index')) {
    const tile = document.createElement('div');
    tile.className = 'page-icon';
    tile.innerHTML = icon(pageConfig?.glyph || 'Home', 32);
    pageHeader.firstElementChild.prepend(tile);
  }
  if (pageHeader && pageConfig) {
    const props = document.createElement('div');
    props.className = 'page-props';
    const row = (glyph, label, value) => `<div class="prop"><dt>${icon(glyph, 16)}${label}</dt><dd>${value}</dd></div>`;
    props.innerHTML = `<dl class="props">${row('ArrowUpload', 'Input', pageConfig.input)}${row('ArrowDownload', 'Output', pageConfig.output)}${row('LockClosed', 'Processing', '<span class="tag tag-green">In your browser</span>')}</dl>`;
    pageHeader.after(props);
  }

  function openCommands() {
    if (document.querySelector('dialog[open]')) return;
    const commands = [...document.querySelectorAll('.nav-item')].map(link => ({
      label: link.textContent.trim(),
      description: link.getAttribute('aria-current') ? 'Current page' : (link.dataset.info ? 'Instructions and user guide' : 'Open page'),
      group: 'Pages',
      glyph: link.querySelector('svg')?.outerHTML || icon('Document'),
      run: () => link.click(),
    }));
    const upload = [...document.querySelectorAll('.upload-zone')].find(zone => zone.getClientRects().length);
    if (upload) commands.push({ label: 'Choose a source file', description: 'Open the file picker', group: 'Actions', glyph: icon('ArrowUpload', 24), run: () => upload.querySelector('input[type="file"]')?.click() });
    for (const [label, value, glyph] of [['Use light theme', 'light', 'WeatherSunny'], ['Use dark theme', 'dark', 'WeatherMoon'], ['Follow system theme', 'system', 'Desktop']]) {
      commands.push({ label, description: 'Change appearance on this device', group: 'Actions', glyph: icon(glyph), run: () => setAppearance(value) });
    }
    const dialog = createDialog('Search tools and actions', '');
    dialog.classList.add('command-dialog');
    dialog.innerHTML = `<h2 id="dialog-title" class="sr-only">Search tools and actions</h2>
      <div class="command-search">${icon('Search')}<label for="command-query" class="sr-only">Search tools and actions</label><input id="command-query" placeholder="Search pages and actions" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="command-results" autofocus><button type="button" class="esc-key" aria-label="Close search" title="Close search (Esc)"><kbd>Esc</kbd></button></div>
      <div id="command-results" class="command-results" role="listbox" aria-label="Tools and actions"></div>
      <span id="command-count" class="sr-only" role="status"></span>
      <div class="command-footer"><span><kbd>${icon('ArrowUp', 16)}</kbd><kbd>${icon('ArrowDown', 16)}</kbd>Move</span><span><kbd>${icon('ArrowEnterLeft')}</kbd>Open</span></div>`;
    const input = dialog.querySelector('input');
    const results = dialog.querySelector('.command-results');
    let filtered = commands, selected = 0;
    function select(index) {
      selected = filtered.length ? (index + filtered.length) % filtered.length : -1;
      results.querySelectorAll('[role="option"]').forEach((row, n) => row.setAttribute('aria-selected', String(n === selected)));
      const row = results.querySelector(`[data-index="${selected}"]`);
      if (row) { input.setAttribute('aria-activedescendant', row.id); row.scrollIntoView({ block: 'nearest' }); }
      else input.removeAttribute('aria-activedescendant');
    }
    function render() {
      const query = input.value.trim().toLowerCase();
      filtered = commands.filter(command => `${command.label} ${command.description}`.toLowerCase().includes(query));
      results.replaceChildren();
      let group;
      filtered.forEach((command, index) => {
        if (command.group !== group) {
          group = command.group;
          const heading = document.createElement('div');
          heading.className = 'command-group';
          heading.setAttribute('role', 'presentation');
          heading.textContent = group;
          results.append(heading);
        }
        const row = document.createElement('button');
        row.type = 'button'; row.className = 'command-option'; row.tabIndex = -1;
        row.id = `command-option-${index}`; row.dataset.index = index;
        row.setAttribute('role', 'option');
        row.innerHTML = `${command.glyph}<span>${command.label}<span class="command-description">${command.description}</span></span><kbd>Enter</kbd>`;
        row.addEventListener('click', () => { dialog.close(); command.run(); });
        results.append(row);
      });
      if (!filtered.length) {
        const empty = document.createElement('p');
        empty.className = 'command-empty';
        empty.textContent = 'Nothing matches. Try “CSV”, “cleaner”, or “theme”.';
        results.append(empty);
      }
      dialog.querySelector('#command-count').textContent = `${filtered.length} actions available`;
      select(0);
    }
    input.addEventListener('input', render);
    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault(); if (filtered.length) select(selected + (event.key === 'ArrowDown' ? 1 : -1));
      }
      if (event.key === 'Enter' && filtered[selected]) {
        event.preventDefault(); dialog.close(); filtered[selected].run();
      }
    });
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    dialog.showModal();
    render();
  }
  document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault(); openCommands();
    }
  });

  // Empty states link to a useful next step rather than a dead end.
  document.querySelectorAll('.empty-state').forEach(empty => {
    const actions = document.createElement('div');
    actions.className = 'empty-actions';
    const choose = document.createElement('button');
    choose.type = 'button'; choose.className = 'btn btn-secondary';
    choose.textContent = 'Choose a source file';
    choose.addEventListener('click', () => document.querySelector('.upload-zone input[type="file"]')?.click());
    const help = document.createElement('button');
    help.type = 'button'; help.className = 'btn-icon empty-help';
    help.textContent = 'Learn more'; help.dataset.info = 'help';
    actions.append(choose, help); empty.append(actions);
  });

  // Each loaded file has a truthful relative time and an exact tooltip.
  const relativeTime = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  function updateFileTimes() {
    document.querySelectorAll('.file-updated').forEach(time => {
      const minutes = Math.max(0, Math.floor((Date.now() - Number(time.dataset.loaded)) / 60000));
      let label = 'just now';
      if (minutes >= 10080) label = new Date(Number(time.dataset.loaded)).toLocaleDateString();
      else if (minutes >= 1440) label = relativeTime.format(-Math.floor(minutes / 1440), 'day');
      else if (minutes >= 60) label = relativeTime.format(-Math.floor(minutes / 60), 'hour');
      else if (minutes >= 1) label = relativeTime.format(-minutes, 'minute');
      time.textContent = `Loaded ${label}`;
    });
  }
  setInterval(updateFileTimes, 60000);
  document.querySelectorAll('#resetBtn, #efResetBtn').forEach(button => button.addEventListener('click', () => document.querySelectorAll('.file-updated').forEach(time => time.remove())));

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-info]');
    if (!trigger) return;
    const info = information[trigger.dataset.info];
    if (!info) return;
    event.preventDefault();
    const dialog = createDialog(info.title, `${info.content}<form method="dialog" class="dialog-actions"><button class="btn btn-secondary" autofocus>Close</button></form>`);
    dialog.showModal();
  });

  // Give each drop target the same keyboard behavior as choosing a file.
  document.querySelectorAll('.upload-zone').forEach((zone) => {
    const input = zone.querySelector('input[type="file"]');
    if (!input) return;
    zone.tabIndex = 0;
    zone.setAttribute('role', 'button');
    const title = zone.querySelector('.upload-text strong')?.textContent || 'Choose a file';
    zone.setAttribute('aria-label', `${title}. Choose a file. Accepted formats: ${input.accept}`);
    zone.addEventListener('keydown', (event) => {
      if (event.target === zone && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        input.click();
      }
    });
    // The file input is nested inside the click target. Stop the programmatic
    // input click from bubbling back into the zone's click-to-open handler.
    input.addEventListener('click', (event) => event.stopPropagation());
    const formats = document.createElement('span');
    formats.className = 'hint';
    formats.style.display = 'block';
    formats.style.marginBlockStart = 'var(--space-2)';
    formats.textContent = `${input.accept.split(',').join(', ')} files. Size is limited by available browser memory.`;
    zone.append(formats);
  });

  // Labels and live feedback also cover controls rendered by conversion modules.
  function enhanceControls(root = document) {
    root.querySelectorAll('button[title]:not([aria-label])').forEach((button) => {
      if (!button.textContent.trim()) button.setAttribute('aria-label', button.title);
    });
    root.querySelectorAll('button[data-remove], button[data-remove-repeatable]').forEach((button) => {
      button.setAttribute('aria-label', `Remove ${button.dataset.remove || button.dataset.removeRepeatable}`);
    });
    root.querySelectorAll('#splitColumnNames input').forEach((field, index) => {
      field.setAttribute('aria-label', `Output column ${index + 1} name`);
    });
    root.querySelectorAll('textarea, input:not([type="hidden"]):not([type="radio"]):not([type="checkbox"]), select').forEach((field) => {
      if (field.labels?.length || field.hasAttribute('aria-label') || field.hasAttribute('aria-labelledby')) return;
      const group = field.closest('.form-group, .paste-section, .output-preview, .card-body');
      const label = group?.querySelector('label, .paste-header span')?.textContent.trim();
      const heading = field.closest('.card')?.querySelector('h2')?.textContent.trim();
      field.setAttribute('aria-label', label || heading || 'Directory attribute value');
    });
    root.querySelectorAll('.upload-status, .file-status, .preview-info').forEach((status) => {
      status.setAttribute('role', 'status');
      status.setAttribute('aria-live', 'polite');
    });
    root.querySelectorAll('.file-info.error').forEach((error) => error.setAttribute('role', 'alert'));
    root.querySelectorAll('.attribute-item').forEach((item) => {
      item.tabIndex = 0;
      item.setAttribute('role', 'button');
      item.setAttribute('aria-pressed', String(item.classList.contains('selected') || item.classList.contains('mapped')));
    });
  }
  enhanceControls();
  const content = document.querySelector('.content');
  if (content) new MutationObserver(() => enhanceControls(content)).observe(content, { childList: true, subtree: true });
  document.addEventListener('keydown', (event) => {
    if (event.target.matches('.attribute-item') && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      const attribute = event.target.dataset.attr;
      const column = event.target.dataset.col;
      event.target.click();
      enhanceControls(content);
      const selector = attribute !== undefined
        ? `#ldifAttributesList [data-attr="${CSS.escape(attribute)}"]`
        : `#csvColumnsList [data-col="${CSS.escape(column)}"]`;
      document.querySelector(selector)?.focus();
    }
  });

  const offline = document.createElement('p');
  offline.className = 'offline-banner';
  offline.setAttribute('role', 'status');
  offline.textContent = 'You are offline. The loaded tools still process files locally. Keep this page open to retain your work.';
  offline.hidden = navigator.onLine;
  document.querySelector('.workspace-bar')?.after(offline);
  window.addEventListener('online', () => { offline.hidden = true; });
  window.addEventListener('offline', () => { offline.hidden = false; });
})();
