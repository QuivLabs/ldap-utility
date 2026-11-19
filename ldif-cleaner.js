/**
 * LDIF Data Cleaner Module
 * Handles fixing attributes and removing duplicate entries from LDIF files
 */

class LdifDataCleaner {
  constructor() {
    this.fixLdifContent = '';
    this.extractLdifContent = '';
    this.masterLdifContent = '';
    this.fixedEntries = [];
    this.extractedEntries = [];
    this.masterEntries = [];
    this.cleanedEntries = [];
    this.duplicates = [];
    this.fixOperations = [];
    this.repeatableAttributes = new Set(['objectclass', 'replace']);
  }

  normalizeAttrName(name) {
    return (name || '').toString().trim().toLowerCase();
  }

  isRepeatableAttribute(name) {
    return this.repeatableAttributes.has(this.normalizeAttrName(name));
  }

  /**
   * Parse LDIF content into structured entries
   */
  parseLdif(ldifText) {
    const entries = [];
    let currentEntry = null;
    let currentAttr = null;
    let currentValue = '';
    let isBase64 = false;

    const lines = ldifText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Handle line folding
      if (line.startsWith(' ') && currentAttr) {
        currentValue += line.substring(1);
        continue;
      }

      // Process previous attribute if exists
      if (currentAttr && currentEntry) {
        let finalValue = currentValue;
        if (isBase64) {
          try {
            finalValue = atob(currentValue.trim());
          } catch (e) {
            finalValue = currentValue;
          }
        }

        if (!currentEntry[currentAttr]) {
          currentEntry[currentAttr] = [];
        }
        currentEntry[currentAttr].push(finalValue.trim());
      }

      currentAttr = null;
      currentValue = '';
      isBase64 = false;

      if (line.startsWith('#')) continue;

      if (line.trim() === '') {
        if (currentEntry && Object.keys(currentEntry).length > 0) {
          entries.push(currentEntry);
        }
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
          if (currentEntry && Object.keys(currentEntry).length > 0) {
            entries.push(currentEntry);
          }
          currentEntry = { dn: [currentValue] };
          currentAttr = null;
          currentValue = '';
        }
      }
    }

    if (currentEntry && Object.keys(currentEntry).length > 0) {
      entries.push(currentEntry);
    }

    return entries;
  }

  /**
   * Get normalized DN for comparison (case-insensitive)
   */
  getNormalizedDn(entry) {
    if (!entry.dn || !entry.dn[0]) return '';
    return entry.dn[0].toLowerCase().trim();
  }

  /**
   * Find duplicates between master and extract sheets
   */
  findDuplicates() {
    const extractDns = new Set(this.extractedEntries.map(e => this.getNormalizedDn(e)));
    this.duplicates = [];

    this.masterEntries.forEach((masterEntry, index) => {
      const normalizedDn = this.getNormalizedDn(masterEntry);
      if (extractDns.has(normalizedDn)) {
        this.duplicates.push({
          original: masterEntry,
          index: index,
          dn: masterEntry.dn ? masterEntry.dn[0] : 'Unknown'
        });
      }
    });

    // Remove duplicates from master entries
    const extractDnsSet = new Set(this.extractedEntries.map(e => this.getNormalizedDn(e)));
    this.cleanedEntries = this.masterEntries.filter(entry => {
      const normalizedDn = this.getNormalizedDn(entry);
      return !extractDnsSet.has(normalizedDn);
    });

    return {
      totalEntries: this.masterEntries.length,
      duplicatesFound: this.duplicates.length,
      cleanedCount: this.cleanedEntries.length
    };
  }

  /**
   * Apply fix operations to entries
   */
  applyFixOperations() {
    this.fixedEntries = JSON.parse(JSON.stringify(this.fixLdifContent ? this.parseLdif(this.fixLdifContent) : []));

    this.fixOperations.forEach(operation => {
      this.fixedEntries = this.fixedEntries.map(entry => {
        const fieldLower = this.normalizeAttrName(operation.field);
        const operationValue = (operation.value || '').toString().trim();
        const isRepeatable = this.isRepeatableAttribute(fieldLower);

        // Handle DN
        if (fieldLower === 'dn') {
          if (operation.action === 'replace') {
            entry.dn = [operation.value];
          }
        } else {
          const attrName = fieldLower;
          if (operation.action === 'add') {
            if (!entry[attrName]) entry[attrName] = [];
            if (operationValue && !entry[attrName].includes(operationValue)) {
              entry[attrName].push(operationValue);
            }
          } else if (operation.action === 'replace') {
            if (isRepeatable) {
              if (!entry[attrName]) entry[attrName] = [];
              if (operationValue && !entry[attrName].includes(operationValue)) {
                entry[attrName].push(operationValue);
              }
            } else {
              entry[attrName] = [operation.value];
            }
          } else if (operation.action === 'remove') {
            if (isRepeatable && operationValue) {
              const currentValues = Array.isArray(entry[attrName]) ? entry[attrName] : [];
              const filteredValues = currentValues.filter(value => value !== operationValue);
              if (filteredValues.length > 0) {
                entry[attrName] = filteredValues;
              } else {
                delete entry[attrName];
              }
            } else {
              delete entry[attrName];
            }
          }
        }

        return entry;
      });
    });

    return this.fixedEntries;
  }

  /**
   * Convert entries to LDIF format
   */
  entriesToLdif(entries) {
    const lines = [];

    entries.forEach((entry, idx) => {
      if (idx > 0) lines.push('');

      // DN must come first
      if (entry.dn && entry.dn[0]) {
        lines.push(`dn: ${entry.dn[0]}`);
      }

      // Process attributes alphabetically (except dn)
      const attributes = Object.keys(entry).filter(key => key !== 'dn').sort();

      attributes.forEach(attr => {
        const values = Array.isArray(entry[attr]) ? entry[attr] : [entry[attr]];
        values.forEach(value => {
          if (value) {
            lines.push(`${attr}: ${value}`);
          }
        });
      });
    });

    return lines.join('\n');
  }
}

// Initialize cleaner
const cleaner = new LdifDataCleaner();
let currentMode = 'fix';

// DOM Elements
const cleanModeRadios = document.querySelectorAll('input[name="cleanMode"]');
const fixModeSection = document.getElementById('fixMode');
const dedupModeSection = document.getElementById('dedupMode');
const fixOperationsSection = document.getElementById('fixOperations');
const dedupResultsSection = document.getElementById('dedupResults');
const fixOutputSection = document.getElementById('fixOutput');
const repeatablePresetEl = document.getElementById('repeatablePreset');
const addRepeatablePresetBtn = document.getElementById('addRepeatablePreset');
const customRepeatableAttrEl = document.getElementById('customRepeatableAttr');
const addCustomRepeatableBtn = document.getElementById('addCustomRepeatable');
const repeatableAttributesListEl = document.getElementById('repeatableAttributesList');

// Reset Button
document.getElementById('resetBtn').addEventListener('click', () => {
  location.reload();
});

// Mode switching
cleanModeRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    currentMode = e.target.value;
    const isFix = currentMode === 'fix';

    fixModeSection.classList.toggle('hidden', !isFix);
    fixOperationsSection.classList.toggle('hidden', !isFix);
    fixOutputSection.classList.toggle('hidden', !isFix);

    dedupModeSection.classList.toggle('hidden', isFix);
    dedupResultsSection.classList.toggle('hidden', isFix);
  });
});

// ===== FIX MODE =====

// Fix file upload
const fixDropZone = document.getElementById('fixDropZone');
const fixInput = document.getElementById('fixInput');
const fixFileStatus = document.getElementById('fixFileStatus');

fixDropZone.addEventListener('click', () => fixInput.click());
fixDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  fixDropZone.classList.add('drag-over');
});
fixDropZone.addEventListener('dragleave', () => {
  fixDropZone.classList.remove('drag-over');
});
fixDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  fixDropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    fixInput.files = e.dataTransfer.files;
    handleFixFileUpload();
  }
});

fixInput.addEventListener('change', handleFixFileUpload);

function handleFixFileUpload() {
  const file = fixInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  window.ldifUi.watchFileReader(reader, fixFileStatus, fixDropZone);
  reader.onload = (e) => {
    cleaner.fixLdifContent = e.target.result;
    cleaner.fixedEntries = cleaner.parseLdif(cleaner.fixLdifContent);

    const count = cleaner.fixedEntries.length;
    fixFileStatus.innerHTML = `<div class="file-info success"><svg data-fluent="CheckmarkCircle-16-regular" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8ZM8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM10.8536 6.85355C11.0488 6.65829 11.0488 6.34171 10.8536 6.14645C10.6583 5.95118 10.3417 5.95118 10.1464 6.14645L7.25 9.04289L5.85355 7.64645C5.65829 7.45118 5.34171 7.45118 5.14645 7.64645C4.95118 7.84171 4.95118 8.15829 5.14645 8.35355L6.89645 10.1036C7.09171 10.2988 7.40829 10.2988 7.60355 10.1036L10.8536 6.85355Z" fill="currentColor"/></svg> Loaded ${count} entries</div>`;
    fixOperationsSection.classList.remove('hidden');

    // Initialize first fix operation
    if (cleaner.fixOperations.length === 0) {
      cleaner.fixOperations.push({ field: 'dn', action: 'replace', value: '' });
      renderFixOperations();
    }
  };
  reader.readAsText(file);
}

function renderFixOperations() {
  const container = document.getElementById('fixOperationsList');
  container.innerHTML = '';

  cleaner.fixOperations.forEach((op, idx) => {
    const opDiv = document.createElement('div');
    opDiv.className = 'operation-card';
    opDiv.innerHTML = `
      <div class="operation-header">
        <h4>Fix #${idx + 1}</h4>
        ${idx > 0 ? `<button class="btn-icon danger" onclick="removeFixOperation(${idx})" aria-label="Remove update operation ${idx + 1}">
          <svg data-fluent="Delete-16-regular" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M7 3H9C9 2.44772 8.55228 2 8 2C7.44772 2 7 2.44772 7 3ZM6 3C6 1.89543 6.89543 1 8 1C9.10457 1 10 1.89543 10 3H14C14.2761 3 14.5 3.22386 14.5 3.5C14.5 3.77614 14.2761 4 14 4H13.4364L12.2313 12.8378C12.0624 14.0765 11.0044 15 9.75422 15H6.24578C4.99561 15 3.93762 14.0765 3.76871 12.8378L2.56355 4H2C1.72386 4 1.5 3.77614 1.5 3.5C1.5 3.22386 1.72386 3 2 3H6ZM7 6.5C7 6.22386 6.77614 6 6.5 6C6.22386 6 6 6.22386 6 6.5V11.5C6 11.7761 6.22386 12 6.5 12C6.77614 12 7 11.7761 7 11.5V6.5ZM9.5 6C9.77614 6 10 6.22386 10 6.5V11.5C10 11.7761 9.77614 12 9.5 12C9.22386 12 9 11.7761 9 11.5V6.5C9 6.22386 9.22386 6 9.5 6ZM4.75954 12.7027C4.86089 13.4459 5.49568 14 6.24578 14H9.75422C10.5043 14 11.1391 13.4459 11.2405 12.7027L12.4272 4H3.57281L4.75954 12.7027Z" fill="currentColor"/></svg>
        </button>` : ''}
      </div>
      <div class="operation-body">
        <div class="operation-row">
          <div class="form-group">
            <label>Field to update</label>
            <input type="text" class="fix-field" value="${op.field}" placeholder="e.g., DN, objectClass, mail" />
          </div>
          <div class="form-group">
            <label>Action</label>
            <select class="fix-action">
              <option value="replace" ${op.action === 'replace' ? 'selected' : ''}>Replace</option>
              <option value="add" ${op.action === 'add' ? 'selected' : ''}>Add</option>
              <option value="remove" ${op.action === 'remove' ? 'selected' : ''}>Remove</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>New Value (if applicable)</label>
          <input type="text" class="fix-value" value="${op.value}" placeholder="Enter the new value for this field" />
        </div>
      </div>
    `;
    container.appendChild(opDiv);
  });

  // Attach event listeners
  document.querySelectorAll('.fix-field').forEach((el, idx) => {
    el.addEventListener('change', (e) => {
      cleaner.fixOperations[idx].field = e.target.value;
    });
  });

  document.querySelectorAll('.fix-action').forEach((el, idx) => {
    el.addEventListener('change', (e) => {
      cleaner.fixOperations[idx].action = e.target.value;
    });
  });

  document.querySelectorAll('.fix-value').forEach((el, idx) => {
    el.addEventListener('change', (e) => {
      cleaner.fixOperations[idx].value = e.target.value;
    });
  });
}

function toDisplayAttrName(attrName) {
  const normalized = cleaner.normalizeAttrName(attrName);
  if (normalized === 'objectclass') return 'objectClass';
  return normalized;
}

function renderRepeatableAttributes() {
  if (!repeatableAttributesListEl) return;

  const attributes = Array.from(cleaner.repeatableAttributes).sort((a, b) => a.localeCompare(b));
  repeatableAttributesListEl.innerHTML = '';

  attributes.forEach(attr => {
    const chip = document.createElement('span');
    chip.className = 'repeatable-attribute-chip';

    const text = document.createElement('span');
    text.textContent = toDisplayAttrName(attr);
    chip.appendChild(text);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.setAttribute('aria-label', `Remove ${attr} from repeatable attributes`);
    removeBtn.innerHTML = window.ldifIcons['Dismiss-16-regular'];
    removeBtn.addEventListener('click', () => {
      cleaner.repeatableAttributes.delete(cleaner.normalizeAttrName(attr));
      renderRepeatableAttributes();

      if (cleaner.fixLdifContent) {
        const fixed = cleaner.applyFixOperations();
        const ldifOutput = cleaner.entriesToLdif(fixed);
        document.getElementById('fixedLdifOutput').value = ldifOutput;
        fixOutputSection.classList.remove('hidden');
      }
    });

    chip.appendChild(removeBtn);
    repeatableAttributesListEl.appendChild(chip);
  });
}

function addRepeatableAttribute(attrName) {
  const normalized = cleaner.normalizeAttrName(attrName);
  if (!normalized) return;

  cleaner.repeatableAttributes.add(normalized);
  renderRepeatableAttributes();

  if (cleaner.fixLdifContent) {
    const fixed = cleaner.applyFixOperations();
    const ldifOutput = cleaner.entriesToLdif(fixed);
    document.getElementById('fixedLdifOutput').value = ldifOutput;
    fixOutputSection.classList.remove('hidden');
  }
}

if (addRepeatablePresetBtn) {
  addRepeatablePresetBtn.addEventListener('click', () => {
    addRepeatableAttribute(repeatablePresetEl.value);
  });
}

if (addCustomRepeatableBtn) {
  addCustomRepeatableBtn.addEventListener('click', () => {
    addRepeatableAttribute(customRepeatableAttrEl.value);
    customRepeatableAttrEl.value = '';
  });
}

if (customRepeatableAttrEl) {
  customRepeatableAttrEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addRepeatableAttribute(customRepeatableAttrEl.value);
      customRepeatableAttrEl.value = '';
    }
  });
}

renderRepeatableAttributes();

function removeFixOperation(idx) {
  cleaner.fixOperations.splice(idx, 1);
  renderFixOperations();
}

document.getElementById('addFixOperation').addEventListener('click', () => {
  cleaner.fixOperations.push({ field: '', action: 'replace', value: '' });
  renderFixOperations();
});

// Generate fixed LDIF
document.getElementById('fixOperations').addEventListener('click', (e) => {
  // Listen for any button clicks that might trigger fix operations
  const btns = document.querySelectorAll('#fixOutput button[id]');
  // Find if there's a generate button or if we need to auto-generate on change
});

// Auto-generate on operations change
document.addEventListener('change', (e) => {
  if (e.target.closest('#fixOperations') && cleaner.fixLdifContent) {
    const fixed = cleaner.applyFixOperations();
    const ldifOutput = cleaner.entriesToLdif(fixed);
    document.getElementById('fixedLdifOutput').value = ldifOutput;
    fixOutputSection.classList.remove('hidden');
  }
});

document.getElementById('downloadFixedLdif').addEventListener('click', () => {
  const content = document.getElementById('fixedLdifOutput').value;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fixed-entries.ldif';
  a.click();
  URL.revokeObjectURL(url);
});

// ===== DEDUP MODE =====

// Extract file upload
const extractDropZone = document.getElementById('extractDropZone');
const extractInput = document.getElementById('extractInput');
const extractFileStatus = document.getElementById('extractFileStatus');

extractDropZone.addEventListener('click', () => extractInput.click());
extractDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  extractDropZone.classList.add('drag-over');
});
extractDropZone.addEventListener('dragleave', () => {
  extractDropZone.classList.remove('drag-over');
});
extractDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  extractDropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    extractInput.files = e.dataTransfer.files;
    handleExtractFileUpload();
  }
});

extractInput.addEventListener('change', handleExtractFileUpload);

function handleExtractFileUpload() {
  const file = extractInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  window.ldifUi.watchFileReader(reader, extractFileStatus, extractDropZone);
  reader.onload = (e) => {
    cleaner.extractLdifContent = e.target.result;
    cleaner.extractedEntries = cleaner.parseLdif(cleaner.extractLdifContent);

    const count = cleaner.extractedEntries.length;
    extractFileStatus.innerHTML = `<div class="file-info success"><svg data-fluent="CheckmarkCircle-16-regular" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8ZM8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM10.8536 6.85355C11.0488 6.65829 11.0488 6.34171 10.8536 6.14645C10.6583 5.95118 10.3417 5.95118 10.1464 6.14645L7.25 9.04289L5.85355 7.64645C5.65829 7.45118 5.34171 7.45118 5.14645 7.64645C4.95118 7.84171 4.95118 8.15829 5.14645 8.35355L6.89645 10.1036C7.09171 10.2988 7.40829 10.2988 7.60355 10.1036L10.8536 6.85355Z" fill="currentColor"/></svg> Loaded ${count} entries</div>`;

    processDedup();
  };
  reader.readAsText(file);
}

// Master file upload
const masterDropZone = document.getElementById('masterDropZone');
const masterInput = document.getElementById('masterInput');
const masterFileStatus = document.getElementById('masterFileStatus');

masterDropZone.addEventListener('click', () => masterInput.click());
masterDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  masterDropZone.classList.add('drag-over');
});
masterDropZone.addEventListener('dragleave', () => {
  masterDropZone.classList.remove('drag-over');
});
masterDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  masterDropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    masterInput.files = e.dataTransfer.files;
    handleMasterFileUpload();
  }
});

masterInput.addEventListener('change', handleMasterFileUpload);

function handleMasterFileUpload() {
  const file = masterInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  window.ldifUi.watchFileReader(reader, masterFileStatus, masterDropZone);
  reader.onload = (e) => {
    cleaner.masterLdifContent = e.target.result;
    cleaner.masterEntries = cleaner.parseLdif(cleaner.masterLdifContent);

    const count = cleaner.masterEntries.length;
    masterFileStatus.innerHTML = `<div class="file-info success"><svg data-fluent="CheckmarkCircle-16-regular" aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M2 8C2 4.68629 4.68629 2 8 2C11.3137 2 14 4.68629 14 8C14 11.3137 11.3137 14 8 14C4.68629 14 2 11.3137 2 8ZM8 1C4.13401 1 1 4.13401 1 8C1 11.866 4.13401 15 8 15C11.866 15 15 11.866 15 8C15 4.13401 11.866 1 8 1ZM10.8536 6.85355C11.0488 6.65829 11.0488 6.34171 10.8536 6.14645C10.6583 5.95118 10.3417 5.95118 10.1464 6.14645L7.25 9.04289L5.85355 7.64645C5.65829 7.45118 5.34171 7.45118 5.14645 7.64645C4.95118 7.84171 4.95118 8.15829 5.14645 8.35355L6.89645 10.1036C7.09171 10.2988 7.40829 10.2988 7.60355 10.1036L10.8536 6.85355Z" fill="currentColor"/></svg> Loaded ${count} entries</div>`;

    processDedup();
  };
  reader.readAsText(file);
}

function processDedup() {
  if (!cleaner.extractLdifContent || !cleaner.masterLdifContent) return;

  const results = cleaner.findDuplicates();

  // Update stats
  document.getElementById('totalExtractEntries').textContent = cleaner.extractedEntries.length;
  document.getElementById('totalMasterEntries').textContent = results.totalEntries;
  document.getElementById('duplicateCount').textContent = results.duplicatesFound;
  document.getElementById('cleanedEntryCount').textContent = results.cleanedCount;

  // Update list info
  const duplicateListInfo = document.getElementById('duplicateListInfo');
  duplicateListInfo.textContent = `${results.duplicatesFound} matching entries from Extract Sheet`;

  // Render duplicates list
  const duplicatesList = document.getElementById('duplicatesList');
  duplicatesList.innerHTML = '';

  if (cleaner.duplicates.length === 0) {
    duplicatesList.innerHTML = '<div class="empty-state"><p>No matching entries found</p><span>No entries match the comparison file. Review the output before importing.</span></div>';
  } else {
    cleaner.duplicates.forEach((dup, idx) => {
      const dupDiv = document.createElement('div');
      dupDiv.className = 'duplicate-item';

      // Get important attributes
      const attributes = getImportantAttributes(dup.original);
      const attributesHtml = attributes.length > 0 
        ? `<div class="duplicate-attributes">
             ${attributes.map(attr => `
               <div class="duplicate-attribute">
                 <span class="duplicate-attribute-key">${attr.key}:</span>
                 <span class="duplicate-attribute-value">${escapeHtml(attr.value)}</span>
               </div>
             `).join('')}
           </div>`
        : '';

      dupDiv.innerHTML = `
        <div class="duplicate-header">
          <span class="duplicate-number">#${idx + 1}</span>
          <span class="duplicate-dn">${escapeHtml(dup.dn)}</span>
        </div>
        ${attributesHtml}
      `;
      duplicatesList.appendChild(dupDiv);
    });
  }

  dedupResultsSection.classList.remove('hidden');
}

/**
 * Get the most important attributes to display for an entry
 */
function getImportantAttributes(entry) {
  const importantKeys = ['objectclass', 'cn', 'mail', 'uid', 'ou', 'memberof'];
  const attributes = [];

  // Get objectclass first
  if (entry.objectclass) {
    const values = Array.isArray(entry.objectclass) ? entry.objectclass : [entry.objectclass];
    attributes.push({
      key: 'objectClass',
      value: values.join(', ')
    });
  }

  // Get other important attributes
  importantKeys.forEach(key => {
    if (key !== 'objectclass' && entry[key]) {
      const values = Array.isArray(entry[key]) ? entry[key] : [entry[key]];
      const displayValue = values.length > 1 ? values.join(', ') : values[0];
      attributes.push({
        key: key.charAt(0).toUpperCase() + key.slice(1),
        value: displayValue
      });
    }
  });

  return attributes.slice(0, 3); // Show max 3 attributes
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}


document.getElementById('downloadCleanedLdif').addEventListener('click', () => {
  const ldifContent = cleaner.entriesToLdif(cleaner.cleanedEntries);
  const blob = new Blob([ldifContent], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'cleaned-entries.ldif';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('downloadDuplicatesReport').addEventListener('click', () => {
  let report = 'DUPLICATE ENTRIES REPORT\n';
  report += '========================\n\n';

  report += 'CALCULATION METHOD:\n';
  report += '-------------------\n';
  report += 'Duplicates are identified by comparing the Distinguished Name (DN) of each entry\n';
  report += 'in Your Master Sheet with entries in the Extract Sheet (from LDAP Explorer).\n';
  report += 'When a DN from Master Sheet matches a DN in Extract Sheet, the entry is marked\n';
  report += 'as a duplicate and will be removed to avoid re-creating existing objects.\n\n';

  report += 'STATISTICS:\n';
  report += '-----------\n';
  report += `Extract Sheet Entries:        ${cleaner.extractedEntries.length}\n`;
  report += `Your Master Sheet Entries:    ${cleaner.masterEntries.length}\n`;
  report += `Duplicates Found:             ${cleaner.duplicates.length}\n`;
  report += `Unique Entries After Removal: ${cleaner.cleanedEntries.length}\n\n`;

  report += 'DUPLICATE ENTRIES (TO BE REMOVED):\n';
  report += '----------------------------------\n\n';

  if (cleaner.duplicates.length === 0) {
    report += 'No duplicates found!\n';
  } else {
    cleaner.duplicates.forEach((dup, idx) => {
      report += `${idx + 1}. ${dup.dn}\n`;

      // Add attributes
      const attributes = getImportantAttributes(dup.original);
      if (attributes.length > 0) {
        attributes.forEach(attr => {
          report += `   ${attr.key}: ${attr.value}\n`;
        });
      }
      report += '\n';
    });
  }

  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'duplicates-report.txt';
  a.click();
  URL.revokeObjectURL(url);
});
