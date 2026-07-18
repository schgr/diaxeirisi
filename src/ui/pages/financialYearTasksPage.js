import { escapeHtml } from '../components/forms.js';

export async function renderFinancialYearTasksPage(container, transactionsApi, showToast) {
  const state = {
    source: null,
    fiscalYear: new Date().getFullYear(),
    transactionType: 'Πίστωση'
  };

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΕΛΕΓΧΟΣ ΚΑΙ ΣΥΜΦΩΝΙΑ</p>
        <h2>Εργασίες Οικονομικού Έτους</h2>
      </div>
    </section>

    <section class="transaction-flow-home" data-financial-menu aria-label="Επιλογή ελέγχου κινήσεων">
      <button class="home-tile transaction-flow-tile" data-financial-source="addy" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΑΔ</span>
        <span class="home-tile-title">Έλεγχος Κινήσεων ΑΔΔΥ</span>
        <span class="home-tile-code">§ ΕΟΕ-Α</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-financial-source="exhp" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΕΧ</span>
        <span class="home-tile-title">Έλεγχος Κινήσεων ΕΧΠ</span>
        <span class="home-tile-code">§ ΕΟΕ-Β</span>
      </button>
    </section>

    <div data-financial-detail hidden>
      <div class="page-toolbar no-print">
        <button class="secondary-button" data-financial-back type="button">Πίσω στις Εργασίες Οικονομικού Έτους</button>
        <button class="primary-button" data-financial-print type="button">Εκτύπωση Κατάστασης</button>
      </div>
      <section class="page-panel">
        <div class="inline-form">
          <label class="field">
            <span>Οικονομικό Έτος</span>
            <input data-financial-year type="number" min="2000" max="2100" value="${state.fiscalYear}" />
          </label>
          <label class="field">
            <span>Κινήσεις</span>
            <select data-financial-type>
              <option value="Πίστωση">Πιστωτικές</option>
              <option value="Χρέωση">Χρεωστικές</option>
            </select>
          </label>
        </div>
      </section>
      <section class="page-panel">
        <div data-financial-results></div>
      </section>
    </div>
  `;

  const menu = container.querySelector('[data-financial-menu]');
  const detail = container.querySelector('[data-financial-detail]');
  const results = container.querySelector('[data-financial-results]');

  async function refresh() {
    if (!state.source) return;
    results.innerHTML = '<p class="muted">Φόρτωση κινήσεων...</p>';
    try {
      const rows = await transactionsApi.listFinancialYearMovementRows(
        state.source,
        state.fiscalYear,
        state.transactionType
      );
      results.innerHTML = renderFinancialYearMovementTable(rows, state.source, state.transactionType);
    } catch (error) {
      results.innerHTML = '<p class="muted">Δεν ήταν δυνατή η φόρτωση της κατάστασης.</p>';
      showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση των κινήσεων.', 'error');
    }
  }

  container.querySelectorAll('[data-financial-source]').forEach((button) => {
    button.addEventListener('click', () => {
      state.source = button.dataset.financialSource;
      menu.classList.add('is-hidden');
      menu.hidden = true;
      detail.hidden = false;
      void refresh();
    });
  });

  container.querySelector('[data-financial-back]').addEventListener('click', () => {
    state.source = null;
    detail.hidden = true;
    menu.classList.remove('is-hidden');
    menu.hidden = false;
  });
  container.querySelector('[data-financial-print]').addEventListener('click', async () => {
    try {
      const result = await printFinancialYearResults(results);
      if (result && result.printed === false && result.failureReason) {
        showToast(`Η εκτύπωση δεν ολοκληρώθηκε: ${result.failureReason}`, 'error');
      }
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η εκτύπωση της κατάστασης.', 'error');
    }
  });
  container.querySelector('[data-financial-year]').addEventListener('change', (event) => {
    state.fiscalYear = Number(event.target.value) || new Date().getFullYear();
    void refresh();
  });
  container.querySelector('[data-financial-type]').addEventListener('change', (event) => {
    state.transactionType = event.target.value;
    void refresh();
  });
}

export function renderFinancialYearMovementTable(rows, source, transactionType) {
  const sourceLabel = source === 'addy' ? 'ΑΔΔΥ' : 'ΕΧΠ';
  const typeLabel = transactionType === 'Πίστωση' ? 'Πιστωτικές' : 'Χρεωστικές';
  const unitHeader = source === 'addy' ? '<th>ΜΟΝΑΔΑ ΔΟΣΟΛΗΨΙΑΣ</th>' : '';
  const body = rows.length
    ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.serial)}</td>
          <td>${escapeHtml(row.registryNumber)}</td>
          <td>${escapeHtml(row.shareNumber)}</td>
          <td>${escapeHtml(row.ledgerSerial)}</td>
          <td>${escapeHtml(row.description)}</td>
          <td>${escapeHtml(row.transactionKind)}</td>
          <td>${escapeHtml(formatDate(row.date))}</td>
          <td>${escapeHtml(formatQuantity(row.quantity))}</td>
          ${source === 'addy' ? `<td>${escapeHtml(row.transactionUnit)}</td>` : ''}
        </tr>
      `).join('')
    : `<tr><td colspan="${source === 'addy' ? 9 : 8}" class="empty-table">Δεν βρέθηκαν κινήσεις.</td></tr>`;

  return `
    <div class="section-heading">
      <div><h3>Έλεγχος Κινήσεων ${sourceLabel}</h3><p class="muted">${typeLabel} κινήσεις · ${rows.length} εγγραφές</p></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΕΥΡΕΤΗΡΙΟΥ</th><th>ΑΡΙΘΜΟΣ ΜΕΡΙΔΑΣ</th><th>Α/Α ΔΟΣΟΛΗΨΙΑΣ</th>
          <th>ΠΕΡΙΓΡΑΦΗ</th><th>ΕΙΔΟΣ ΔΟΣΟΛΗΨΙΑΣ</th><th>ΗΜΕΡΟΜΗΝΙΑ</th><th>ΠΟΣΟΤΗΤΑ</th>${unitHeader}
        </tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>
  `;
}

function formatDate(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : value || '';
}

function formatQuantity(value) {
  return new Intl.NumberFormat('el-GR', { maximumFractionDigits: 3 }).format(Number(value || 0));
}

async function printFinancialYearResults(results) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = `
    <style>
      @page { size: A4 landscape; margin: 8mm; }
      .financial-year-print-sheet.print-document-area { position: relative; inset: auto; box-sizing: border-box; width: 100%; min-height: 0; padding: 4mm; page: landscape; page-break-after: auto; background: #fff; color: #000; font-family: Arial, sans-serif; visibility: visible; }
      .financial-year-print-sheet h3 { margin: 0 0 3mm; font-size: 16pt; }
      .financial-year-print-sheet .muted { margin: 0 0 5mm; color: #333; }
      .financial-year-print-sheet table { width: 100%; border-collapse: collapse; table-layout: auto; font-size: 9pt; }
      .financial-year-print-sheet th, .financial-year-print-sheet td { padding: 2mm 1.5mm; border: 1px solid #555; color: #000; text-align: left; }
      .financial-year-print-sheet th { background: #e8eef5; font-size: 8pt; }
    </style>
    <section class="financial-year-print-sheet print-document-area">${results.innerHTML}</section>
  `;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await waitForPrintLayout();
    return await window.appApi.print.currentDocument({ landscape: true });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

function waitForPrintLayout() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}
