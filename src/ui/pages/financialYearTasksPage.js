import { escapeHtml, renderFiscalYearOptions } from '../components/forms.js';
import { printArchivedSharesTable, renderArchivePanel } from './administrationPage.js';
import { renderChangeSheetDocument, renderSharePrintDocument } from './sharesPage.js';
import { splitOfficerSignature } from '../officerSignature.js';

export async function renderFinancialYearTasksPage(
  container,
  transactionsApi,
  yearEndApi,
  administrationApi,
  sharesApi,
  settingsApi,
  showToast
) {
  const yearStatus = await yearEndApi.getStatus();
  const state = {
    source: null,
    fiscalYear: Number(yearStatus.activeFiscalYear || new Date().getFullYear()),
    transactionType: 'Πίστωση',
    movedCards: []
  };

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΕΛΕΓΧΟΣ ΥΛΙΚΩΝ</p>
        <h2>Εργασίες Οικονομικού Έτους</h2>
      </div>
    </section>

    <section class="transaction-flow-home financial-year-menu" data-financial-menu aria-label="Επιλογή εργασίας οικονομικού έτους">
      <button class="home-tile transaction-flow-tile" data-financial-source="addy" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΑΔ</span>
        <span class="home-tile-title">Έλεγχος Κινήσεων ΑΔΔΥ</span>
        <span class="home-tile-code">§ ΕΟΕ-1</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-financial-source="exhp" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΕΧ</span>
        <span class="home-tile-title">Έλεγχος Κινήσεων ΕΧΠ</span>
        <span class="home-tile-code">§ ΕΟΕ-2</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-financial-source="renumber" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΑΡ</span>
        <span class="home-tile-title">Αλλαγή Αρίθμησης Μερίδων</span>
        <span class="home-tile-code">§ ΕΟΕ-3</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-financial-source="archive" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΑΜ</span>
        <span class="home-tile-title">Αρχείο Μερίδων</span>
        <span class="home-tile-code">§ ΕΟΕ-4</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-financial-source="prints" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΕΚ</span>
        <span class="home-tile-title">Εκτυπώσεις</span>
        <span class="home-tile-code">§ ΕΟΕ-5</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-financial-source="close-year" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΚΕ</span>
        <span class="home-tile-title">Κλείσιμο Οικονομικού Έτους</span>
        <span class="home-tile-code">§ ΕΟΕ-6</span>
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
            <select data-financial-year>${renderFiscalYearOptions(state.fiscalYear)}</select>
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
            <select data-renumber-year>${renderFiscalYearOptions(state.fiscalYear)}</select>
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

    <div data-archive-detail hidden>
      <div class="page-toolbar no-print"><button class="secondary-button" data-archive-back type="button">Πίσω στις Εργασίες Οικονομικού Έτους</button></div>
      <div data-archive-content><p class="muted">Φόρτωση αρχείου μερίδων...</p></div>
    </div>

    <div data-year-prints-detail hidden>
      <div class="page-toolbar no-print">
        <button class="secondary-button" data-year-prints-back type="button">Πίσω στις Εργασίες Οικονομικού Έτους</button>
      </div>
      <section class="page-panel">
        <div class="section-heading annual-prints-heading">
          <div>
            <h3>Εκτυπώσεις Μερίδων Οικονομικού Έτους</h3>
            <p class="muted">Εμφανίζονται μόνο οι Μερίδες που έχουν κίνηση στο επιλεγμένο έτος. Για Μερίδες με σύνθεση περιλαμβάνεται και το Φύλλο Μεταβολών.</p>
          </div>
          <label class="field compact-field">
            <span>Οικονομικό Έτος</span>
            <select data-year-prints-year>${renderFiscalYearOptions(state.fiscalYear)}</select>
          </label>
        </div>
        <div data-year-prints-results><p class="muted">Φόρτωση Μερίδων...</p></div>
        <div class="form-actions annual-prints-actions no-print">
          <button class="secondary-button" data-year-prints-toggle type="button">Αποεπιλογή Όλων</button>
          <button class="primary-button" data-year-prints-open type="button" disabled>Προεπισκόπηση / Εκτύπωση</button>
        </div>
      </section>
    </div>

    <div data-close-year-detail hidden>
      <div class="page-toolbar no-print">
        <button class="secondary-button" data-close-year-back type="button">Πίσω στις Εργασίες Οικονομικού Έτους</button>
      </div>
      <section class="page-panel fiscal-year-close-panel">
        <p class="eyebrow">ΕΟΕ-6</p>
        <h3>Κλείσιμο Οικονομικού Έτους</h3>
        <p class="muted">Το ενεργό οικονομικό έτος είναι το <strong>${escapeHtml(state.fiscalYear)}</strong>. Με το κλείσιμο δημιουργείται κλειδωμένο αρχείο και το επόμενο έτος γίνεται ενεργό.</p>
        <div class="fiscal-year-close-warning">
          Η ενέργεια αυτή είναι μη αναστρέψιμη και θα πρέπει να εκτελεστεί μετά την παράδοση του οικονομικού έτους στο Ε.Υ.Σ.
        </div>
        <label class="field compact-field">
          <span>Οικονομικό Έτος προς Κλείσιμο</span>
          <input data-close-year-value type="text" value="${escapeHtml(state.fiscalYear)}" readonly />
        </label>
        <div class="form-actions">
          <button class="danger-button" data-close-year-accept type="button">Κλείσιμο Οικονομικού Έτους</button>
        </div>
        ${yearStatus.closures.length ? `
          <div class="table-wrap fiscal-year-closures-table">
            <table>
              <thead><tr><th>Κλεισμένο Έτος</th><th>Επόμενο Έτος</th><th>Ημερομηνία Κλεισίματος</th></tr></thead>
              <tbody>${yearStatus.closures.map((closure) => `
                <tr><td>${closure.fiscalYear}</td><td>${closure.nextFiscalYear}</td><td>${escapeHtml(closure.closedAt)}</td></tr>
              `).join('')}</tbody>
            </table>
          </div>
        ` : ''}
      </section>
    </div>
  `;

  const menu = container.querySelector('[data-financial-menu]');
  const detail = container.querySelector('[data-financial-detail]');
  const results = container.querySelector('[data-financial-results]');
  const renumberDetail = container.querySelector('[data-renumber-detail]');
  const renumberResults = container.querySelector('[data-renumber-results]');
  const renumberMessage = container.querySelector('[data-renumber-message]');
  const archiveDetail = container.querySelector('[data-archive-detail]');
  const archiveContent = container.querySelector('[data-archive-content]');
  const yearPrintsDetail = container.querySelector('[data-year-prints-detail]');
  const yearPrintsResults = container.querySelector('[data-year-prints-results]');
  const closeYearDetail = container.querySelector('[data-close-year-detail]');

  function showMenu() {
    state.source = null;
    detail.hidden = true;
    renumberDetail.hidden = true;
    archiveDetail.hidden = true;
    yearPrintsDetail.hidden = true;
    closeYearDetail.hidden = true;
    menu.classList.remove('is-hidden');
    menu.hidden = false;
  }

  async function loadYearPrints() {
    yearPrintsResults.innerHTML = '<p class="muted">Φόρτωση Μερίδων...</p>';
    try {
      state.movedCards = sortMovedShareCards(await sharesApi.listMovedCards(state.fiscalYear));
      yearPrintsResults.innerHTML = renderMovedShareCardsTable(state.movedCards);
      updateYearPrintButtons();
    } catch (error) {
      state.movedCards = [];
      yearPrintsResults.innerHTML = '<p class="muted">Δεν ήταν δυνατή η φόρτωση των Μερίδων.</p>';
      updateYearPrintButtons();
      showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση των Μερίδων.', 'error');
    }
  }

  function updateYearPrintButtons() {
    const checkboxes = [...yearPrintsResults.querySelectorAll('[data-year-print-card]')];
    const selectedCount = checkboxes.filter((checkbox) => checkbox.checked).length;
    container.querySelector('[data-year-prints-open]').disabled = selectedCount === 0;
    container.querySelector('[data-year-prints-toggle]').textContent =
      checkboxes.length && selectedCount === checkboxes.length ? 'Αποεπιλογή Όλων' : 'Επιλογή Όλων';
  }

  async function loadArchive() {
    archiveContent.innerHTML = '<p class="muted">Φόρτωση αρχείου μερίδων...</p>';
    try {
      archiveContent.innerHTML = renderArchivePanel(await administrationApi.getReferenceData());
    } catch (error) {
      archiveContent.innerHTML = '<p class="muted">Δεν ήταν δυνατή η φόρτωση του αρχείου μερίδων.</p>';
      showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση του αρχείου μερίδων.', 'error');
    }
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
      } else if (state.source === 'archive') {
        archiveDetail.hidden = false;
        void loadArchive();
      } else if (state.source === 'prints') {
        yearPrintsDetail.hidden = false;
        void loadYearPrints();
      } else if (state.source === 'close-year') {
        closeYearDetail.hidden = false;
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
  container.querySelector('[data-archive-back]').addEventListener('click', showMenu);
  container.querySelector('[data-year-prints-back]').addEventListener('click', showMenu);
  container.querySelector('[data-close-year-back]').addEventListener('click', showMenu);
  container.querySelector('[data-close-year-accept]').addEventListener('click', async () => {
    const accepted = await confirmFiscalYearClosure(state.fiscalYear);
    if (!accepted) return;
    try {
      const result = await yearEndApi.closeFiscalYear(state.fiscalYear);
      showToast(result.message, 'success');
      await renderFinancialYearTasksPage(
        container,
        transactionsApi,
        yearEndApi,
        administrationApi,
        sharesApi,
        settingsApi,
        showToast
      );
    } catch (error) {
      showToast(error.message || 'Το κλείσιμο του οικονομικού έτους απέτυχε.', 'error');
    }
  });
  container.querySelector('[data-year-prints-year]').addEventListener('change', (event) => {
    state.fiscalYear = Number(event.target.value) || new Date().getFullYear();
    void loadYearPrints();
  });
  yearPrintsResults.addEventListener('change', (event) => {
    if (event.target.matches('[data-year-print-card]')) updateYearPrintButtons();
  });
  container.querySelector('[data-year-prints-toggle]').addEventListener('click', () => {
    const checkboxes = [...yearPrintsResults.querySelectorAll('[data-year-print-card]')];
    const shouldSelect = checkboxes.some((checkbox) => !checkbox.checked);
    checkboxes.forEach((checkbox) => {
      checkbox.checked = shouldSelect;
    });
    updateYearPrintButtons();
  });
  container.querySelector('[data-year-prints-open]').addEventListener('click', async () => {
    try {
      const selectedIds = new Set(
        [...yearPrintsResults.querySelectorAll('[data-year-print-card]:checked')]
          .map((checkbox) => Number(checkbox.dataset.yearPrintCard))
      );
      const selectedCards = state.movedCards.filter((card) => selectedIds.has(Number(card.share.id)));
      if (!selectedCards.length) throw new Error('Επιλέξτε τουλάχιστον μία Μερίδα.');
      const settings = await settingsApi.get();
      openAnnualSharePrintPreview(selectedCards, settings, state.fiscalYear, showToast);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η προεπισκόπηση.', 'error');
    }
  });
  archiveDetail.addEventListener('click', async (event) => {
    const submit = event.target.closest('#archive-submit');
    const restore = event.target.closest('[data-restore-share]');
    const print = event.target.closest('[data-print-archive-table]');
    try {
      if (submit) {
        const selected = [...archiveContent.querySelectorAll('[data-archive-share]:checked')];
        if (!selected.length) throw new Error('Επιλέξτε τουλάχιστον μία Μερίδα για αρχειοθέτηση.');
        for (const checkbox of selected) {
          await administrationApi.archiveShare({
            shareId: Number(checkbox.dataset.archiveShare),
            actionDate: archiveContent.querySelector('#archive-date').value,
            reason: archiveContent.querySelector('#archive-reason').value
          });
        }
        showToast(`${selected.length} ${selected.length === 1 ? 'Μερίδα μεταφέρθηκε' : 'Μερίδες μεταφέρθηκαν'} στο αρχείο.`);
        await loadArchive();
      } else if (restore) {
        const data = await administrationApi.getReferenceData();
        const result = await administrationApi.restoreShare(Number(restore.dataset.restoreShare), data.today);
        showToast(result.message);
        await loadArchive();
      } else if (print) {
        await printArchivedSharesTable(archiveContent.querySelector('[data-archived-shares-table]'));
      }
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια αρχείου.', 'error');
    }
  });
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

function confirmFiscalYearClosure(fiscalYear) {
  return new Promise((resolve) => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop fiscal-year-close-backdrop';
    backdrop.innerHTML = `
      <section class="window-options-modal fiscal-year-close-modal" role="dialog" aria-modal="true">
        <p class="eyebrow">ΚΛΕΙΣΙΜΟ ${escapeHtml(fiscalYear)}</p>
        <h2>Μη αναστρέψιμη ενέργεια</h2>
        <p>Η ενέργεια αυτή είναι μη αναστρέψιμη και θα πρέπει να εκτελεστεί μετά την παράδοση του οικονομικού Έτους στο Ε.Υ.Σ.</p>
        <p><strong>Αποδοχή ή Ακύρωση;</strong></p>
        <div class="row-actions">
          <button class="secondary-button" data-cancel-year-close type="button">Ακύρωση</button>
          <button class="danger-button" data-accept-year-close type="button">Αποδοχή</button>
        </div>
      </section>
    `;
    const finish = (result) => {
      backdrop.remove();
      resolve(result);
    };
    backdrop.addEventListener('click', (event) => {
      if (event.target === backdrop || event.target.closest('[data-cancel-year-close]')) finish(false);
      if (event.target.closest('[data-accept-year-close]')) finish(true);
    });
    document.body.appendChild(backdrop);
    backdrop.querySelector('[data-cancel-year-close]').focus();
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

export function renderMovedShareCardsTable(cards) {
  const sortedCards = sortMovedShareCards(cards);
  const body = sortedCards.length
    ? sortedCards.map((card, index) => {
        const includesChangeSheet = card.compositionItems.length > 0;
        return `
          <tr>
            <td><input data-year-print-card="${escapeHtml(card.share.id)}" type="checkbox" checked aria-label="Επιλογή Μερίδας ${escapeHtml(card.share.shareNumber)}" /></td>
            <td>${index + 1}</td>
            <td>${escapeHtml(card.share.shareNumber)}</td>
            <td>${escapeHtml(card.share.nominalNumber)}</td>
            <td class="material-description-cell">${escapeHtml(card.share.description)}</td>
            <td>${card.transactions.length}</td>
            <td>${includesChangeSheet ? 'Καρτέλα και Φύλλο Μεταβολών' : 'Καρτέλα'}</td>
          </tr>`;
      }).join('')
    : '<tr><td colspan="7" class="empty-table">Δεν υπάρχουν Μερίδες με κίνηση στο επιλεγμένο οικονομικό έτος.</td></tr>';
  return `
    <div class="table-wrap annual-share-prints-table-wrap">
      <table class="index-table administration-table annual-share-prints-table">
        <thead><tr><th>Επιλογή</th><th>Α/Α</th><th>Αριθμός Μερίδας</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Κινήσεις</th><th>Έντυπα</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
    </div>`;
}

function openAnnualSharePrintPreview(cards, settings, fiscalYear, showToast) {
  document.querySelector('.annual-share-print-backdrop')?.remove();
  const sortedCards = sortMovedShareCards(cards);
  const manager = splitOfficerSignature(settings?.financialOfficers?.manager || '');
  const cardDocumentsHtml = sortedCards.map((card) => renderSharePrintDocument(card, {
    exactCopy: 'Ακριβές Αντίγραφο',
    issuerName: manager.name,
    issuerRank: manager.rank
  })).join('');
  const changeSheetDocumentsHtml = sortedCards
    .filter((card) => card.compositionItems.length)
    .map((card) => renderChangeSheetDocument(card))
    .join('');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop annual-share-print-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal annual-share-print-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΟΙΚΟΝΟΜΙΚΟ ΕΤΟΣ ${escapeHtml(fiscalYear)}</p>
          <h2>Μερίδες με Κίνηση${settings?.serviceInfo?.serviceName ? ` · ${escapeHtml(settings.serviceInfo.serviceName)}` : ''}</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-annual-share-print type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-annual-share-documents type="button">Εκτύπωση Όλων</button>
        </div>
      </header>
      <div class="request-document-preview annual-share-print-preview">
        <div data-annual-card-pages>${cardDocumentsHtml}</div>
        ${changeSheetDocumentsHtml
          ? `<div data-annual-change-sheet-pages>${changeSheetDocumentsHtml}</div>`
          : ''}
      </div>
    </div>`;

  backdrop.addEventListener('click', async (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-annual-share-print]')) {
      backdrop.remove();
      return;
    }
    if (!event.target.closest('[data-print-annual-share-documents]')) return;
    const printButton = backdrop.querySelector('[data-print-annual-share-documents]');
    printButton.disabled = true;
    try {
      const cardsResult = await printAnnualDocumentGroup(
        backdrop.querySelector('[data-annual-card-pages]').innerHTML,
        false,
        `Μερίδες με Κίνηση ${fiscalYear}`
      );
      if (cardsResult?.printed === false) {
        throw new Error(cardsResult.failureReason || 'Η εκτύπωση των καρτελών ακυρώθηκε.');
      }
      const changeSheetPages = backdrop.querySelector('[data-annual-change-sheet-pages]');
      if (changeSheetPages) {
        const sheetsResult = await printAnnualDocumentGroup(
          changeSheetPages.innerHTML,
          true,
          `Φύλλα Μεταβολών ${fiscalYear}`
        );
        if (sheetsResult?.printed === false) {
          throw new Error(sheetsResult.failureReason || 'Η εκτύπωση των Φύλλων Μεταβολών ακυρώθηκε.');
        }
      }
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η εκτύπωση.', 'error');
    } finally {
      printButton.disabled = false;
    }
  });
  document.body.appendChild(backdrop);
}

export function sortMovedShareCards(cards) {
  return [...(cards || [])].sort((left, right) =>
    String(left?.share?.shareNumber || '').localeCompare(
      String(right?.share?.shareNumber || ''),
      'el',
      { numeric: true, sensitivity: 'base' }
    )
  );
}

async function printAnnualDocumentGroup(html, landscape, title) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = `
    <style>
      @page {
        size: ${landscape ? '297mm 210mm' : '210mm 297mm'} !important;
        margin: 0 !important;
      }
      .isolated-print-root > .print-document-area {
        page: auto !important;
      }
    </style>
    ${html}
  `;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await waitForPrintLayout();
    return await window.appApi.print.currentDocument({ landscape, title });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
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
