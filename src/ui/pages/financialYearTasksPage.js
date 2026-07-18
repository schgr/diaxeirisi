import { escapeHtml } from '../components/forms.js';

export async function renderFinancialYearTasksPage(container, transactionsApi, showToast) {
  const state = {
    source: 'addy',
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
    <section class="page-panel">
      <div class="transaction-tabs" aria-label="Κατηγορία ελέγχου κινήσεων">
        <button class="transaction-tab active" data-financial-source="addy" type="button">Έλεγχος Κινήσεων ΑΔΔΥ</button>
        <button class="transaction-tab" data-financial-source="exhp" type="button">Έλεγχος Κινήσεων ΕΧΠ</button>
      </div>
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
  `;

  const results = container.querySelector('[data-financial-results]');

  async function refresh() {
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
      container.querySelectorAll('[data-financial-source]').forEach((item) => {
        item.classList.toggle('active', item === button);
      });
      void refresh();
    });
  });

  container.querySelector('[data-financial-year]').addEventListener('change', (event) => {
    state.fiscalYear = Number(event.target.value) || new Date().getFullYear();
    void refresh();
  });
  container.querySelector('[data-financial-type]').addEventListener('change', (event) => {
    state.transactionType = event.target.value;
    void refresh();
  });

  await refresh();
}

export function renderFinancialYearMovementTable(rows, source, transactionType) {
  const sourceLabel = source === 'addy' ? 'ΑΔΔΥ' : 'ΕΧΠ';
  const typeLabel = transactionType === 'Πίστωση' ? 'Πιστωτικές' : 'Χρεωστικές';
  const unitHeader = source === 'addy' ? '<th>ΜΟΝΑΔΑ ΔΟΣΟΛΗΨΙΑΣ</th>' : '';
  const body = rows.length
    ? rows.map((row) => `
        <tr>
          <td>${escapeHtml(row.serial)}</td>
          <td>${escapeHtml(row.shareNumber)}</td>
          <td>${escapeHtml(row.ledgerSerial)}</td>
          <td>${escapeHtml(row.transactionKind)}</td>
          <td>${escapeHtml(formatDate(row.date))}</td>
          <td>${escapeHtml(formatQuantity(row.quantity))}</td>
          ${source === 'addy' ? `<td>${escapeHtml(row.transactionUnit)}</td>` : ''}
        </tr>
      `).join('')
    : `<tr><td colspan="${source === 'addy' ? 7 : 6}" class="empty-table">Δεν βρέθηκαν κινήσεις.</td></tr>`;

  return `
    <div class="section-heading">
      <div><h3>Έλεγχος Κινήσεων ${sourceLabel}</h3><p class="muted">${typeLabel} κινήσεις · ${rows.length} εγγραφές</p></div>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr>
          <th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΜΕΡΙΔΑΣ</th><th>Α/Α ΔΟΣΟΛΗΨΙΑΣ</th>
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
