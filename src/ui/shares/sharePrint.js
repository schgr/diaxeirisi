import { escapeHtml } from '../components/forms.js';
import { formatQuantity, formatDate, formatDateWithDashes } from './shared.js';

function openMaterialFormPreview(title, documentHtml, landscape = false) {
  const existing = document.querySelector('.material-form-preview-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop material-form-preview-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal">
      <header class="material-card-header no-print">
        <h2>${escapeHtml(title)}</h2>
        <div class="row-actions">
          <button class="secondary-button" data-close-material-form type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-material-form type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="request-document-preview">${documentHtml}</div>
    </div>
  `;

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-material-form]')) {
      backdrop.remove();
      return;
    }

    if (event.target.closest('[data-print-material-form]')) {
      void printMaterialFormDocument(landscape);
    }
  });

  document.body.appendChild(backdrop);
}

async function printMaterialFormDocument(landscape) {
  const preview = document.querySelector('.material-form-preview-backdrop .request-document-preview');
  if (!preview) return;

  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root material-form-isolated-print-root';
  printRoot.innerHTML = preview.innerHTML;
  const pageStyle = document.createElement('style');
  pageStyle.dataset.materialFormPageStyle = 'true';
  pageStyle.textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'} !important; margin: 0; }`;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  document.head.appendChild(pageStyle);
  try {
    await window.appApi.print.currentDocument({ landscape });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
    pageStyle.remove();
  }
}

function renderChangeSheetDocument(card) {
  const rowsPerPage = 14;
  const compositionItems = card.compositionItems || [];
  const pageCount = Math.max(1, Math.ceil(compositionItems.length / rowsPerPage));
  const changeEntries = collectRenderableChangeEntries(card);
  const chargeColumns = collectChangeColumns(changeEntries, 'ΧΡΕΩΣΗ');
  const creditColumns = collectChangeColumns(changeEntries, 'ΠΙΣΤΩΣΗ');
  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const startIndex = pageIndex * rowsPerPage;
    const items = Array.from(
      { length: rowsPerPage },
      (_row, rowIndex) => compositionItems[startIndex + rowIndex] || null
    );
    return `
    <article class="change-sheet-document-page print-document-area">
      <div class="material-form-code">ΔΥΠ/191</div>
      <h1>ΦΥΛΛΟ ΜΕΤΑΒΟΛΩΝ ΕΙΔΩΝ ΣΥΝΘΕΣΕΩΣ<br />ΣΥΛΛΟΓΗΣ ΕΡΓΑΛΕΙΩΝ Η (ΔΙΑΣ) ΠΑΡΑΚΟΛΟΥΘΗΜΑΤΩΝ ΚΥΡΙΩΝ ΥΛΙΚΩΝ</h1>
      <div class="change-sheet-details">
        <div class="change-sheet-registration">
          <p>ΑΡΙΘΜ. ΚΑΤΑΧΩΡΗΣΗΣ: <strong>${escapeHtml(card.share.shareNumber)}</strong></p>
          <p>ΑΡΙΘΜ. ΟΝΟΜΑΣΤΙΚΟΥ: <strong>${escapeHtml(card.share.nominalNumber)}</strong></p>
        </div>
        <p class="change-sheet-main-description">ΠΕΡΙΓΡΑΦΗ ΚΥΡΙΟΥ ΥΛΙΚΟΥ Ή ΤΙΤΛΟΣ ΣΥΛΛΟΓΗΣ:
          <strong>${escapeHtml(card.share.description)}</strong></p>
        <p class="change-sheet-main-quantity">Αριθμός Κ.Υ. Προβλεπ.
          <strong>${formatQuantity(card.share.projectedQuantity)}</strong>
          &nbsp;&nbsp; Υπάρχ. <strong>${formatQuantity(card.share.accountingBalance)}</strong></p>
      </div>
      <table class="change-sheet-document-table">
        <thead>
          <tr>
            <th colspan="2">ΣΤΟΙΧΕΙΑ ΥΛΙΚΟΥ ΠΟΥ ΥΦΙΣΤΑΤΑΙ ΤΗ ΜΕΤΑΒΟΛΗ</th>
            <th colspan="10">ΧΡΕΩΣΗ</th>
            <th colspan="10">ΠΙΣΤΩΣΗ</th>
            <th colspan="2">ΔΙΑΦΟΡΑ</th>
          </tr>
          <tr>
            <th>ΑΡΙΘΜΟΣ<br />ΟΝΟΜΑΣΤΙΚΟΥ</th>
            <th>ΠΕΡΙΓΡΑΦΗ</th>
            ${renderChangeDateHeaders(chargeColumns, 10)}
            ${renderChangeDateHeaders(creditColumns, 10)}
            <th class="vertical-table-heading">ΠΛΕΟΝΑΣΜΑ</th>
            <th class="vertical-table-heading">ΕΛΛΕΙΜΜΑ</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map((item, rowIndex) =>
              renderChangeSheetDocumentRow(
                item,
                changeEntries.filter(
                  (entry) => Number(entry.componentLineNumber || 1) === startIndex + rowIndex + 1
                ),
                chargeColumns.map((column) => column.key),
                creditColumns.map((column) => column.key)
              )
            )
            .join('')}
        </tbody>
      </table>
    </article>
  `;
  }).join('');
}

function collectRenderableChangeEntries(card) {
  const entries = [...(card.changeSheetEntries || [])];
  const openingDate = card.openingTransfer?.inventoryDate;
  const hasOpeningInventory = entries.some(
    (entry) => normalizeInventoryReference(entry.orderReference) === 'ΑΠΟΓΡΑΦΗ'
  );
  if (!openingDate || hasOpeningInventory) return entries;
  const reference = card.openingTransfer?.reference || 'ΑΠΟΓΡΑΦΗ';
  (card.compositionItems || []).forEach((item, index) => {
    const quantity = Number(item.quantityPerMaterial || item.quantity || 0) *
      Number(card.openingTransfer?.balance || 0);
    if (quantity <= 0) return;
    entries.push({
      changeDate: openingDate,
      orderReference: reference,
      componentLineNumber: index + 1,
      movementType: 'ΧΡΕΩΣΗ',
      quantity
    });
  });
  return entries;
}

function collectChangeColumns(entries, movementType) {
  const columns = [];
  const seen = new Set();
  entries
    .filter((entry) => entry.movementType === movementType)
    .forEach((entry) => {
      const key = changeColumnKey(entry);
      if (!entry.changeDate || seen.has(key) || columns.length >= 10) return;
      seen.add(key);
      columns.push({ key, date: entry.changeDate, reference: entry.orderReference || '' });
    });
  return columns;
}

function renderChangeDateHeaders(columns, count) {
  return Array.from({ length: count }, (_unused, index) => {
    const column = columns[index];
    if (!column) return '<th class="vertical-table-heading"></th>';
    const date = formatChangeSheetDate(column.date);
    const reference = column.reference
      ? normalizeInventoryReference(column.reference) === 'ΑΠΟΓΡΑΦΗ'
        ? 'Απογραφή'
        : column.reference
      : '';
    const fullLabel = reference
      ? normalizeInventoryReference(reference) === 'ΑΠΟΓΡΑΦΗ'
        ? `${reference} ${date}`
        : `${reference}/${date}`
      : date;
    return `<th class="vertical-table-heading change-sheet-movement-heading"><span>${escapeHtml(fullLabel)}</span></th>`;
  }).join('');
}

function normalizeInventoryReference(value) {
  const normalized = String(value || '').trim().toLocaleUpperCase('el-GR');
  return normalized.includes('ΑΠΟΓΡΑΦ') ? 'ΑΠΟΓΡΑΦΗ' : normalized;
}

function formatChangeSheetDate(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  return year && month && day ? `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}` : '';
}

function renderChangeSheetDocumentRow(item, entries, chargeKeys, creditKeys) {
  const chargeByDate = sumChangesByColumn(entries, 'ΧΡΕΩΣΗ');
  const creditByDate = sumChangesByColumn(entries, 'ΠΙΣΤΩΣΗ');
  const chargeCells = Array.from({ length: 10 }, (_unused, index) => {
    const quantity = chargeByDate.get(chargeKeys[index]);
    return `<td class="change-sheet-movement-value">${quantity ? formatQuantity(quantity) : ''}</td>`;
  }).join('');
  const creditCells = Array.from({ length: 10 }, (_unused, index) => {
    const quantity = creditByDate.get(creditKeys[index]);
    return `<td class="change-sheet-movement-value">${quantity ? formatQuantity(quantity) : ''}</td>`;
  }).join('');
  return `
    <tr>
      <td>${item ? escapeHtml(item.componentNominalNumber) : ''}</td>
      <td>${item ? escapeHtml(item.componentDescription) : ''}</td>
      ${chargeCells}
      ${creditCells}
      <td></td>
      <td></td>
    </tr>
  `;
}

function sumChangesByColumn(entries, movementType) {
  const totals = new Map();
  entries
    .filter((entry) => entry.movementType === movementType)
    .forEach((entry) => {
      const key = changeColumnKey(entry);
      totals.set(key, (totals.get(key) || 0) + Number(entry.quantity || 0));
    });
  return totals;
}

function changeColumnKey(entry) {
  return `${entry.orderReference || ''}|${entry.changeDate || ''}`;
}

function openSharePrintDocument(card) {
  const existing = document.querySelector('.share-print-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop share-print-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΜΕΡΙΔΑ ΥΛΙΚΟΥ</p>
          <h2>Μερίδα Υλικού - Δελτίο Υπολοίπων</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-share-print type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-share-document type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="request-document-preview">
        ${renderSharePrintDocument(card)}
      </div>
    </div>
  `;

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-share-print]')) {
      backdrop.remove();
      return;
    }

    if (event.target.closest('[data-print-share-document]')) {
      void window.appApi.print.currentDocument({ landscape: false });
    }
  });

  document.body.appendChild(backdrop);
}

function renderSharePrintDocument(card, options = {}) {
  const frontRows = card.transactions.slice(0, 12);
  const remainingRows = card.transactions.slice(12);
  const pages = [{ side: 'front', rows: frontRows, startIndex: 0 }];
  for (let startIndex = 0; startIndex < remainingRows.length; startIndex += 32) {
    pages.push({
      side: 'back',
      rows: remainingRows.slice(startIndex, startIndex + 32),
      startIndex: 12 + startIndex
    });
  }
  return pages.map((page, pageIndex) => {
    const openingBalance = page.startIndex === 0
      ? card.openingTransfer?.balance
      : card.transactions[page.startIndex - 1]?.balance;
    const hasFollowingPage = pageIndex < pages.length - 1;
    const transferBalance = hasFollowingPage
      ? page.rows[page.rows.length - 1]?.balance ?? openingBalance
      : '';
    if (page.side === 'back') {
      return renderOfficialShareBackPage(page.rows, openingBalance, transferBalance);
    }
    return `
      <article class="official-share-page print-document-area">
        <img src="./assets/official-forms/share-card-expanded-23-24.png" alt="Μερίδα Υλικού - Δελτίο Υπολοίπων" />
        ${options.exactCopy
          ? shareDocumentOverlay(options.exactCopy, 4.1, 18.1, 28.2, 1.5, 'share-exact-copy-overlay')
          : ''}
        ${options.issuerName
          ? shareDocumentOverlay(options.issuerName, 4.1, 21.8, 28.2, 1.5, 'share-issuer-name-overlay')
          : ''}
        ${options.issuerRank
          ? shareDocumentOverlay(options.issuerRank, 4.1, 23.3, 28.2, 1.5, 'share-issuer-rank-overlay')
          : ''}
        ${shareDocumentOverlay(card.share.nominalNumber, 33.5, 14.2, 34.0, 2.6)}
        ${shareDocumentOverlay(card.share.shareNumber, 69.5, 14.2, 19.0, 2.6)}
        ${shareDocumentOverlay(card.share.description, 33.5, 18.6, 34.0, 2.8, 'material-description-overlay')}
        ${shareDocumentOverlay(card.share.materialCode, 70.0, 22.9, 18.0, 2.6)}
        ${shareDocumentOverlay(card.share.measurementUnit, 4.0, 30.6, 28.4, 2.6)}
        ${shareDocumentOverlay(card.share.unitPrice ? formatQuantity(card.share.unitPrice) : '', 55.0, 30.6, 16.0, 2.6)}
        ${shareDocumentOverlay(
          `ΑΠΟ ΜΕΤΑΦΟΡΑ - ΑΠΟΓΡΑΦΗ ${resolvePreviousYearInventoryDate(card, options)}`,
          3.9,
          64.45,
          86.2,
          1.75,
          'share-opening-inventory-overlay'
        )}
        ${shareDocumentOverlay(
          formatQuantity(openingBalance || 0),
          68.1,
          64.45,
          11.6,
          1.75,
          'share-opening-balance-overlay'
        )}
        ${renderOfficialShareRows(page.rows)}
        ${hasFollowingPage
          ? shareDocumentOverlay(
            formatQuantity(transferBalance || 0),
            68.1,
            86.85,
            11.6,
            1.75,
            'share-transfer-balance-overlay'
          )
          : ''}
      </article>
    `;
  }).join('');
}

function resolvePreviousYearInventoryDate(card, options) {
  const selectedFiscalYear = Number(options?.fiscalYear);
  if (Number.isInteger(selectedFiscalYear) && selectedFiscalYear > 1) {
    return `31-12-${selectedFiscalYear - 1}`;
  }

  const inventoryYear = Number(String(card.openingTransfer?.inventoryDate || '').slice(0, 4));
  if (Number.isInteger(inventoryYear) && inventoryYear > 0) {
    return `31-12-${inventoryYear}`;
  }

  const transactionYear = Number(String(card.transactions?.[0]?.date || '').slice(0, 4));
  const fiscalYear = Number.isInteger(transactionYear) && transactionYear > 1
    ? transactionYear
    : new Date().getFullYear();
  return `31-12-${fiscalYear - 1}`;
}

function renderOfficialShareBackPage(rows, openingBalance, transferBalance) {
  const pageRows = Array.from({ length: 32 }, (_unused, index) => rows[index] || null);
  return `
    <article class="official-share-page official-share-back-page print-document-area">
      <section class="official-share-back-sheet" aria-label="Μερίδα Υλικού - Δελτίο Υπολοίπων, πίσω πλευρά">
        <div class="official-share-back-code">Κ 2309ΔΥΠ</div>
        <h2>ΜΕΡΙΔΑ ΥΛΙΚΟΥ - ΔΕΛΤΙΟ ΥΠΟΛΟΙΠΩΝ</h2>
        <table class="official-share-back-table">
          <thead>
            <tr>
              <th>Α/Α</th>
              <th class="official-share-back-date-heading">ΗΜΕΡ</th>
              <th>ΧΡΕΩΣΗ<br />Ή<br />ΠΙΣΤΩΣΗ</th>
              <th>ΑΡΙΘΜ<br />ΕΥΡΥΤΗΡΙΟΥ</th>
              <th>ΕΙΣΑΓΩΓΕΣ</th>
              <th>ΕΞΑΓΩΓΕΣ</th>
              <th>ΥΠΟΛΟΙΠΟ</th>
              <th>ΠΑΡΑΤΗΡΗΣΕΙΣ</th>
            </tr>
            <tr class="official-share-back-column-numbers">
              ${Array.from({ length: 8 }, (_unused, index) => `<th>${index + 22}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            <tr class="official-share-back-transfer-row">
              <td colspan="6">ΑΠΟ ΜΕΤΑΦΟΡΑ</td>
              <td>${openingBalance === '' || openingBalance === null || openingBalance === undefined ? '' : formatQuantity(openingBalance)}</td>
              <td></td>
            </tr>
            ${pageRows.map(renderOfficialShareBackRow).join('')}
            <tr class="official-share-back-transfer-row">
              <td colspan="6">ΓΙΑ ΜΕΤΑΦΟΡΑ</td>
              <td>${transferBalance === '' ? '' : formatQuantity(transferBalance)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
        <table class="official-share-back-summary">
          <colgroup><col class="official-share-back-summary-label" />${'<col />'.repeat(12)}</colgroup>
          <tbody>
            <tr><th>30. ΤΜΗΜΑΤΑ</th>${'<td></td>'.repeat(12)}</tr>
            <tr><th>31. ΠΡΟΒΛΕΠΟΜΕΝΑ</th>${'<td></td>'.repeat(12)}</tr>
            <tr><th>32. ΥΠΑΡΧΟΝΤΑ</th>${'<td></td>'.repeat(12)}</tr>
            <tr><th>33. ΔΙΑΦΟΡΑ</th>${'<td></td>'.repeat(12)}</tr>
          </tbody>
        </table>
        <div class="official-share-back-footer">ΕΦΟΔ 101</div>
      </section>
    </article>
  `;
}

function renderOfficialShareBackRow(item) {
  if (!item) return '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
  return `
    <tr>
      <td>${escapeHtml(item.serialNumber)}</td>
      <td>${escapeHtml(formatDate(item.date))}</td>
      <td class="official-share-back-unit">${escapeHtml(item.transactionUnit)}</td>
      <td>${escapeHtml(item.registryNumber)}</td>
      <td>${item.imports ? formatQuantity(item.imports) : ''}</td>
      <td>${item.exports ? formatQuantity(item.exports) : ''}</td>
      <td>${formatQuantity(item.balance)}</td>
      <td></td>
    </tr>
  `;
}

function renderShareBackTemplate() {
  return renderOfficialShareBackPage([], '', '');
}

function renderOfficialShareRows(rows) {
  const columns = [
    { left: 3.9, width: 5.4, value: (item) => item.serialNumber },
    { left: 9.5, width: 8.1, value: (item) => formatDate(item.date) },
    { left: 17.8, width: 12.9, value: (item) => item.transactionUnit },
    { left: 30.8, width: 13.1, value: (item) => item.registryNumber },
    { left: 44.2, width: 13.0, value: (item) => item.imports ? formatQuantity(item.imports) : '' },
    { left: 57.3, width: 10.6, value: (item) => item.exports ? formatQuantity(item.exports) : '' },
    { left: 68.1, width: 11.6, value: (item) => formatQuantity(item.balance) },
    { left: 79.9, width: 10.2, value: () => '' }
  ];
  return rows.map((item, rowIndex) => columns.map((column) => shareDocumentOverlay(
    column.value(item),
    column.left,
    66.15 + rowIndex * 1.72,
    column.width,
    1.72,
    column === columns[7] ? 'material-description-overlay' : ''
  )).join('')).join('');
}

function shareDocumentOverlay(value, left, top, width, height, className = '') {
  return `<div class="official-share-overlay ${className}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escapeHtml(value ?? '')}</div>`;
}

export { openMaterialFormPreview, printMaterialFormDocument, renderChangeSheetDocument, openSharePrintDocument, renderSharePrintDocument, renderShareBackTemplate };
