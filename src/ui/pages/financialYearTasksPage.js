import { escapeHtml } from '../components/forms.js';

export async function renderFinancialYearTasksPage(container, transactionsApi, yearEndApi, showToast) {
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
      <button class="home-tile transaction-flow-tile" data-financial-source="renumber" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΑΡ</span>
        <span class="home-tile-title">Αλλαγή Αρίθμησης Μερίδων</span>
        <span class="home-tile-code">§ ΕΟΕ-Γ</span>
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

    <div data-renumber-detail hidden>
      <div class="page-toolbar no-print">
        <button class="secondary-button" data-renumber-back type="button">Πίσω στις Εργασίες Οικονομικού Έτους</button>
      </div>
      <section class="page-panel">
        <div class="renumber-header">
          <h3>Αλλαγή Αρίθμησης Μερίδων</h3>
          <p class="muted">Η εφαρμογή δημιουργεί πρώτα Κατάσταση Απογραφής με την παλιά αρίθμηση. Στο πεδίο 15 εμφανίζεται «Αρχείο» μόνο για τις αρχειοθετημένες μερίδες.</p>
          <label class="field compact-field renumber-year-field">
            <span>Οικονομικό Έτος</span>
            <input data-renumber-year type="number" min="2000" max="2100" value="${state.fiscalYear}" />
          </label>
        </div>
        <div class="form-actions renumber-top-actions no-print">
          <button class="secondary-button" data-renumber-check type="button">Έλεγχος</button>
          <button class="primary-button" data-renumber-save type="button">Αποθήκευση Νέας Αρίθμησης</button>
        </div>
        <div class="form-message" data-renumber-message hidden></div>
        <div data-renumber-results><p class="muted">Φόρτωση μερίδων...</p></div>
      </section>
    </div>
  `;

  const menu = container.querySelector('[data-financial-menu]');
  const detail = container.querySelector('[data-financial-detail]');
  const results = container.querySelector('[data-financial-results]');
  const renumberDetail = container.querySelector('[data-renumber-detail]');
  const renumberResults = container.querySelector('[data-renumber-results]');
  const renumberMessage = container.querySelector('[data-renumber-message]');

  function showMenu() {
    state.source = null;
    detail.hidden = true;
    renumberDetail.hidden = true;
    menu.classList.remove('is-hidden');
    menu.hidden = false;
  }

  async function loadRenumbering() {
    renumberResults.innerHTML = '<p class="muted">Φόρτωση μερίδων...</p>';
    renumberMessage.hidden = true;
    try {
      const data = await yearEndApi.getRenumberingData();
      state.fiscalYear = Number(data.fiscalYear || state.fiscalYear);
      container.querySelector('[data-renumber-year]').value = state.fiscalYear;
      renumberResults.innerHTML = renderRenumberingTable(data.shares);
    } catch (error) {
      renumberResults.innerHTML = '<p class="muted">Δεν ήταν δυνατή η φόρτωση των μερίδων.</p>';
      showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση των μερίδων.', 'error');
    }
  }

  function collectRenumberingPayload() {
    return {
      fiscalYear: Number(container.querySelector('[data-renumber-year]').value),
      items: [...renumberResults.querySelectorAll('[data-renumber-row]')].map((row) => ({
        shareId: Number(row.dataset.shareId),
        newShareNumber: row.querySelector('[data-new-share-number]').value
      }))
    };
  }

  function setRenumberMessage(message, type = 'success') {
    renumberMessage.textContent = message;
    renumberMessage.className = `form-message ${type === 'error' ? 'error-message' : 'success-message'}`;
    renumberMessage.hidden = false;
  }

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
      if (state.source === 'renumber') {
        renumberDetail.hidden = false;
        void loadRenumbering();
      } else {
        detail.hidden = false;
        void refresh();
      }
    });
  });

  container.querySelector('[data-financial-back]').addEventListener('click', () => {
    showMenu();
  });
  container.querySelector('[data-renumber-back]').addEventListener('click', showMenu);
  container.querySelector('[data-renumber-check]').addEventListener('click', async () => {
    try {
      const validation = await yearEndApi.validateRenumbering(collectRenumberingPayload());
      setRenumberMessage(validation.message);
      showToast(validation.message, 'success');
    } catch (error) {
      setRenumberMessage(error.message || 'Ο έλεγχος απέτυχε.', 'error');
      showToast(error.message || 'Ο έλεγχος απέτυχε.', 'error');
    }
  });
  container.querySelector('[data-renumber-save]').addEventListener('click', async () => {
    try {
      const payload = collectRenumberingPayload();
      await yearEndApi.validateRenumbering(payload);
      const accepted = window.confirm(
        'Η αλλαγή αρίθμησης θα εφαρμοστεί σε όλες τις καρτέλες υλικού και είναι μη αναστρέψιμη. Θέλετε να συνεχίσετε;'
      );
      if (!accepted) return;
      const result = await yearEndApi.applyRenumbering(payload);
      await loadRenumbering();
      setRenumberMessage(result.message);
      showToast(result.message, 'success');
    } catch (error) {
      setRenumberMessage(error.message || 'Η αποθήκευση απέτυχε.', 'error');
      showToast(error.message || 'Η αποθήκευση απέτυχε.', 'error');
    }
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

function renderRenumberingTable(shares) {
  const body = shares.length
    ? shares.map((share, index) => `
        <tr data-renumber-row data-share-id="${escapeHtml(share.id)}">
          <td>${index + 1}</td>
          <td>${escapeHtml(share.shareNumber)}</td>
          <td><input class="table-input" data-new-share-number type="text" autocomplete="off" aria-label="Νέος αριθμός μερίδας ${escapeHtml(share.shareNumber)}" /></td>
          <td>${escapeHtml(share.description)}</td>
          <td>${escapeHtml(formatQuantity(share.quantity))}</td>
        </tr>
      `).join('')
    : '<tr><td colspan="5" class="empty-table">Δεν υπάρχουν ενεργές μερίδες.</td></tr>';
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΜΕΡΙΔΑΣ</th><th>ΝΕΟΣ ΑΡΙΘΜΟΣ ΜΕΡΙΔΑΣ</th><th>ΠΕΡΙΓΡΑΦΗ</th><th>ΠΟΣΟΤΗΤΑ</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
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
