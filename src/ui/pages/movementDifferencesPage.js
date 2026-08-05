import { escapeHtml, renderFiscalYearOptions } from '../components/forms.js';

export async function renderMovementDifferencesPage(container, api, showToast) {
  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΔΙΑΦΟΡΕΣ</p>
        <h2>Διαφορές από Διακίνηση Υλικού</h2>
      </div>
    </section>

    <section class="print-index-tile-menu" aria-label="Διαφορές από Διακίνηση Υλικού">
      <div class="home-group corner print-tile-group">
        <div class="home-group-header">
          <p class="home-group-label">Διαφορές από Διακίνηση Υλικού</p>
          <span class="home-zone-tag">§ ΔΥ</span>
        </div>
        <div class="home-tile-grid print-tile-grid uniform-task-menu">
          <button class="home-tile panel corner" data-md-open-protocols type="button">
            <span class="home-tile-icon" aria-hidden="true">ΠΔ</span>
            <span class="home-tile-title">Πρωτόκολλα Διαφορών από Διακίνηση Υλικού</span>
            <span class="home-tile-code">§ ΔΥ-Α</span>
          </button>
          <button class="home-tile panel corner" data-md-open-indexes type="button">
            <span class="home-tile-icon" aria-hidden="true">ΕΔ</span>
            <span class="home-tile-title">Ευρετήρια Πρωτοκόλλων Διαφορών από Διακίνηση Υλικού</span>
            <span class="home-tile-code">§ ΔΥ-Β</span>
          </button>
        </div>
      </div>
    </section>
  `;

  container.querySelector('[data-md-open-protocols]').addEventListener('click', () => {
    void renderMovementDifferenceProtocolsPage(container, api, showToast);
  });
  container.querySelector('[data-md-open-indexes]').addEventListener('click', () => {
    document.dispatchEvent(new CustomEvent('diaxeirisi:navigate', {
      detail: { sectionId: 'movement-difference-indexes' }
    }));
  });
}

async function renderMovementDifferenceProtocolsPage(container, api, showToast) {
  if (typeof container.__movementDifferencesPageCleanup === 'function') {
    container.__movementDifferencesPageCleanup();
  }
  const currentYear = new Date().getFullYear();
  const [referenceData, protocols] = await Promise.all([
    api.getReferenceData(),
    api.list(currentYear)
  ]);

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΕΦΕΔ 104</p>
        <h2>Πρωτόκολλα Διαφορών από Διακίνηση Υλικού</h2>
      </div>
      <button class="secondary-button" data-md-back-to-tiles type="button">Πίσω στις Διαφορές</button>
    </section>

    <section class="page-panel">
      <h3>Νέο Πρωτόκολλο</h3>
      <div class="movement-difference-grid">
        <label class="field"><span>Ημερομηνία Πρωτοκόλλου</span><input id="md-date" type="date" value="${referenceData.today}" /></label>
        <label class="field">
          <span>Σχετικό ΑΔΔΥ</span>
          <select id="md-addy">
            <option value="">Χωρίς συσχέτιση</option>
            ${referenceData.addyDocuments.map((doc) => `<option value="${doc.id}">ΑΔΔΥ ${doc.id} · ${formatDate(doc.documentDate)} · ${escapeHtml(doc.transactionUnit)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Συναλλασσόμενη Μονάδα</span><input id="md-unit" /></label>
        <label class="field">
          <span>Κατεύθυνση</span>
          <select id="md-direction"><option value="">Επιλογή</option><option>Παραλαβή</option><option>Αποστολή</option></select>
        </label>
        <label class="field">
          <span>Αριθμός Μερίδας</span>
          <select id="md-share">
            <option value="">Επιλογή</option>
            ${referenceData.shares.map((share) => `<option value="${share.id}">${escapeHtml(share.shareNumber)}</option>`).join('')}
          </select>
        </label>
        <label class="field"><span>Αριθμός Ονομαστικού</span><input id="md-nominal" readonly /></label>
        <label class="field"><span>Περιγραφή</span><input id="md-description" readonly /></label>
        <label class="field"><span>Μονάδα Μέτρησης</span><input id="md-measurement" readonly /></label>
        <label class="field"><span>Ποσότητα Δικαιολογητικού</span><input id="md-document-quantity" type="number" min="0" step="0.001" /></label>
        <label class="field"><span>Πραγματική Ποσότητα</span><input id="md-actual-quantity" type="number" min="0" step="0.001" /></label>
        <label class="field"><span>Ημερομηνία Αποστολής</span><input id="md-dispatch-date" type="date" value="${referenceData.today}" /></label>
        <label class="field movement-difference-notes"><span>Παρατηρήσεις</span><input id="md-notes" /></label>
        <button id="md-create" class="primary-button" type="button">Καταχώριση</button>
      </div>
    </section>

    <section class="page-panel">
      <div class="requests-status-header">
        <h3>Πρωτόκολλα Διαφορών από Διακίνηση Υλικού</h3>
        <label class="field compact-year-field"><span>Οικονομικό Έτος</span><select id="md-year">${renderFiscalYearOptions(currentYear)}</select></label>
      </div>
      <div class="table-wrap">
        <table class="movement-differences-table">
          <thead>
            <tr>
              <th>Α/Α</th><th>Ημερομηνία</th><th>Μονάδα</th><th>Κατεύθυνση</th>
              <th>Μερίδα</th><th>Διαφορά</th><th>Ποσότητα</th><th>Προθεσμία</th>
              <th>Απάντηση</th><th>Τακτοποίηση</th><th></th>
            </tr>
          </thead>
          <tbody id="md-body">${renderProtocolRows(protocols)}</tbody>
        </table>
      </div>
    </section>
  `;

  container.__movementDifferencesPageCleanup = bindPage(container, api, referenceData, showToast, () =>
    renderMovementDifferenceProtocolsPage(container, api, showToast)
  );
}

function bindPage(container, api, referenceData, showToast, rerender) {
  container.querySelector('[data-md-back-to-tiles]').addEventListener('click', () => {
    void renderMovementDifferencesPage(container, api, showToast);
  });

  const shareSelect = container.querySelector('#md-share');
  shareSelect.addEventListener('change', () => {
    const share = referenceData.shares.find((item) => item.id === Number(shareSelect.value));
    container.querySelector('#md-nominal').value = share?.nominalNumber || '';
    container.querySelector('#md-description').value = share?.description || '';
    container.querySelector('#md-measurement').value = share?.measurementUnit || '';
  });

  const addySelect = container.querySelector('#md-addy');
  addySelect.addEventListener('change', () => {
    const document = referenceData.addyDocuments.find((item) => item.id === Number(addySelect.value));
    if (document) container.querySelector('#md-unit').value = document.transactionUnit;
  });

  container.querySelector('#md-create').addEventListener('click', async () => {
    try {
      const result = await api.create({
        protocolDate: container.querySelector('#md-date').value,
        addyDocumentId: Number(addySelect.value) || null,
        counterpartyUnit: container.querySelector('#md-unit').value,
        movementDirection: container.querySelector('#md-direction').value,
        shareId: Number(shareSelect.value),
        documentQuantity: container.querySelector('#md-document-quantity').value,
        actualQuantity: container.querySelector('#md-actual-quantity').value,
        dispatchDate: container.querySelector('#md-dispatch-date').value,
        notes: container.querySelector('#md-notes').value
      });
      showToast(result.message);
      await rerender();
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η καταχώριση.', 'error');
    }
  });

  container.querySelector('#md-year').addEventListener('change', async (event) => {
    try {
      const protocols = await api.list(Number(event.target.value));
      container.querySelector('#md-body').innerHTML = renderProtocolRows(protocols);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση.', 'error');
    }
  });

  const movementDifferencesClickHandler = async (event) => {
    const response = event.target.closest('[data-md-response]');
    const settle = event.target.closest('[data-md-settle]');
    const escalate = event.target.closest('[data-md-escalate]');
    const view = event.target.closest('[data-md-view]');
    const row = event.target.closest('tr');
    try {
      if (view) {
        openProtocolDocument(await api.get(Number(view.dataset.mdView)));
        return;
      } else if (response) {
        await api.recordResponse(Number(response.dataset.mdResponse), {
          responseDate: row.querySelector('[data-md-response-date]').value,
          responseStatus: row.querySelector('[data-md-response-status]').value,
          responseNotes: ''
        });
        showToast('Η απάντηση καταχωρίστηκε.');
      } else if (settle) {
        await api.settle(Number(settle.dataset.mdSettle), {
          settlementDate: referenceData.today,
          settlementReference: row.querySelector('[data-md-settlement-reference]').value
        });
        showToast('Η τελική τακτοποίηση καταχωρίστηκε.');
      } else if (escalate) {
        await api.escalate(Number(escalate.dataset.mdEscalate), referenceData.today);
        showToast('Καταχωρίστηκε η αποστολή στην Προϊστάμενη Αρχή.');
      } else {
        return;
      }
      await rerender();
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
    }
  };
  container.addEventListener('click', movementDifferencesClickHandler);

  return () => {
    container.removeEventListener('click', movementDifferencesClickHandler);
  };
}

function renderProtocolRows(protocols) {
  if (!protocols.length) return '<tr><td colspan="11" class="empty-table">Δεν υπάρχουν πρωτόκολλα διαφορών.</td></tr>';
  return protocols.map((item) => `
    <tr>
      <td>${item.registryNumber}/${item.fiscalYear}</td>
      <td>${formatDate(item.protocolDate)}</td>
      <td>${escapeHtml(item.counterpartyUnit)}</td>
      <td>${escapeHtml(item.movementDirection)}</td>
      <td>${escapeHtml(item.shareNumber)}</td>
      <td class="${item.differenceType === 'Πλεόνασμα' ? 'surplus' : 'deficit'}">${escapeHtml(item.differenceType)}</td>
      <td>${formatQuantity(item.differenceQuantity)} ${escapeHtml(item.measurementUnit)}</td>
      <td class="${item.overdue ? 'deficit' : ''}">${formatDate(item.responseDueDate)}</td>
      <td>
        ${item.responseDate ? `${escapeHtml(item.responseStatus)}<br>${formatDate(item.responseDate)}` : `
          <div class="compact-action-grid">
            <input data-md-response-date type="date" />
            <select data-md-response-status><option value="">Επιλογή</option><option>Έγινε δεκτή</option><option>Δεν έγινε δεκτή</option></select>
            <button class="secondary-button" data-md-response="${item.id}" type="button">Καταχώριση</button>
          </div>
        `}
      </td>
      <td>${escapeHtml(item.settlementStatus)}${item.settlementReference ? `<br>${escapeHtml(item.settlementReference)}` : ''}</td>
      <td>
        <button class="secondary-button" data-md-view="${item.id}" type="button">Προβολή</button>
        ${item.settlementStatus === 'Τακτοποιήθηκε' ? '' : `
          <div class="compact-action-grid">
            <input data-md-settlement-reference placeholder="ΕΧΠ / Διαταγή" />
            <button class="primary-button" data-md-settle="${item.id}" type="button">Τακτοποίηση</button>
            ${item.responseStatus === 'Δεν έγινε δεκτή' ? `<button class="secondary-button" data-md-escalate="${item.id}" type="button">Προϊστάμενη Αρχή</button>` : ''}
          </div>
        `}
      </td>
    </tr>
  `).join('');
}

function openProtocolDocument(protocol) {
  const existing = document.querySelector('.movement-protocol-backdrop');
  if (existing) existing.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop movement-protocol-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΕΦΕΔ 104</p>
          <h2>Πρωτόκολλο Διαφορών από Διακίνηση Υλικού</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-md-document type="button">Κλείσιμο</button>
          <button class="primary-button compact-print-button" data-print-md-document type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="request-document-preview">${renderProtocolDocument(protocol)}</div>
    </div>
  `;

  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-md-document]')) {
      backdrop.remove();
    } else if (event.target.closest('[data-print-md-document]')) {
      void printProtocolDocument(backdrop);
    }
  });
  document.body.appendChild(backdrop);
}

export function renderProtocolDocument(protocol) {
  const issuingUnit = protocol.movementDirection === 'Αποστολή'
    ? protocol.serviceName
    : protocol.counterpartyUnit;
  const receivingUnit = protocol.movementDirection === 'Αποστολή'
    ? protocol.counterpartyUnit
    : protocol.serviceName;
  const isSurplus = protocol.differenceType === 'Πλεόνασμα';
  const isDeficit = protocol.differenceType === 'Έλλειμμα';
  return `
    <article class="official-movement-protocol-page print-document-area">
      <div class="official-protocol-page-number">-214-</div>
      <div class="official-protocol-side-label">(Εμπρός Πλευρά)</div>
      <div class="official-protocol-code"><strong>Κ 2303/ΔΥΠ</strong><span>ΕΦΕΔ 104</span></div>
      <header class="official-protocol-heading">
        <h1>ΠΡΩΤΟΚΟΛΛΟ</h1>
        <h2>ΔΙΑΦΟΡΩΝ ΑΠΟ ΔΙΑΚΙΝΗΣΗ ΥΛΙΚΟΥ</h2>
      </header>
      <div class="official-protocol-register">
        <span><strong>1. Α/Α</strong> ${escapeHtml(protocol.registryNumber)}</span>
        <span><strong>2. ΑΡΙΘ. ΕΥΡΕΤ.</strong> ${escapeHtml(protocol.registryNumber)}/${escapeHtml(protocol.fiscalYear)}</span>
        <span><strong>3. ΗΜΕΡΟΜΗΝΙΑ</strong> ${formatDate(protocol.protocolDate)}</span>
      </div>
      <table class="official-protocol-meta-table">
        <tbody>
          <tr><td><strong>4. ΜΟΝΑΔΑ ΧΟΡΗΓΗΣΗΣ:</strong><span>${escapeHtml(issuingUnit)}</span></td><td><strong>5. ΜΟΝΑΔΑ ΠΑΡΑΛΑΒΗΣ:</strong><span>${escapeHtml(receivingUnit)}</span></td></tr>
          <tr><td><strong>6. ΑΡΙΘ. - ΗΜΕΡ. ΔΙΚ/ΚΟΥ ΧΟΡΗΓ.</strong><span>${protocol.addyDocumentId ? `ΑΔΔΥ ${escapeHtml(protocol.addyDocumentId)}` : ''}</span></td><td><strong>9. ΑΡΙΘ. - ΗΜΕΡ. ΔΕΛΤΙΟΥ ΣΥΝΟΔΕΙΑΣ</strong><span></span></td></tr>
          <tr><td><strong>7. ΑΡΙΘ. ΦΟΡΤΩΤΙΚΗΣ</strong><span></span></td><td rowspan="2"></td></tr>
          <tr><td><strong>8. ΜΕΣΟ ΜΕΤΑΦΟΡΑΣ</strong><span></span></td></tr>
        </tbody>
      </table>
      <table class="official-protocol-material-table">
        <thead>
          <tr>
            <th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th>ΠΕΡΙΓΡΑΦΗ</th>
            <th class="vertical-table-heading">ΜΟΝΑΔΑ ΜΕΤΡΗΣΗΣ</th>
            <th class="vertical-table-heading">ΧΟΡΗΓΗΘΕΙΣΑ</th>
            <th class="vertical-table-heading">ΠΑΡΑΛΗΦΘΕΙΣΑ</th>
            <th class="vertical-table-heading">ΠΛΕΟΝΑΣΜΑ</th>
            <th class="vertical-table-heading">ΕΛΛΕΙΜΜΑ</th>
            <th class="vertical-table-heading">Α/Α ΔΙΑΦΟΡΑΣ ΣΕ €</th>
          </tr>
          <tr class="official-protocol-field-numbers">${[10, 11, 12, 13, 14, 15, 16, 17, 18].map((number) => `<td>${number}</td>`).join('')}</tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td><td>${escapeHtml(protocol.nominalNumber)}</td>
            <td class="official-protocol-description">${escapeHtml(protocol.description)}</td>
            <td>${escapeHtml(protocol.measurementUnit)}</td>
            <td>${formatQuantity(protocol.documentQuantity)}</td>
            <td>${formatQuantity(protocol.actualQuantity)}</td>
            <td>${isSurplus ? formatQuantity(protocol.differenceQuantity) : ''}</td>
            <td>${isDeficit ? formatQuantity(protocol.differenceQuantity) : ''}</td><td></td>
          </tr>
          ${Array.from({ length: 13 }, () => `<tr>${'<td></td>'.repeat(9)}</tr>`).join('')}
        </tbody>
      </table>
      <div class="official-protocol-notes"><strong>19. ΠΑΡΑΤΗΡΗΣΕΙΣ</strong><span>${escapeHtml(protocol.notes)}</span></div>
      <div class="official-protocol-acceptance">
        <div><strong>20. ΜΟΝΑΔΑ ΧΟΡΗΓΗΣΗΣ</strong><span>ΠΑΡΑΔΕΚΤΟ Ή ΑΠΑΡΑΔΕΚΤΟ</span></div>
        <div><strong>21. ΜΟΝΑΔΑ ΠΑΡΑΛΑΒΗΣ</strong><span>Η ΕΠΙΤΡΟΠΗ ΑΠΟΣΥΣΚΕΥΑΣΙΑΣ &nbsp;&nbsp; Ο ΣΥΝΟΔΟΣ &nbsp;&nbsp; Ο ΔΙΑΧΕΙΡΙΣΤΗΣ &nbsp;&nbsp; Ο ΠΕΔ</span></div>
      </div>
      <div class="official-protocol-footer-fields">
        <div><strong>22. ΣΤΟΙΧΕΙΑ ΧΡΕΩΣΕΩΣ</strong></div>
        <div><strong>23. ΕΓΚΡΙΣΗ</strong><span>ΑΡΙΘ. ΗΜΕΡ. &nbsp;&nbsp;&nbsp;&nbsp; ΣΦΡΑΓΙΔΑ - ΥΠΟΓΡΑΦΗ</span></div>
      </div>
      <div class="official-protocol-side-label official-protocol-back-label">(Πίσω Πλευρά)</div>
    </article>
    <article class="official-movement-protocol-page official-movement-protocol-back print-document-area">
      <div class="official-protocol-page-number">-215-</div>
      <div class="official-protocol-code"><strong>Κ 2303/ΔΥΠ</strong><span>ΕΦΕΔ 104</span></div>
      <h1>ΓΝΩΜΑΤΕΥΣΗ ΠΑΡΑΛΗΠΤΗ</h1>
      <div class="official-protocol-opinion">
        <p>Καθορισμός:</p>
        <p>α. Διακριτικά δεμάτων που παρουσιάζουν διαφορές....................................................................</p>
        <p>β. Δέματα άθικτο/α................ Δέμα/τα παραβιασμένο/α............................................................</p>
        <p>γ. Αν το περιεχόμενο του παραβιασμένου δέματος ελέγχθηκε παρουσία του συνοδού<br>ή του αντιπροσώπου του μεταφορέα και ποια τα στοιχεία αυτού...................................................</p>
        <p>δ. Αριθμός βαγονιού ή σφραγίδας, αν υπάρχει........................................................................</p>
        <p>ε. Όνομα πλοίου - αν υπάρχει - και αν έχει καταχωρηθεί στο πίσω μέρος της φορτωτικής<br>το έλλειμμα........................................................................ ΝΑΙ □ &nbsp;&nbsp;&nbsp; ΟΧΙ □</p>
        <p>στ. Εάν πρέπει το έλλειμμα να θεωρηθεί ότι οφείλεται σε:<br>Απώλεια ΝΑΙ □ &nbsp; ΟΧΙ □ &nbsp;&nbsp; Καταστροφή από μεταφορά: ΝΑΙ □ &nbsp; ΟΧΙ □<br>Λάθος κατά τη συσκευασία: ΝΑΙ □ &nbsp; ΟΧΙ □</p>
        <p>ζ. Βάρος κιβωτίου όπως αναγράφεται στο δικαιολογητικό.........................................................</p>
        <p>η. Βάρος όπως βρέθηκε από την επιτροπή αποσυσκευασίας.......................................................</p>
        <p>θ. Αν βρέθηκε Δελτίο Συσκευασίας ή Πρωτόκολλο Επιτροπής και ποια τα στοιχεία των<br>συσκευαστών ή της Επιτροπής............................................................................................</p>
        <p>ι. Οποιαδήποτε άλλη σχετική πληροφορία................................................................................<br>${escapeHtml(protocol.notes)}</p>
        <p>ια. Είναι απαραίτητη η αντικατάσταση των ελλειπόντων ΝΑΙ □ &nbsp;&nbsp;&nbsp; ΟΧΙ □<br>Δικαιολόγηση.....................................................................................................................</p>
      </div>
    </article>
  `;
}

async function printProtocolDocument(backdrop) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = [...backdrop.querySelectorAll('.official-movement-protocol-page')]
    .map((page) => page.outerHTML)
    .join('');
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({ landscape: false });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

function formatQuantity(value) {
  return Number(value).toLocaleString('el-GR', { maximumFractionDigits: 3, useGrouping: false });
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}
