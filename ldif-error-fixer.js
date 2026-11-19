/**
 * LDIF Error Fixer Module
 * Takes an LDIF file plus the LDAP server's error output for it, matches
 * each error back to its entry by DN, and produces a corrected LDIF.
 *
 * Design note: untouched entries are passed through as raw text (not
 * reparsed/reserialized) so we never risk mangling formatting we don't
 * need to touch. Only entries that matched a fixable error get rebuilt.
 */

class LdifErrorFixer {
  constructor() {
    this.sourceLdifText = '';
    this.blocks = []; // [{ dn, raw }] — one per entry, in file order
    this.errorLogText = '';
    this.parsedErrors = []; // [{ raw, code, dn, message, type, attribute }]
    this.fallbackValues = {}; // normalized attr name -> value string
    this.fixedLdifText = '';
    this.report = { fixed: [], unresolved: [] };
  }

  normalizeAttrName(name) {
    return (name || '').toString().trim().toLowerCase();
  }

  normalizeDn(dn) {
    return (dn || '').toString().trim().toLowerCase();
  }

  /**
   * Split raw LDIF text into per-entry blocks without reformatting them.
   */
  splitLdifBlocks(text) {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const lines = normalized.split('\n');
    const blocks = [];
    let current = null;

    lines.forEach((line) => {
      const isNewDn = /^dn:/i.test(line);
      if (isNewDn) {
        if (current) blocks.push(current);
        const colonIndex = line.indexOf(':');
        let dnValue = line.substring(colonIndex + 1);
        if (dnValue.startsWith(':')) dnValue = dnValue.substring(1); // base64 dn — left encoded, rarely used
        current = { dn: dnValue.trim(), lines: [line] };
      } else if (current) {
        current.lines.push(line);
      }
    });
    if (current) blocks.push(current);

    blocks.forEach((b) => {
      while (b.lines.length && b.lines[b.lines.length - 1].trim() === '') {
        b.lines.pop();
      }
      b.raw = b.lines.join('\n');
      delete b.lines;
    });

    return blocks;
  }

  loadSourceLdif(text) {
    this.sourceLdifText = text;
    this.blocks = this.splitLdifBlocks(text);
    return this.blocks;
  }

  /**
   * Parse a single entry block into a { attrName: [values] } map,
   * reusing the same line-folding / base64 handling as the other tools.
   */
  parseEntryBlock(rawBlockText) {
    const entry = {};
    let currentAttr = null;
    let currentValue = '';
    let isBase64 = false;

    const flush = () => {
      if (!currentAttr) return;
      let finalValue = currentValue;
      if (isBase64) {
        try {
          finalValue = atob(currentValue.trim());
        } catch (e) {
          finalValue = currentValue;
        }
      }
      if (!entry[currentAttr]) entry[currentAttr] = [];
      entry[currentAttr].push(finalValue.trim());
    };

    const lines = rawBlockText.split('\n');
    lines.forEach((line) => {
      if (line.startsWith(' ') && currentAttr) {
        currentValue += line.substring(1);
        return;
      }
      flush();
      currentAttr = null;
      currentValue = '';
      isBase64 = false;

      if (line.trim() === '' || line.startsWith('#')) return;

      const colonIndex = line.indexOf(':');
      if (colonIndex <= 0) return;

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
    });
    flush();

    return entry;
  }

  matchBlock(dn) {
    const norm = this.normalizeDn(dn);
    if (!norm) return null;
    return this.blocks.find((b) => this.normalizeDn(b.dn) === norm) || null;
  }

  /**
   * Parse compact "[code] dn -> message" error lines (one per line).
   */
  parseErrorLog(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const errors = [];

    lines.forEach((rawLine) => {
      const line = rawLine.trim();
      if (!line) return;

      let code = '';
      let dn = '';
      let message = '';

      const bracketMatch = line.match(/^\[(\d+)\]\s*(.+?)\s*->\s*(.+)$/);
      const plainMatch = line.match(/^(.+?)\s*->\s*(.+)$/);

      if (bracketMatch) {
        code = bracketMatch[1];
        dn = bracketMatch[2];
        message = bracketMatch[3];
      } else if (plainMatch) {
        dn = plainMatch[1];
        message = plainMatch[2];
      } else {
        errors.push({ raw: line, code: '', dn: '', message: line, type: 'unparsed', attribute: '' });
        return;
      }

      const type = this.classifyError(message);
      const attribute = this.extractAttribute(message, type);
      errors.push({ raw: line, code, dn: dn.trim(), message: message.trim(), type, attribute });
    });

    this.parsedErrors = errors;
    return errors;
  }

  classifyError(message) {
    const m = message.toLowerCase();
    if (/already exists/.test(m) && !/type or value|attribute or value/.test(m)) return 'entry_exists';
    if (/type or value exists|attribute or value exists/.test(m)) return 'value_exists';
    if (/no such attribute/.test(m)) return 'no_such_attribute';
    if (/object class violation|required attribute|missing.*attribute|attribute.*required/.test(m)) return 'missing_attribute';
    if (/no such object/.test(m)) return 'no_such_object';
    if (/invalid dn syntax|invalid syntax|naming violation/.test(m)) return 'invalid_syntax';
    return 'unknown';
  }

  /**
   * Best-effort extraction of the attribute name a message refers to,
   * e.g. "missing required attribute 'sn'" or "no such attribute (mail)".
   */
  extractAttribute(message, type) {
    if (!['missing_attribute', 'no_such_attribute', 'value_exists'].includes(type)) return '';
    const quoted = message.match(/['"]([a-zA-Z][\w;-]*)['"]/);
    if (quoted) return quoted[1];
    const paren = message.match(/\(([a-zA-Z][\w;-]*)\)/);
    if (paren) return paren[1];
    return '';
  }

  /**
   * Convert a parsed entry map into a `changetype: modify` block using
   * `replace:` operations for every attribute — same format the rest of
   * this app writes when generating modify-mode LDIF.
   */
  buildModifyBlock(dn, entryMap) {
    const lines = [`dn: ${dn}`, 'changetype: modify'];
    const attrNames = Object.keys(entryMap).filter((k) => !['dn', 'changetype'].includes(this.normalizeAttrName(k)));
    attrNames.sort((a, b) => {
      if (this.normalizeAttrName(a) === 'objectclass') return -1;
      if (this.normalizeAttrName(b) === 'objectclass') return 1;
      return 0;
    });

    attrNames.forEach((attr) => {
      const values = Array.isArray(entryMap[attr]) ? entryMap[attr] : [entryMap[attr]];
      const unique = Array.from(new Set(values.map((v) => String(v).trim()).filter(Boolean)));
      if (!unique.length) return;
      lines.push(`replace: ${attr}`);
      unique.forEach((v) => lines.push(`${attr}: ${v}`));
      lines.push('-');
    });

    return lines.join('\n');
  }

  /**
   * Append a fallback attribute value to a raw (non-modify) entry block.
   */
  appendAttributeToRawBlock(rawBlockText, attr, value) {
    return `${rawBlockText}\n${attr}: ${value}`;
  }

  isModifyBlock(rawBlockText) {
    return /^changetype:\s*modify\s*$/im.test(rawBlockText);
  }

  /**
   * Match parsed errors against the loaded LDIF, apply the fixes we can
   * safely automate, and build the corrected output. Everything else is
   * reported as needing manual review rather than guessed at.
   */
  applyFixes() {
    this.report = { fixed: [], unresolved: [] };
    // normDn -> { block, convertToModify, patches: [{attr, value}] }
    const dnFixes = new Map();

    const addFixed = (err, action) => this.report.fixed.push({ ...err, action });
    const addUnresolved = (err, reason) => this.report.unresolved.push({ ...err, reason });

    this.parsedErrors.forEach((err) => {
      if (err.type === 'unparsed') {
        addUnresolved(err, 'Could not parse this line — expected format "[code] dn -> message".');
        return;
      }
      if (!err.dn) {
        addUnresolved(err, 'Could not extract a DN from this error line.');
        return;
      }

      const block = this.matchBlock(err.dn);
      if (!block) {
        addUnresolved(err, 'DN not found in the uploaded source LDIF.');
        return;
      }

      const normDn = this.normalizeDn(block.dn);
      const fix = dnFixes.get(normDn) || { block, convertToModify: false, patches: [] };

      switch (err.type) {
        case 'entry_exists':
          fix.convertToModify = true;
          dnFixes.set(normDn, fix);
          addFixed(err, 'Converted changetype: add → changetype: modify (replace operations)');
          break;

        case 'value_exists':
          addFixed(err, 'Duplicate attribute value detected — deduplicated on output');
          break;

        case 'missing_attribute': {
          if (!err.attribute) {
            addUnresolved(err, 'Object class violation reported, but the missing attribute name could not be determined from the message text.');
            break;
          }
          if (this.isModifyBlock(block.raw)) {
            addUnresolved(err, `Entry already uses changetype: modify — add the "${err.attribute}" operation manually to avoid guessing the wrong LDAP operation.`);
            break;
          }
          const attrKey = this.normalizeAttrName(err.attribute);
          const fallback = this.fallbackValues[attrKey];
          if (!fallback) {
            addUnresolved(err, `Missing required attribute "${err.attribute}" — supply a fallback value to auto-fix.`);
            break;
          }
          fix.patches.push({ attr: err.attribute, value: fallback });
          dnFixes.set(normDn, fix);
          addFixed(err, `Added fallback value for "${err.attribute}"`);
          break;
        }

        case 'no_such_attribute':
          addUnresolved(err, `Server reports attribute "${err.attribute || '(unknown)'}" does not exist on this entry — the modify operation (replace/delete) needs manual correction.`);
          break;

        case 'no_such_object':
          addUnresolved(err, 'Parent entry does not exist in the directory — create the parent DN first, then retry.');
          break;

        case 'invalid_syntax':
          addUnresolved(err, 'Attribute or DN syntax is invalid — requires manual correction of the value.');
          break;

        default:
          addUnresolved(err, 'Unrecognized error type — flagged for manual review.');
      }
    });

    const outputBlocks = this.blocks.map((block) => {
      const normDn = this.normalizeDn(block.dn);
      const fix = dnFixes.get(normDn);
      if (!fix) return block.raw;

      if (fix.convertToModify) {
        const entryMap = this.parseEntryBlock(block.raw);
        delete entryMap.dn;
        fix.patches.forEach((p) => {
          entryMap[p.attr] = [p.value];
        });
        return this.buildModifyBlock(block.dn, entryMap);
      }

      if (fix.patches.length) {
        let raw = block.raw;
        fix.patches.forEach((p) => {
          raw = this.appendAttributeToRawBlock(raw, p.attr, p.value);
        });
        return raw;
      }

      return block.raw;
    });

    this.fixedLdifText = outputBlocks.join('\n\n');
    return this.report;
  }

  /**
   * Missing-attribute errors (with no fallback yet) grouped by attribute
   * name, for rendering the "supply a value" UI.
   */
  getPendingFallbackAttributes() {
    const attrs = new Map(); // attrKey -> { attribute, count }
    this.parsedErrors.forEach((err) => {
      if (err.type !== 'missing_attribute' || !err.attribute) return;
      const block = this.matchBlock(err.dn);
      if (!block || this.isModifyBlock(block.raw)) return;
      const key = this.normalizeAttrName(err.attribute);
      const entry = attrs.get(key) || { attribute: err.attribute, count: 0 };
      entry.count += 1;
      attrs.set(key, entry);
    });
    return Array.from(attrs.values());
  }
}

// ===== UI wiring =====
const fixer = new LdifErrorFixer();

const efLdifDropZone = document.getElementById('efLdifDropZone');
const efLdifInput = document.getElementById('efLdifInput');
const efLdifFileStatus = document.getElementById('efLdifFileStatus');
const efErrorLogInput = document.getElementById('efErrorLogInput');
const efAnalyzeBtn = document.getElementById('efAnalyzeBtn');
const efFallbackSection = document.getElementById('efFallbackSection');
const efFallbackList = document.getElementById('efFallbackList');
const efResults = document.getElementById('efResults');
const efStatTotal = document.getElementById('efStatTotal');
const efStatFixed = document.getElementById('efStatFixed');
const efStatUnresolved = document.getElementById('efStatUnresolved');
const efResultsInfo = document.getElementById('efResultsInfo');
const efIssuesList = document.getElementById('efIssuesList');
const efOutput = document.getElementById('efOutput');
const efFixedLdifOutput = document.getElementById('efFixedLdifOutput');

function escapeHtml(text) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return (text || '').toString().replace(/[&<>"']/g, (m) => map[m]);
}

efLdifDropZone.addEventListener('click', () => efLdifInput.click());
efLdifDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  efLdifDropZone.classList.add('drag-over');
});
efLdifDropZone.addEventListener('dragleave', () => {
  efLdifDropZone.classList.remove('drag-over');
});
efLdifDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  efLdifDropZone.classList.remove('drag-over');
  if (e.dataTransfer.files.length > 0) {
    efLdifInput.files = e.dataTransfer.files;
    handleLdifUpload();
  }
});
efLdifInput.addEventListener('change', handleLdifUpload);

function handleLdifUpload() {
  const file = efLdifInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    const blocks = fixer.loadSourceLdif(e.target.result);
    efLdifFileStatus.innerHTML = `<div class="file-info success">✓ Loaded ${blocks.length} entries</div>`;
  };
  reader.readAsText(file);
}

efAnalyzeBtn.addEventListener('click', () => {
  if (!fixer.blocks.length) {
    efLdifFileStatus.innerHTML = `<div class="file-info">Upload the source LDIF first.</div>`;
    return;
  }
  fixer.parseErrorLog(efErrorLogInput.value);
  runFixAndRender();
});

function renderFallbackInputs() {
  const pending = fixer.getPendingFallbackAttributes();
  if (!pending.length) {
    efFallbackSection.classList.add('hidden');
    return;
  }

  efFallbackSection.classList.remove('hidden');
  efFallbackList.innerHTML = '';

  pending.forEach((p) => {
    const key = fixer.normalizeAttrName(p.attribute);
    const card = document.createElement('div');
    card.className = 'operation-card';
    card.innerHTML = `
      <div class="operation-body">
        <div class="form-group">
          <label>${escapeHtml(p.attribute)} <span style="font-weight:400;color:var(--text-muted)">(missing on ${p.count} ${p.count === 1 ? 'entry' : 'entries'})</span></label>
          <input type="text" class="ef-fallback-input" data-attr-key="${escapeHtml(key)}" data-attr-name="${escapeHtml(p.attribute)}"
            value="${escapeHtml(fixer.fallbackValues[key] || '')}" placeholder="Value to apply to every affected entry" />
        </div>
      </div>
    `;
    efFallbackList.appendChild(card);
  });

  efFallbackList.querySelectorAll('.ef-fallback-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const key = e.target.getAttribute('data-attr-key');
      const value = e.target.value.trim();
      if (value) {
        fixer.fallbackValues[key] = value;
      } else {
        delete fixer.fallbackValues[key];
      }
      runFixAndRender();
    });
  });
}

function issueStatusInfo(status) {
  if (status === 'fixed') return { cls: 'fixed', label: 'Auto-fixed' };
  return { cls: 'unresolved', label: 'Needs review' };
}

function renderIssuesList() {
  efIssuesList.innerHTML = '';
  const all = [
    ...fixer.report.fixed.map((e) => ({ ...e, status: 'fixed' })),
    ...fixer.report.unresolved.map((e) => ({ ...e, status: 'unresolved' })),
  ];

  if (!all.length) {
    efIssuesList.innerHTML = '<div class="empty-state">No errors parsed yet.</div>';
    return;
  }

  all.forEach((issue, idx) => {
    const info = issueStatusInfo(issue.status);
    const div = document.createElement('div');
    div.className = `duplicate-item ${info.cls}`;
    const detail = issue.status === 'fixed' ? issue.action : issue.reason;
    div.innerHTML = `
      <div class="duplicate-header">
        <span class="duplicate-number">#${idx + 1}</span>
        <span class="ef-status-badge ${info.cls}">${info.label}</span>
        <span class="duplicate-dn">${escapeHtml(issue.dn || '(no dn parsed)')}</span>
      </div>
      <div class="duplicate-attributes">
        <div class="duplicate-attribute">
          <span class="duplicate-attribute-key">Server said:</span>
          <span class="duplicate-attribute-value">${escapeHtml(issue.message || issue.raw)}</span>
        </div>
        <div class="duplicate-attribute">
          <span class="duplicate-attribute-key">${issue.status === 'fixed' ? 'Fix applied:' : 'Why:'}</span>
          <span class="duplicate-attribute-value">${escapeHtml(detail)}</span>
        </div>
      </div>
    `;
    efIssuesList.appendChild(div);
  });
}

function runFixAndRender() {
  renderFallbackInputs();
  fixer.applyFixes();

  const totalErrors = fixer.parsedErrors.length;
  const fixedCount = fixer.report.fixed.length;
  const unresolvedCount = fixer.report.unresolved.length;

  efStatTotal.textContent = totalErrors;
  efStatFixed.textContent = fixedCount;
  efStatUnresolved.textContent = unresolvedCount;
  efResultsInfo.textContent = `${fixedCount} auto-fixed · ${unresolvedCount} need manual review`;

  renderIssuesList();
  efResults.classList.remove('hidden');

  efFixedLdifOutput.value = fixer.fixedLdifText;
  efOutput.classList.remove('hidden');
}

document.getElementById('efDownloadFixedLdif').addEventListener('click', () => {
  const content = efFixedLdifOutput.value;
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'fixed-entries.ldif';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('efDownloadReport').addEventListener('click', () => {
  let report = 'LDIF ERROR FIX REPORT\n';
  report += '======================\n\n';
  report += `Errors Parsed:        ${fixer.parsedErrors.length}\n`;
  report += `Auto-Fixed:            ${fixer.report.fixed.length}\n`;
  report += `Needs Manual Review:   ${fixer.report.unresolved.length}\n\n`;

  report += 'AUTO-FIXED\n----------\n';
  if (!fixer.report.fixed.length) report += '(none)\n';
  fixer.report.fixed.forEach((e, i) => {
    report += `${i + 1}. ${e.dn}\n   Server said: ${e.message}\n   Fix applied: ${e.action}\n\n`;
  });

  report += 'NEEDS MANUAL REVIEW\n--------------------\n';
  if (!fixer.report.unresolved.length) report += '(none)\n';
  fixer.report.unresolved.forEach((e, i) => {
    report += `${i + 1}. ${e.dn || '(no dn parsed)'}\n   Server said: ${e.message || e.raw}\n   Why: ${e.reason}\n\n`;
  });

  const blob = new Blob([report], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'ldif-fix-report.txt';
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById('efResetBtn').addEventListener('click', () => {
  location.reload();
});
