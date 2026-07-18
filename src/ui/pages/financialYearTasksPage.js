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
      menu.hidden = true;
      detail.hidden = false;
      void refresh();
    });
  });

  container.querySelector('[data-financial-back]').addEventListener('click', () => {
    state.source = null;
    detail.hidden = true;
    menu.hidden = false;
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
          <td>${escapeHtml(row.transactionKind)}</td>
          <td>${escapeHtml(formatDate(row.date))}</td>
          <td>${escapeHtml(formatQuantity(row.quantity))}</td>
          ${source === 'addy' ? `<td>${escapeHtml(row.transactionUnit)}</td>` : ''}
        </tr>
      `).join('')
    : `<tr><td colspan="${source === 'addy' ? 8 : 7}" class="empty-table">Δεν βρέθηκαν κινήσεις.</td></tr>`;

  return `
    <div class="section-heading">
      <div><h3>Έλεγχος Κινήσεων ${sourceLabel}</h3><p class="muted">${typeLabel} κινήσεις · ${rows.length} εγγραφές</p></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΕΥΡΕΤΗΡΙΟΥ</th><th>ΑΡΙΘΜΟΣ ΜΕΡΙΔΑΣ</th><th>Α/Α ΔΟΣΟΛΗΨΙΑΣ</th>
          <th>ΕΙΔΟΣ ΔΟΣΟΛΗΨΙΑΣ</th><th>ΗΜΕΡΟΜΗΝΙΑ</th><th>ΠΟΣΟΤΗΤΑ</th>${unitHeader}
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
