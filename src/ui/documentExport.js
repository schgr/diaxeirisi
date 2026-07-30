const PRINT_LABEL = /^ΕΚΤΥΠΩΣ/u;
const PREVIEW_LABEL = /ΠΡΟΕΠΙΣΚΟΠ|ΠΡΟΒΟΛ/u;

export function initializeDocumentExports(showToast) {
  const start = () => {
    enhancePrintButtons(document);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes') {
          syncExportButtons(mutation.target);
          return;
        }
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) enhancePrintButtons(node);
        });
      });
    });
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'disabled']
    });
  };
  if (document.body) start();
  else window.addEventListener('DOMContentLoaded', start, { once: true });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-document-export-format]');
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();
    const printButton = button._printButton;
    if (!printButton) return;
    button.disabled = true;
    const taskId = `document-export-${Date.now()}`;
    const stopProgress = window.appApi.heavyTasks.onProgress((progress) => {
      if (progress.id === taskId && progress.message) button.title = progress.message;
    });
    try {
      const payload = buildDocumentExportPayload(printButton);
      const result = await window.appApi.export.document(button.dataset.documentExportFormat, payload, taskId);
      if (result && !result.canceled) showToast(result.message);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η εξαγωγή του αρχείου.', 'error');
    } finally {
      stopProgress();
      button.title = '';
      button.disabled = Boolean(printButton.disabled);
    }
  }, true);
}

export function buildDocumentExportPayload(printButton) {
  const source = resolveExportSource(printButton);
  if (!source) throw new Error('Δεν βρέθηκε περιεχόμενο για εξαγωγή.');
  const title = resolveExportTitle(printButton, source);
  const clone = prepareExportClone(source);
  return {
    title,
    orientation: resolveExportOrientation(printButton, source),
    singleWorksheet: printButton.matches('[data-print-k2310]'),
    html: clone.innerHTML,
    tables: extractTables(clone, title),
    textLines: extractTextLines(clone)
  };
}

export function isExportablePrintLabel(value) {
  const label = normalizedText(value);
  return PRINT_LABEL.test(label) && !PREVIEW_LABEL.test(label);
}

function enhancePrintButtons(root) {
  const candidates = [];
  if (root.matches?.('button')) candidates.push(root);
  root.querySelectorAll?.('button').forEach((button) => candidates.push(button));
  candidates.forEach((button) => {
    if (button.dataset.documentExportEnhanced === 'true') return;
    if (button.hasAttribute('data-no-document-export')) return;
    if (button.closest('.addy-document-backdrop, .exhp-document-backdrop')) return;
    if (button.matches('[data-toggle-index-materials]')) return;
    if (!isExportablePrintLabel(button.textContent)) return;
    if (button.closest('[data-document-export-actions]')) return;
    button.dataset.documentExportEnhanced = 'true';
    const excel = createExportButton('excel', 'Excel', button);
    const word = createExportButton('word', 'Word', button);
    button.after(excel, word);
    syncExportButtons(button);
  });
}

function createExportButton(format, label, printButton) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'secondary-button document-export-button no-print';
  button.dataset.documentExportFormat = format;
  button.textContent = label;
  button.title = `Εξαγωγή σε ${label}`;
  button._printButton = printButton;
  return button;
}

function syncExportButtons(printButton) {
  if (!printButton?.matches?.('button[data-document-export-enhanced="true"]')) return;
  let sibling = printButton.nextElementSibling;
  while (sibling?.matches?.('[data-document-export-format]')) {
    sibling.hidden = printButton.hidden;
    sibling.disabled = printButton.disabled;
    sibling = sibling.nextElementSibling;
  }
}

function resolveExportTitle(printButton, source) {
  if (printButton.dataset.exportTitle) return cleanTitle(printButton.dataset.exportTitle);
  const documentHeading = [...(source?.querySelectorAll?.('h1, h2, h3') || [])]
    .find((item) => isVisible(item) && !isGenericPrintTitle(item.textContent));
  if (documentHeading?.textContent.trim()) return cleanTitle(documentHeading.textContent);
  const label = String(printButton.textContent || '').trim();
  const suffix = label.replace(/^\s*ΕΚΤΥΠΩΣΗ(?:\s+ΤΩΝ|\s+ΤΗΣ)?\s*/iu, '').trim();
  if (suffix && !/^(ΟΛΩΝ|ΕΜΦΑΝΙΖΟΜΕΝΩΝ|ΚΑΤΑΣΤΑΣΗΣ)$/iu.test(suffix)) {
    return cleanTitle(suffix);
  }
  const scope = printButton.closest('.modal-backdrop, .request-document-modal, [data-financial-detail], .page-panel');
  const heading = [...(scope?.querySelectorAll('h1, h2, h3') || [])]
    .find((item) => isVisible(item) && !isGenericPrintTitle(item.textContent));
  if (heading?.textContent.trim()) return cleanTitle(heading.textContent);
  const pageTitle = document.querySelector('#prints-title, .page-header h2');
  return cleanTitle(pageTitle?.textContent || 'Κατάσταση');
}

function isGenericPrintTitle(value) {
  return /^(?:ΕΚΤΥΠΩΣΗ|ΕΛΕΓΧΟΣ ΕΚΤΥΠΩΣΗΣ|ΠΡΟΒΟΛΗ)$/iu.test(cleanTitle(value));
}

function resolveExportSource(printButton) {
  if (printButton.matches('#print-current-document')) {
    return document.querySelector('#print-preview');
  }
  if (printButton.matches('#inventory-statement-print')) {
    return document.querySelector('#inventory-statement-preview');
  }
  if (printButton.matches('[data-financial-print]')) {
    return document.querySelector('[data-financial-results]');
  }
  if (printButton.matches('[data-print-ammunition-batches]')) {
    return document.querySelector('[data-ammunition-batch-table]');
  }
  if (printButton.matches('[data-print-archive-table]')) {
    return printButton.closest('[data-financial-detail], main, body')
      ?.querySelector('[data-archived-shares-table]');
  }
  if (printButton.matches('[data-print-k2310]')) {
    return printButton.closest('.modal-backdrop')?.querySelector('[data-k2310-pages]');
  }
  if (printButton.matches('[data-print-addy-document]')) {
    const target = printButton.dataset.printAddyDocument;
    const modal = printButton.closest('.modal-backdrop');
    return target === 'composition'
      ? modal?.querySelector('.addy-composition-document')
      : modal?.querySelector('.addy-document-page');
  }

  const modal = printButton.closest('.modal-backdrop, .request-document-modal');
  if (modal) {
    const selectors = [
      '[data-support-template-preview]',
      '[data-official-document-preview]',
      '[data-useless-preview]',
      '.annual-share-print-preview',
      '.index-document-preview-content',
      '.serial-registry-preview',
      '.request-document-preview',
      '.handover-document-preview',
      '.print-preview-shell'
    ];
    for (const selector of selectors) {
      const candidate = [...modal.querySelectorAll(selector)].find(isVisible);
      if (candidate) return candidate;
    }
    const printable = [...modal.querySelectorAll('.print-document-area')].filter(isVisible);
    if (printable.length) return wrapElements(printable);
  }

  const panel = printButton.closest('.page-panel, [data-financial-detail]');
  if (panel) {
    const table = panel.querySelector('table');
    if (table) return table;
  }
  return document.querySelector('.print-preview-shell:not([hidden]), .print-document-area:not([hidden])');
}

export function resolveExportOrientation(printButton, source) {
  const explicitOrientation = normalizeOrientation(
    printButton?.dataset?.exportOrientation || source?.dataset?.exportOrientation
  );
  if (explicitOrientation) return explicitOrientation;

  const landscapeButtons = [
    '[data-financial-print]',
    '[data-print-ammunition-batches]',
    '[data-print-archive-table]',
    '[data-print-k2310]',
    '[data-print-serial-preview]',
    '[data-print-current-request]'
  ].join(',');
  if (printButton?.matches?.(landscapeButtons)) return 'landscape';

  const landscapePages = [
    '.faithful-form-page-landscape',
    '.exhp-faithful-page',
    '.request-document-page',
    '.addy-document-page',
    '.exhp-document-page',
    '.index-page',
    '.official-index-page',
    '.change-sheet-document-page',
    '.balance-differences-page',
    '.financial-year-print-sheet',
    '.serial-registry-preview',
    '.archived-shares-print',
    '.ammunition-batch-print'
  ].join(',');
  const portraitPages = [
    '.official-a4-form',
    '.share-document-page',
    '.official-share-page',
    '.official-inventory-page',
    '.official-movement-protocol-page',
    '.official-handover-page',
    '.efed505-page',
    '.official-overlay-page',
    '.material-registry-page',
    '.composition-document-page',
    '.addy-composition-document'
  ].join(',');

  if (source?.matches?.(landscapePages) || source?.querySelector?.(landscapePages)) return 'landscape';
  if (source?.matches?.(portraitPages) || source?.querySelector?.(portraitPages)) return 'portrait';

  const printablePages = [
    source,
    ...(source?.querySelectorAll?.('.print-document-area, article, section') || [])
  ].filter(Boolean);
  for (const page of printablePages) {
    const inlineOrientation = normalizeOrientation(
      page.dataset?.exportOrientation ||
      page.dataset?.printOrientation ||
      page.style?.getPropertyValue?.('page') ||
      page.getAttribute?.('style')
    );
    if (inlineOrientation) return inlineOrientation;
    if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
      const computedOrientation = normalizeOrientation(
        window.getComputedStyle(page).getPropertyValue('page')
      );
      if (computedOrientation) return computedOrientation;
    }
  }

  return 'portrait';
}

function normalizeOrientation(value) {
  const normalized = String(value || '').toLocaleLowerCase('en-US');
  if (normalized.includes('landscape')) return 'landscape';
  if (normalized.includes('portrait')) return 'portrait';
  return '';
}

function prepareExportClone(source) {
  const clone = document.createElement('div');
  clone.appendChild(source.cloneNode(true));
  clone.querySelectorAll('input, textarea, select').forEach((field) => {
    const value = field.tagName === 'SELECT'
      ? field.options[field.selectedIndex]?.textContent || ''
      : field.value || field.getAttribute('value') || '';
    const span = document.createElement('span');
    span.textContent = value;
    field.replaceWith(span);
  });
  clone.querySelectorAll('button, script, style, .no-print, [hidden]').forEach((item) => item.remove());
  clone.querySelectorAll('[contenteditable]').forEach((item) => item.removeAttribute('contenteditable'));
  return clone;
}

function extractTables(root, title) {
  return [...root.querySelectorAll('table')].map((table, index) => {
    const heading = table.closest('article, section, div')?.querySelector('h1, h2, h3');
    return {
      name: cleanTitle(heading?.textContent || `${title} ${index + 1}`),
      rows: [...table.rows].map((row) =>
        [...row.cells].map((cell) => normalizedCellText(cell.textContent))
      )
    };
  }).filter((table) => table.rows.length);
}

function extractTextLines(root) {
  const selectors = [
    'h1', 'h2', 'h3', 'h4', 'p', 'li',
    '[data-support-preview-field]',
    '.official-index-overlay',
    '.official-inventory-overlay',
    '.official-text-value',
    '.official-inline-value'
  ];
  const lines = [];
  root.querySelectorAll(selectors.join(',')).forEach((item) => {
    const text = normalizedCellText(item.textContent);
    if (text && !lines.includes(text)) lines.push(text);
  });
  if (!lines.length) {
    const text = normalizedCellText(root.textContent);
    if (text) lines.push(text);
  }
  return lines;
}

function wrapElements(elements) {
  const wrapper = document.createElement('div');
  elements.forEach((element) => wrapper.appendChild(element.cloneNode(true)));
  return wrapper;
}

function isVisible(element) {
  return Boolean(element) && !element.hidden && element.getAttribute('aria-hidden') !== 'true';
}

function cleanTitle(value) {
  return String(value || 'Κατάσταση').replace(/\s+/g, ' ').trim() || 'Κατάσταση';
}

function normalizedText(value) {
  return cleanTitle(value).toLocaleUpperCase('el-GR');
}

function normalizedCellText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
