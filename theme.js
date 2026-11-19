/* Shared interface behavior. The identity is fixed; there are no theme overrides. */
(() => {
  'use strict';

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
    error.textContent = message;
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
      status.replaceChildren(document.createTextNode('Reading file '), progress);
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
      const header = button.closest('.preview-header');
      let confirmation = header.querySelector('.copy-confirmation');
      if (!confirmation) {
        confirmation = document.createElement('span');
        confirmation.className = 'copy-confirmation';
        confirmation.setAttribute('role', 'status');
        header.insertBefore(confirmation, button);
      }
      confirmation.textContent = 'Copied to clipboard';
      setTimeout(() => confirmation.remove(), 4000);
    } catch {
      showError(button, 'Clipboard access is unavailable. Select and copy the preview text, or download the file.');
    }
  }

  window.ldifUi = { showError, askAttribute, watchFileReader, readFile, copyText };

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
