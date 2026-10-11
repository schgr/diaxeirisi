import { escapeHtml, renderFiscalYearOptions } from '../components/forms.js';
import { formatOfficerName, formatOfficerRank, splitOfficerSignature } from '../officerSignature.js';
import { printIsolatedPreview } from './printPreview.js';
import { formatAddyDate, formatDate } from './shared.js';

const ROWS_PER_INDEX_PAGE = 34;

function renderFiscalYearControls(state) {
  return `
    <div class="registry-controls" style="width: fit-content; grid-template-columns: 170px 170px;">
      <label class="field">
        <span>Οικονομικό Έτος</span>
        <select id="prints-fiscal-year">${renderFiscalYearOptions(state.fiscalYear)}</select>
      </label>
      <button id="print-current-document" class="primary-button compact-print-button" type="button">Προβολή</button>
    </div>
  `;
}

function renderIndexTableControls(state, type) {
  return `
    <div class="registry-controls index-table-controls">
      <label class="field">
        <span>Οικονομικό Έτος</span>
        <select id="prints-fiscal-year">${renderFiscalYearOptions(state.fiscalYear)}</select>
      </label>
      <div class="row-actions index-table-actions">
        <button id="preview-index-document" class="secondary-button" type="button" data-index-type="${type}">Προβολή</button>
      </div>
    </div>
  `;
}

function renderExternalIndexTable(rows) {
  return renderEditableIndexTable({
    className: 'external-index-data-table',
    headers: [
      'Α/Α',
      'Ημερομηνία',
      'Μονάδα',
      'Είδος Δικ/κού',
      'Α/Ο Υλικού',
      'Αριθμός / Ημερομηνία Δικαιολογητικού',
      'Ημερομηνία Παραλαβής ή (ΔΙΑΖ) Αποστολής Υλικού',
      'Ημερομηνία Επιστροφής ή (ΔΙΑΖ) Παραλαβής Οριστικού «Π»-«Χ» Δικαιολογητικού Δοσοληψίας',
      'Παρατηρήσεις'
    ],
    rows,
    cells: (row) => [
      escapeHtml(row.serial),
      escapeHtml(formatAddyDate(row.date)),
      escapeHtml(row.unit),
      escapeHtml(row.documentType),
      escapeHtml(row.nominalNumber),
      indexTableInput(row, 7, row.indexField7),
      indexTableInput(row, 8, row.indexField8),
      indexTableInput(row, 9, row.indexField9),
      `<span style="display:block;text-align:left">${escapeHtml(row.notes)}</span>`
    ]
  });
}

function renderOrdersIndexTable(rows) {
  return renderEditableIndexTable({
    className: 'orders-index-data-table',
    headers: [
      'Α/Α',
      'Ημερομηνία',
      'Αιτιολογία Εκδόσεως',
      'Ημερομηνία Αποστολής προς Έγκριση',
      'Αριθμός / Ημερομηνία Εγκρίσεως',
      'Παρατηρήσεις'
    ],
    rows,
    cells: (row) => [
      escapeHtml(row.serial),
      escapeHtml(formatDate(row.date)),
      `<span style="display:block;text-align:left">${escapeHtml(row.reason)}</span>`,
      escapeHtml(formatDate(row.date)),
      indexTableInput(row, 6, row.indexField6),
      indexTableInput(row, 7, row.indexField7, true)
    ]
  });
}

function renderEditableIndexTable({ className, headers, rows, cells }) {
  return `
    <section class="page-panel index-table-panel">
      <div class="table-wrap index-table-editor-wrap">
        <table class="index-table index-table-editor ${className}">
          <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.length
              ? rows.map((row) => `<tr data-index-row="${row.id}">${cells(row).map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
              : `<tr><td colspan="${headers.length}" class="empty-table">Δεν υπάρχουν εγγραφές για το επιλεγμένο οικονομικό έτος.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function indexTableInput(row, field, value, leftAligned = false) {
  return `<input class="index-cell-input"${leftAligned ? ' style="text-align:left"' : ''} data-index-id="${row.id}" data-index-field="${field}" value="${escapeHtml(value || '')}" />`;
}

function bindExternalIndexControls(
  container,
  transactionsApi,
  state,
  rows,
  settings,
  preview,
  renderActiveTab,
  showToast
) {
  bindFiscalYearControls(container, state, renderActiveTab);
  const previewButton = container.querySelector('#preview-index-document');
  if (!previewButton) return;
  const saveRows = async (rowsToSave = rows) => {
    const values = collectIndexTableValues(preview, [7, 8, 9]);
    const uniqueRows = [...new Map(rowsToSave.map((row) => [Number(row.id), row])).values()];
    await Promise.all(uniqueRows.map((row) => transactionsApi.updateAddyIndexFields(row.id, {
      field7: values.get(row.id)?.[7] || '',
      field8: values.get(row.id)?.[8] || '',
      field9: values.get(row.id)?.[9] || ''
    })));
  };
  preview.oninput = (event) => {
    const input = event.target.closest('.index-cell-input');
    if (!input) return;
    preview.querySelectorAll('.index-cell-input').forEach((candidate) => {
      if (candidate === input) return;
      if (candidate.dataset.indexId !== input.dataset.indexId) return;
      if (candidate.dataset.indexField !== input.dataset.indexField) return;
      candidate.value = input.value;
    });
  };
  preview.onchange = async (event) => {
    const input = event.target.closest('.index-cell-input');
    if (!input) return;
    try {
      await saveRows(rows.filter((row) => Number(row.id) === Number(input.dataset.indexId)));
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ευρετηρίου.', 'error');
    }
  };
  previewButton.addEventListener('click', async () => {
    try {
      await saveRows();
      const allRows = collectIndexRows(preview, rows, [7, 8, 9]);
      openIndexDocumentPreview(
        'Ευρετήριο Εξωτερικών Δοσοληψιών',
        renderExternalTransactionsIndex(settings, allRows),
        settings.financialOfficers,
        {
          singleMaterialHtml: renderExternalTransactionsIndex(
            settings,
            selectFirstMaterialPerAddy(allRows)
          )
        }
      );
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ευρετηρίου.', 'error');
    }
  });
}

function bindOrdersIndexControls(
  container,
  transactionsApi,
  state,
  rows,
  settings,
  preview,
  renderActiveTab,
  showToast
) {
  bindFiscalYearControls(container, state, renderActiveTab);
  const previewButton = container.querySelector('#preview-index-document');
  if (!previewButton) return;
  const saveRows = async (rowsToSave = rows) => {
    const values = collectIndexTableValues(preview, [6, 7]);
    const uniqueRows = [...new Map(rowsToSave.map((row) => [Number(row.id), row])).values()];
    await Promise.all(uniqueRows.map((row) => transactionsApi.updateExhpIndexFields(row.id, {
      field6: values.get(row.id)?.[6] || '',
      field7: values.get(row.id)?.[7] || ''
    })));
  };
  preview.onchange = async (event) => {
    const input = event.target.closest('.index-cell-input');
    if (!input) return;
    try {
      await saveRows(rows.filter((row) => Number(row.id) === Number(input.dataset.indexId)));
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ευρετηρίου.', 'error');
    }
  };
  previewButton.addEventListener('click', async () => {
    try {
      await saveRows();
      openIndexDocumentPreview(
        'Ευρετήριο Εντολών Χρεωπιστώσεως',
        renderChargeCreditOrdersIndex(settings, collectIndexRows(preview, rows, [6, 7])),
        settings.financialOfficers
      );
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ευρετηρίου.', 'error');
    }
  });
}

function collectIndexTableValues(preview, fields) {
  const values = new Map();
  preview.querySelectorAll('.index-cell-input').forEach((input) => {
    const id = Number(input.dataset.indexId);
    const field = Number(input.dataset.indexField);
    if (!fields.includes(field)) return;
    if (!values.has(id)) values.set(id, {});
    values.get(id)[field] = input.value.trim();
  });
  return values;
}

function collectIndexRows(preview, rows, fields) {
  const values = collectIndexTableValues(preview, fields);
  return rows.map((row) => {
    const result = { ...row };
    fields.forEach((field) => { result[`indexField${field}`] = values.get(Number(row.id))?.[field] || ''; });
    return result;
  });
}

function selectFirstMaterialPerAddy(rows = []) {
  const documentIds = new Set();
  return rows
    .filter((row) => {
      const id = Number(row.id);
      if (documentIds.has(id)) return false;
      documentIds.add(id);
      return true;
    })
    .map((row, index) => ({ ...row, serial: index + 1 }));
}

function openIndexDocumentPreview(title, documentHtml, financialOfficers = {}, options = {}) {
  document.querySelector('.index-document-preview-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop index-document-preview-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal index-document-preview-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">ΕΛΕΓΧΟΣ ΕΚΤΥΠΩΣΗΣ</p><h2>${escapeHtml(title)}</h2></div>
        <div class="row-actions">
          ${options.singleMaterialHtml ? '<button class="secondary-button" data-toggle-index-materials type="button">Εκτύπωση με ένα υλικό ανά ΑΔΔΥ</button>' : ''}
          <button class="secondary-button" data-toggle-index-signatures type="button">Υπογραφές Έτους</button>
          <button class="secondary-button" data-close-index-preview type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-index-preview data-no-document-export type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="print-preview-shell index-document-preview-content">${documentHtml}</div>
    </div>
  `;
  const content = backdrop.querySelector('.index-document-preview-content');
  const signaturesButton = backdrop.querySelector('[data-toggle-index-signatures]');
  const materialsButton = backdrop.querySelector('[data-toggle-index-materials]');
  let signaturesVisible = false;
  let singleMaterialVisible = false;

  const renderPreviewContent = () => {
    content.innerHTML = singleMaterialVisible ? options.singleMaterialHtml : documentHtml;
    fitExternalIndexCells(content);
    if (signaturesVisible) {
      content.querySelector('.official-index-page:last-child, .external-excel-index-page:last-child')?.insertAdjacentHTML(
        'beforeend',
        renderIndexAnnualSignatures(financialOfficers)
      );
    }
  };

  materialsButton?.addEventListener('click', () => {
    singleMaterialVisible = !singleMaterialVisible;
    materialsButton.textContent = singleMaterialVisible
      ? 'Εκτύπωση με όλα τα υλικά'
      : 'Εκτύπωση με ένα υλικό ανά ΑΔΔΥ';
    materialsButton.classList.toggle('active', singleMaterialVisible);
    renderPreviewContent();
  });
  signaturesButton.addEventListener('click', () => {
    signaturesVisible = !signaturesVisible;
    signaturesButton.textContent = signaturesVisible ? 'Απόκρυψη Υπογραφών' : 'Υπογραφές Έτους';
    signaturesButton.classList.toggle('active', signaturesVisible);
    renderPreviewContent();
  });
  backdrop.querySelector('[data-close-index-preview]').addEventListener('click', () => {
    backdrop.remove();
  });
  backdrop.querySelector('[data-print-index-preview]').addEventListener('click', () => {
    void printIsolatedPreview(content, true);
  });
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
  fitExternalIndexCells(content);
}

function fitExternalIndexCells(root) {
  const cells = root.querySelectorAll('.external-excel-index-page tbody td .external-index-cell-text');
  if (!cells.length) return;
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return;
  for (const text of cells) {
    const cell = text.parentElement;
    const available = cell.clientWidth - 6;
    if (available <= 0) continue;
    context.font = `11px Arial`;
    const measured = context.measureText(text.textContent).width;
    text.style.fontSize = `${Math.min(11, 11 * available / Math.max(measured, 1))}px`;
  }
}

function renderIndexAnnualSignatures(financialOfficers = {}) {
  const commander = splitOfficerSignature(financialOfficers.commander);
  const ped = splitOfficerSignature(financialOfficers.ped);
  const manager = splitOfficerSignature(financialOfficers.manager);
  return `
    <div class="official-index-annual-signatures">
      <div class="official-index-signature-column">
        <strong>ΘΕΩΡΗΘΗΚΕ</strong>
        <span>Ο</span>
        <span>ΔΚΤΗΣ</span>
        ${renderIndexSignatureIdentity(commander)}
      </div>
      <div class="official-index-signature-column">
        <span>Ο</span>
        <span>Π.Ε.Δ</span>
        ${renderIndexSignatureIdentity(ped)}
      </div>
      <div class="official-index-signature-column">
        <span>Ο</span>
        <span>ΔΧΣΤΗΣ</span>
        ${renderIndexSignatureIdentity(manager)}
      </div>
    </div>
  `;
}

function renderIndexSignatureIdentity(officer) {
  return `
    <b class="official-index-signature-name">${escapeHtml(officer.name)}</b>
    <em class="official-index-signature-rank">${escapeHtml(officer.rank)}</em>
  `;
}

function bindFiscalYearControls(container, state, renderActiveTab) {
  const input = container.querySelector('#prints-fiscal-year');
  if (!input) return;
  input.addEventListener('change', () => {
    state.fiscalYear = Number(input.value) || new Date().getFullYear();
    renderActiveTab();
  });
}
function renderExternalTransactionsIndex(settings, entries) {
  const headers = ['Α/Α', 'ΗΜΕΡΟΜΗΝΙΑ', 'ΜΟΝΑΔΑ', 'ΕΙΔΟΣ ΔΙΚ/ΚΟΥ', 'Α/Ο ΥΛΙΚΟΥ',
    'ΑΡΙΘΜΟΣ / ΗΜΕΡΟΜΗΝΙΑ ΔΙΚΑΙΟΛΟΓΗΤΙΚΟΥ',
    'ΗΜΕΡΟΜΗΝΙΑ ΠΑΡΑΛΑΒΗΣ Ή (ΔΙΑΖ) ΑΠΟΣΤΟΛΗΣ ΥΛΙΚΟΥ',
    'ΗΜΕΡΟΜΗΝΙΑ ΕΠΙΣΤΡΟΦΗΣ Ή (ΔΙΑΖ) ΠΑΡΑΛΑΒΗΣ ΟΡΙΣΤΙΚΟΥ «Π»-«Χ» ΔΙΚΑΙΟΛΟΓΗΤΙΚΟΥ ΔΟΣΟΛΗΨΙΑΣ',
    'ΠΑΡΑΤΗΡΗΣΕΙΣ'];
  const rowsPerPage = 24;
  const lastPageRows = 22;
  const pageCount = 1 + Math.ceil(Math.max(0, entries.length - lastPageRows) / rowsPerPage);
  let entryOffset = 0;
  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const isLastPage = pageIndex === pageCount - 1;
    const rowCount = isLastPage ? lastPageRows : rowsPerPage;
    // Keep an entry for the final page when a full preceding page would empty it.
    const entryCount = isLastPage
      ? entries.length - entryOffset
      : Math.min(rowCount, entries.length - entryOffset - 1);
    const rows = Array.from({ length: rowCount }, (_unusedRow, index) =>
      index < entryCount ? entries[entryOffset + index] : null);
    entryOffset += entryCount;
    return `<article class="external-excel-index-page print-document-area">
    <div class="external-excel-index-unit">ΜΟΝΑΔΑ : ${escapeHtml(settings.serviceInfo.serviceName || '')}</div>
    <div class="external-excel-index-code">Κ2312/ΔΥΠ</div>
    <h1>ΕΥΡΕΤΗΡΙΟ<br />ΔΙΚΑΙΟΛΟΓΗΤΙΚΩΝ ΕΞΩΤΕΡΙΚΩΝ ΔΟΣΟΛΗΨΙΩΝ</h1>
    <table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr><tr>${headers.map((_header, i) => `<th>${i + 2}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((entry) => `<tr>${entry ? [entry.serial, formatAddyDate(entry.date), entry.unit, entry.documentType, entry.nominalNumber, entry.indexField7, entry.indexField8, entry.indexField9, entry.notes].map((value) => `<td><span class="external-index-cell-text">${escapeHtml(value || '')}</span></td>`).join('') : headers.map(() => '<td></td>').join('')}</tr>`).join('')}</tbody>
    </table>
    <div class="external-excel-index-page-number">Σελίδα ${pageIndex + 1} από Σελίδα ${pageCount}</div>
  </article>`;
  }).join('');
}

function renderChargeCreditOrdersIndex(settings, entries) {
  return renderOfficialIndexPages({
    pageClassName: 'orders-official-index-page',
    unit: settings.serviceInfo.serviceName,
    image: 'te34-254-page-228.png',
    rowsPerPage: 27,
    rowTop: 29.95,
    rowStep: 2.13,
    columns: [
      { left: 6.1, width: 3.8 },
      { left: 9.95, width: 11.85 },
      { left: 21.85, width: 28.6, className: 'official-index-left-cell' },
      { left: 50.5, width: 13.4 },
      { left: 64.0, width: 21.85 },
      { left: 85.9, width: 8.4 }
    ],
    rows: entries.map((entry) => [
      entry.serial,
      formatDate(entry.date),
      entry.reason,
      formatDate(entry.date),
      entry.indexField6 || '',
      entry.indexField7 || ''
    ])
  });
}

function renderOfficialIndexPages(config) {
  const pageCount = Math.max(1, Math.ceil((config.rows || []).length / config.rowsPerPage));
  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const rows = (config.rows || []).slice(
      pageIndex * config.rowsPerPage,
      (pageIndex + 1) * config.rowsPerPage
    );
    return renderOfficialIndexPage({ ...config, rows, pageNumber: pageIndex + 1, pageCount });
  }).join('');
}

function renderOfficialIndexPage({ unit, image, rows, rowsPerPage, rowTop, rowStep, columns, pageClassName = '', pageNumber, pageCount }) {
  const overlays = [
    officialIndexOverlay(unit, 13.4, 11.75, 20, 2.7, 'official-index-unit')
  ];
  const pageRows = Array.from({ length: rowsPerPage }, (_unused, index) => rows[index] || null);
  pageRows.forEach((row, rowIndex) => {
    if (!row) return;
    columns.forEach((column, columnIndex) => {
      overlays.push(officialIndexOverlay(
        row[columnIndex] || '',
        column.left,
        rowTop + (rowIndex * rowStep),
        column.width,
        rowStep,
        `official-index-cell ${column.className || ''}`.trim()
      ));
    });
  });
  return `
    <article class="official-index-page ${pageClassName} print-document-area">
      <img src="./assets/official-forms/${image}" alt="Επίσημο ευρετήριο ΤΕ 34-254" />
      <div class="official-index-cleanup official-index-page-number-mask"></div>
      <div class="official-index-cleanup official-index-footer-mask"></div>
      <div class="official-index-page-counter">Σελίδα ${pageNumber} από Σελίδα ${pageCount}</div>
      ${overlays.join('')}
    </article>
  `;
}

function officialIndexOverlay(value, left, top, width, height, className) {
  return `<div class="official-index-overlay ${className}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escapeHtml(value ?? '')}</div>`;
}

function renderIndexPages(config) {
  const rowsPerPage = config.rowsPerPage || ROWS_PER_INDEX_PAGE;
  const pageCount = Math.max(1, Math.ceil((config.rows || []).length / rowsPerPage));
  return Array.from({ length: pageCount }, (_unused, pageIndex) =>
    renderIndexPage({
      ...config,
      rows: (config.rows || []).slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage),
      rowsPerPage,
      pageNumber: pageIndex + 1,
      pageCount
    })
  ).join('');
}

function renderIndexPage({ unit, code, subCode, title, subtitle, columns, numbers, rows = [], rowsPerPage = ROWS_PER_INDEX_PAGE, showPageNumber = false, pageNumber = 1, pageCount = 1 }) {
  const pageRows = Array.from({ length: rowsPerPage }, (_unused, index) => rows[index] || null);
  return `
    <article class="index-page print-document-area">
      <div class="index-topline">
        <span>ΜΟΝΑΔΑ:${escapeHtml(unit || '')}</span>
        <span><strong>${code}</strong>${subCode ? `<br />${subCode}` : ''}</span>
      </div>
      <h1>${title}</h1>
      ${subtitle ? `<h2>${subtitle}</h2>` : ''}
      <table class="index-table index-columns-${columns.length}">
        <thead>
          <tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>
          <tr>${numbers.map((number) => `<th>${number}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${pageRows.map((row) => `<tr>${columns.map((_column, index) => `<td>${row ? escapeHtml(row[index] || '') : ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      ${showPageNumber ? `<footer class="index-page-number">Σελίδα ${pageNumber} από ${pageCount}</footer>` : ''}
    </article>
  `;
}

export { bindExternalIndexControls, bindFiscalYearControls, bindOrdersIndexControls, renderChargeCreditOrdersIndex, renderExternalIndexTable, renderExternalTransactionsIndex, renderFiscalYearControls, renderIndexAnnualSignatures, renderIndexPages, renderIndexTableControls, renderOrdersIndexTable, selectFirstMaterialPerAddy };
