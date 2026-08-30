import { escapeHtml, field } from '../components/forms.js';
import { listRequestPriorityOptionGroups } from '../requestPriorities.js';
import { splitOfficerSignature } from '../officerSignature.js';
import { renderRequestItemBarcode } from '../barcode/code128.js';
import {
  bindRequestSettings,
  renderNamedList,
  renderRequestCodeTable,
  renderRequestPriorityTable
} from './settingsPage.js';

const REQUEST_DRAFT_KEY = 'request-new-document';

export async function renderRequestsPage(container, requestsApi, settingsApi, showToast, activeTab = '') {
  if (typeof container.__requestsPageCleanup === 'function') container.__requestsPageCleanup();
  const [reference, settings] = await Promise.all([
    requestsApi.getReferenceData(),
    settingsApi.get()
  ]);
  let draftItems = [];
  try {
    const existingDraft = await window.appApi.drafts.get(REQUEST_DRAFT_KEY);
    draftItems = Array.isArray(existingDraft?.data?.items) ? existingDraft.data.items : [];
  } catch (error) {
    console.error('Αποτυχία επαναφοράς πρόχειρης αίτησης:', error);
  }
  const state = {
    items: draftItems,
    year: reference.year,
    requests: await requestsApi.list(reference.year),
    catalogueRequest: 0
  };
  const catalogueStatus = await requestsApi.getKeyCatalogueStatus();

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΑΙΤΗΣΕΙΣ</p>
        <h2>Αίτηση Μηχανογραφικώς Χορηγουμένων Υλικών</h2>
      </div>
    </section>

    <nav class="transaction-flow-home contextual-tile-menu requests-tile-menu" data-requests-menu aria-label="Ενότητες αιτήσεων">
      <button class="home-tile transaction-flow-tile" data-requests-tab="requests" type="button"><span class="home-tile-icon">ΑΙ</span><span class="home-tile-title">Αιτήσεις</span><span class="home-tile-code">§ ΑΙ-1</span></button>
      <button class="home-tile transaction-flow-tile" data-requests-tab="settings" type="button"><span class="home-tile-icon">ΡΥ</span><span class="home-tile-title">Ρυθμίσεις</span><span class="home-tile-code">§ ΑΙ-2</span></button>
    </nav>
    <div class="transaction-tab-panel" data-requests-panel="requests" hidden>
    <section class="page-panel request-panel no-print">
      <details class="key-catalogue-panel">
        <summary>Προαιρετική αναζήτηση στον Κατάλογο ΚΕΥ</summary>
        <div class="key-catalogue-controls">
          <button id="key-catalogue-choose" class="secondary-button" type="button">
            ${catalogueStatus.configured ? 'Αλλαγή φακέλου καταλόγου' : 'Επιλογή φακέλου καταλόγου'}
          </button>
          <label class="field key-catalogue-search-field">
            <span>Α/Ο, P/N ή περιγραφή</span>
            <input id="key-catalogue-search" autocomplete="off"
              ${catalogueStatus.configured ? '' : 'disabled'}
              placeholder="${catalogueStatus.configured ? 'Πληκτρολογήστε τουλάχιστον 2 χαρακτήρες' : 'Δεν έχει επιλεγεί κατάλογος'}" />
          </label>
        </div>
        <p id="key-catalogue-status" class="muted">
          ${catalogueStatus.configured
            ? 'Ο κατάλογος είναι διαθέσιμος ως προαιρετικό βοήθημα.'
            : 'Η χειροκίνητη καταχώρηση παραμένει διαθέσιμη χωρίς κατάλογο.'}
        </p>
        <div id="key-catalogue-results" class="key-catalogue-results" aria-live="polite"></div>
      </details>
      <div class="request-entry-all-row">
        <label class="field">
          <span>Ημερομηνία</span>
          <input id="request-date" type="date" value="${reference.today}" />
        </label>
        <label class="field">
          <span>Πρωτόκολλο</span>
          <input id="request-protocol" autocomplete="off" />
        </label>
        <label class="field">
          <span>Αιτούσα Μονάδα</span>
          <input id="request-unit" value="${escapeHtml(reference.requestingUnit || '')}" readonly />
        </label>
        <label class="field">
          <span>Χορηγούσα Μονάδα</span>
          <select id="request-issuing-unit">
            <option value="">Επιλογή</option>
            ${reference.issuingUnits.map((unit) => `<option value="${escapeHtml(unit.name)}">${escapeHtml(unit.name)}</option>`).join('')}
          </select>
        </label>
        ${input('Αριθμός Ονομαστικού', 'request-nominal')}
        ${input('Περιγραφή', 'request-description')}
        ${input('Ποσότητα', 'request-quantity', 'number')}
        ${selectMeasurement(reference.measurementUnits)}
        ${selectJustification(reference.justificationCodes)}
        ${selectPriority()}
        ${input('Παρατηρήσεις', 'request-notes')}
        <button id="request-add-item" class="primary-button" type="button" disabled>Προσθήκη</button>
      </div>
    </section>

    <section class="page-panel shares-panel no-print">
      <div class="shares-table-wrap request-items-wrap">
        <table class="shares-table request-items-table">
          <thead>
            <tr>
              <th>Α/Α</th>
              <th>Αριθμός Ονομαστικού</th>
              <th>Περιγραφή</th>
              <th class="number-cell">Ποσότητα</th>
              <th>ΜΜ</th>
              <th>Κωδ. Αιτ.</th>
              <th>Κωδ. Προτ.</th>
              <th>Παρατηρήσεις</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="request-items-body">${renderRequestItemRows(state.items)}</tbody>
        </table>
      </div>
      <div class="addy-save-row">
        <span id="request-limit-text" class="muted">0/10 καταχωρήσεις</span>
        <button id="request-save" class="primary-button" type="button" disabled>Αποθήκευση Αίτησης</button>
      </div>
    </section>

    <section class="page-panel no-print">
      <div class="requests-status-header">
        <h3>Κατάσταση Αιτήσεων</h3>
        <label class="field compact-year-field">
          <span>Έτος</span>
          <select id="requests-year">
            ${reference.years.map((year) => `<option value="${year}" ${year === state.year ? 'selected' : ''}>${year}</option>`).join('')}
          </select>
        </label>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Α/Α</th>
              <th>Φ.</th>
              <th>Ημερομηνία</th>
              <th>Περιγραφή</th>
              <th>Κατάσταση</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="requests-status-body">${renderRequestsStatusRows(state.requests)}</tbody>
        </table>
      </div>
    </section>
    </div>

    <div class="transaction-tab-panel" data-requests-panel="settings" hidden>
      <div class="settings-layout">
        <section class="page-panel wide-panel">
          <h3>Κωδικοί Αιτήσεων</h3>
          ${renderRequestCodeTable(settings.requestJustificationCodes)}
        </section>

        <section class="page-panel wide-panel priority-reference-panel">
          <h3>Προτεραιότητα Αιτήσεων</h3>
          ${renderRequestPriorityTable()}
        </section>

        <section class="page-panel">
          <h3>Μονάδες Χορήγησης Υλικών</h3>
          ${renderNamedList('request-issuing-unit', settings.requestIssuingUnits)}
          <form id="request-issuing-unit-form" class="inline-form compact-form">
            ${field('Νέα μονάδα χορήγησης', 'name')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>
      </div>
    </div>
  `;

  bindRequestsTabs(container, activeTab);
  container.__requestsPageCleanup = bindRequestsPage(
    container,
    requestsApi,
    settingsApi,
    reference,
    state,
    showToast
  );
  bindRequestSettings(
    container,
    settingsApi,
    showToast,
    () => renderRequestsPage(container, requestsApi, settingsApi, showToast, 'settings')
  );
}

function bindRequestsTabs(container, initialTab = '') {
  const menu = container.querySelector('[data-requests-menu]');
  container.querySelectorAll('[data-requests-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.requestsTab;
      menu.hidden = true;
      container.querySelectorAll('[data-requests-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.requestsPanel !== tab;
        panel.classList.toggle('active', panel.dataset.requestsPanel === tab);
      });
    });
  });
  if (initialTab) container.querySelector(`[data-requests-tab="${initialTab}"]`)?.click();
}

function bindRequestsPage(container, requestsApi, settingsApi, reference, state, showToast) {
  const controls = getControls(container);
  bindKeyCatalogue(container, requestsApi, controls, state, showToast);

  for (const control of Object.values(controls.line)) {
    control.addEventListener('input', () => updateRequestAddButton(controls, state));
    control.addEventListener('change', () => updateRequestAddButton(controls, state));
  }

  controls.year.addEventListener('change', async () => {
    state.year = Number(controls.year.value);
    state.requests = await requestsApi.list(state.year);
    controls.statusBody.innerHTML = renderRequestsStatusRows(state.requests);
  });

  controls.add.addEventListener('click', () => {
    if (!canAddRequestItem(controls, state)) return;
    const selectedMeasurementUnit = reference.measurementUnits.find(
      (unit) => unit.name === controls.line.measurement.value
    );
    state.items.push({
      nominalNumber: controls.line.nominal.value.trim(),
      description: controls.line.description.value.trim(),
      quantity: Number(controls.line.quantity.value),
      measurementUnit: controls.line.measurement.value,
      measurementUnitCode: selectedMeasurementUnit ? selectedMeasurementUnit.code : controls.line.measurement.value,
      justificationCode: controls.line.justification.value.trim(),
      priorityCode: controls.line.priority.value.trim(),
      notes: controls.line.notes.value.trim()
    });
    clearRequestLine(controls);
    renderRequestState(container, state);
    updateRequestAddButton(controls, state);
    persistRequestDraft(state);
  });

  const requestsClickHandler = async (event) => {
    const remove = event.target.closest('[data-remove-request-item]');
    if (remove) {
      state.items.splice(Number(remove.dataset.removeRequestItem), 1);
      renderRequestState(container, state);
      updateRequestAddButton(controls, state);
      persistRequestDraft(state);
      return;
    }

    const view = event.target.closest('[data-view-request]');
    if (view) {
      const request = state.requests.find((item) => item.id === Number(view.dataset.viewRequest));
      if (request) openRequestDocument(request, false);
      return;
    }

  };
  container.addEventListener('click', requestsClickHandler);

  controls.save.addEventListener('click', async () => {
    try {
      const result = await requestsApi.save({
        requestDate: controls.date.value,
        requestingUnit: reference.requestingUnit || controls.unit.value.trim(),
        issuingUnit: controls.issuingUnit.value,
        protocolNumber: controls.protocol.value.trim(),
        notes: '',
        items: state.items
      });
      await window.appApi.drafts.clear(REQUEST_DRAFT_KEY);
      showToast(result.message);
      await renderRequestsPage(container, requestsApi, settingsApi, showToast, 'requests');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση αίτησης.', 'error');
    }
  });

  return () => {
    container.removeEventListener('click', requestsClickHandler);
  };
}

function persistRequestDraft(state) {
  window.appApi.drafts.save(REQUEST_DRAFT_KEY, { items: state.items }).catch((error) => {
    console.error('Αποτυχία αποθήκευσης πρόχειρης αίτησης:', error);
  });
}

function bindKeyCatalogue(container, requestsApi, controls, state, showToast) {
  const choose = container.querySelector('#key-catalogue-choose');
  const search = container.querySelector('#key-catalogue-search');
  const status = container.querySelector('#key-catalogue-status');
  const results = container.querySelector('#key-catalogue-results');
  let timer = null;

  choose.addEventListener('click', async () => {
    try {
      const result = await requestsApi.chooseKeyCatalogue();
      if (result.canceled) return;
      search.disabled = false;
      search.placeholder = 'Πληκτρολογήστε τουλάχιστον 2 χαρακτήρες';
      choose.textContent = 'Αλλαγή φακέλου καταλόγου';
      status.textContent = `Ο κατάλογος είναι διαθέσιμος (${result.itemCount.toLocaleString('el-GR')} υλικά).`;
      search.focus();
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση του Καταλόγου ΚΕΥ.', 'error');
    }
  });

  search.addEventListener('input', () => {
    clearTimeout(timer);
    const query = search.value.trim();
    const request = ++state.catalogueRequest;
    if (query.length < 2) {
      results.replaceChildren();
      return;
    }
    timer = window.setTimeout(async () => {
      try {
        const response = await requestsApi.searchKeyCatalogue(query);
        if (request !== state.catalogueRequest) return;
        renderKeyCatalogueResults(results, response.items);
      } catch (error) {
        if (request !== state.catalogueRequest) return;
        results.replaceChildren();
        showToast(error.message || 'Δεν ήταν δυνατή η αναζήτηση στον Κατάλογο ΚΕΥ.', 'error');
      }
    }, 250);
  });

  results.addEventListener('click', (event) => {
    const button = event.target.closest('[data-key-catalogue-result]');
    if (!button) return;
    const item = JSON.parse(button.dataset.keyCatalogueResult);
    controls.line.nominal.value = item.nominalNumber;
    controls.line.description.value = item.description;
    if (item.partNumber && !controls.line.notes.value.trim()) {
      controls.line.notes.value = `P/N: ${item.partNumber}`;
    }
    updateRequestAddButton(controls, state);
    controls.line.quantity.focus();
  });
}

function renderKeyCatalogueResults(container, items) {
  container.replaceChildren();
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'muted';
    empty.textContent = 'Δεν βρέθηκε υλικό. Μπορείτε να συνεχίσετε με χειροκίνητη καταχώρηση.';
    container.appendChild(empty);
    return;
  }
  const list = document.createElement('div');
  list.className = 'key-catalogue-result-list';
  for (const item of items) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'key-catalogue-result';
    button.dataset.keyCatalogueResult = JSON.stringify(item);
    const title = document.createElement('strong');
    title.textContent = item.nominalNumber || 'Χωρίς Α/Ο';
    const description = document.createElement('span');
    description.textContent = item.description;
    const details = document.createElement('small');
    details.textContent = [item.partNumber && `P/N ${item.partNumber}`, item.equipment, item.catalogue]
      .filter(Boolean)
      .join(' · ');
    button.append(title, description, details);
    list.appendChild(button);
  }
  container.appendChild(list);
}

function openRequestDocument(request, printImmediately) {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop request-document-backdrop';
  modal.innerHTML = `
    <div class="request-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">Αίτηση</p>
          <h2>${escapeHtml(request.protocolNumber)}</h2>
        </div>
        <div class="row-actions">
          <button class="primary-button" data-print-current-request type="button">Εκτύπωση</button>
          <button class="secondary-button" data-close-card type="button">Κλείσιμο</button>
        </div>
      </header>
      <div class="request-document-preview">
        ${renderRequestDocument({
          date: request.requestDate,
          requestingUnit: request.requestingUnit,
          issuingUnit: request.issuingUnit,
          serviceLocation: request.serviceLocation,
          protocolNumber: request.protocolNumber,
          manager: request.manager,
          ped: request.ped,
          serialNumber: request.serialNumber,
          items: request.items
        })}
      </div>
    </div>
  `;

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close-card]')) {
      modal.remove();
    }

    if (event.target.closest('[data-print-current-request]')) {
      printRequestDocument();
    }
  });

  document.body.appendChild(modal);
  if (printImmediately) window.setTimeout(printRequestDocument, 100);
}

function printRequestDocument() {
  const style = document.createElement('style');
  style.textContent = '@page { size: A4 landscape; margin: 0; }';
  document.head.appendChild(style);
  window.print();
  window.setTimeout(() => style.remove(), 500);
}

function getControls(container) {
  return {
    date: container.querySelector('#request-date'),
    protocol: container.querySelector('#request-protocol'),
    unit: container.querySelector('#request-unit'),
    issuingUnit: container.querySelector('#request-issuing-unit'),
    add: container.querySelector('#request-add-item'),
    save: container.querySelector('#request-save'),
    limit: container.querySelector('#request-limit-text'),
    body: container.querySelector('#request-items-body'),
    year: container.querySelector('#requests-year'),
    statusBody: container.querySelector('#requests-status-body'),
    line: {
      nominal: container.querySelector('#request-nominal'),
      description: container.querySelector('#request-description'),
      quantity: container.querySelector('#request-quantity'),
      measurement: container.querySelector('#request-measurement'),
      justification: container.querySelector('#request-justification'),
      priority: container.querySelector('#request-priority'),
      notes: container.querySelector('#request-notes')
    }
  };
}

function canAddRequestItem(controls, state) {
  return (
    state.items.length < 10 &&
    controls.line.nominal.value.trim() &&
    controls.line.description.value.trim() &&
    Number(controls.line.quantity.value) > 0 &&
    controls.line.measurement.value &&
    controls.line.justification.value.trim() &&
    controls.line.priority.value.trim()
  );
}

function updateRequestAddButton(controls, state) {
  controls.add.disabled = !canAddRequestItem(controls, state);
  controls.save.disabled = !state.items.length;
}

function renderRequestState(container, state) {
  const controls = getControls(container);
  controls.body.innerHTML = renderRequestItemRows(state.items);
  controls.limit.textContent = `${state.items.length}/10 καταχωρήσεις`;
  controls.save.disabled = !state.items.length;
}

function renderRequestDocument({ date, requestingUnit, issuingUnit, serviceLocation, protocolNumber, manager, ped, serialNumber, items }) {
  const rows = [...items];
  while (rows.length < 10) rows.push(null);
  const documentProtocol = protocolNumber || (serialNumber ? `Φ.600.14/${serialNumber}` : 'Φ.600.14/……');
  return `
    <article class="request-document-page print-document-area">
      <div class="request-title-row">
        <h1>ΑΙΤΗΣΗ ΜΗΧΑΝΟΓΡΑΦΙΚΩΣ ΑΙΤΟΥΜΕΝΩΝ ΥΛΙΚΩΝ (**)</h1>
        <span>ΔΥΠ 147</span>
      </div>
      <div class="request-form-grid">
        <div class="request-top-cell unit-cell">
          <div>ΑΙΤΟΥΣΑ ΜΟΝΑΔΑ</div>
          <strong>${escapeHtml(requestingUnit || '')}</strong>
          <div>ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ</div>
          <strong>${escapeHtml(issuingUnit || '')}</strong>
        </div>
        <div class="request-top-cell unit-cell">
          <div>ΜΟΝΑΔΑ ΜΕΣΩ</div>
          <strong></strong>
          <div>ΜΟΝΑΔΑ ΔΙΑ</div>
          <strong></strong>
        </div>
        <div class="request-top-cell order-cell">
          <div>ΔΙΑΤΑΓΗ ΧΟΡΗΓΗΣΕΩΣ</div>
          <div class="small-mark">(δ)</div>
          <div class="subline">ΚΩΔΙΚΑΣ ΔΙΑΤΑΓΗΣ</div>
          <div class="small-mark">(γ)</div>
        </div>
        <div class="request-top-cell order-cell">
          <div>ΔΙΑΤΑΓΗ ΔΕΣΜΕΥΣΗΣ</div>
          <div class="small-mark">(ε)</div>
          <div class="subline">ΚΩΔΙΚΑΣ ΔΙΑΤΑΓΗΣ</div>
          <div class="small-mark">(στ)</div>
        </div>
        <div class="request-top-cell medium-code-cell">
          ΚΩΔΙΚΑΣ<br />ΜΕΣΩ<br />Η (ΔΙΑΣ)<br />ΔΙΑ<br />[&nbsp;&nbsp;]
          <div class="small-mark">(ζ)</div>
        </div>
        <div class="request-top-cell ky-cell">
          <div>Α/Ο Κ.Υ.</div>
          <div class="small-mark">(ια)</div>
          <div>ΠΟΣΟΤΗΤΑ Κ.Υ.</div>
          <div class="small-mark">(ιβ)</div>
          <div>ΑΡ. ΑΝΑΓΝΩΡΙΣΗΣ ΚΥ</div>
          <div class="small-mark">(ιγ)</div>
        </div>
        <div class="request-big-one">1</div>
      </div>
      <table class="request-document-table">
        <thead>
          <tr>
            <th>ΚΩΔΙΚΑΣ<br />ΕΝΤΥΠΟΥ</th>
            <th>ΑΡΙΘΜΟΣ<br />ΟΝΟΜΑΣΤΙΚΟΥ</th>
            <th>ΠΕΡΙΓΡΑΦΗ ΥΛΙΚΟΥ</th>
            <th>ΑΙΤΟΥΜ.<br />ΠΟΣΟΤ.</th>
            <th>ΤΑΥΤΟΤΗΤΑ ΕΝΤΥΠΟΥ<br />(ΑΡΙΘ. ΠΑΡΑΓΓΕΛΙΑΣ)</th>
            <th>ΜΜ</th>
            <th>ΚΩΔ<br />ΑΙΤ</th>
            <th>ΚΩΔ<br />ΠΡΟΤ</th>
            <th>ΚΩΔ<br />ΔΕΛΤ</th>
            <th>ΠΑΡΑ-<br />ΤΗΡΗ-<br />ΣΕΙΣ</th>
          </tr>
        </thead>
        <tbody>${rows.map((item, index) => renderRequestDocumentRow(item, index, rows)).join('')}</tbody>
      </table>
      <div class="request-doc-signatures">
        ${renderSignatureCell('ΑΙΤΗΣΗ ΑΙΤΟΥΝΤΟΣ<br />ΚΑΙ ΣΦΡΑΓΙΔΑ<br />ΜΟΝΑΔΑΣ', manager)}
        ${renderSignatureCell('ΥΠΟΓΡΑΦΗ ΕΓΚΡΙΝΟΝΤΟΣ<br />ΤΗΝ ΑΙΤΗΣΗ<br />ΚΑΙ ΟΙΚΕΙΑ ΣΦΡΑΓΙΔΑ', ped)}
        <span>ΥΠΟΓΡΑΦΗ ΥΠΑΛΛΗΛΟΥ<br />ΚΩΔΙΚΟΠΟΙΗΣΗΣ *</span>
        <span>Υποβάλλεται υπό τύπου αναφοράς<br />${escapeHtml(documentProtocol)}<br />${escapeHtml(serviceLocation || '(τόπος)……………')} ${formatGreekDate(date)}</span>
        <span>Αρ Εγκρίσεως Προϊσταμένου:</span>
      </div>
      <div class="request-doc-meta">
        <span></span>
        <span></span>
      </div>
    </article>
  `;
}

function renderSignatureCell(title, value) {
  const signature = splitOfficerSignature(value);
  return `
    <span class="request-signature-cell">
      <span>${title}</span>
      <span class="request-signature-person">
        <strong>${escapeHtml(signature.name)}</strong>
        <em>${escapeHtml(signature.rank)}</em>
      </span>
    </span>
  `;
}

function renderRequestDocumentRow(item, index, rows) {
  const fulfilledClass = item && item.isFulfilled ? ' class="request-fulfilled-row"' : '';
  const barcode = item ? renderRequestItemBarcode(item) : '';
  return `
    <tr${fulfilledClass}>
      <td></td>
      <td>${item ? escapeHtml(item.nominalNumber) : ''}</td>
      <td>${item ? escapeHtml(item.description) : ''}</td>
      <td>${item ? escapeHtml(item.quantity) : ''}</td>
      <td></td>
      <td>${item ? escapeHtml(item.measurementUnitCode || toDocumentMeasurementUnit(item.measurementUnit)) : ''}</td>
      <td>${item ? escapeHtml(item.justificationCode) : ''}</td>
      <td>${item ? escapeHtml(item.priorityCode) : ''}</td>
      <td></td>
      <td class="request-document-notes-cell">
        ${barcode}
        ${item && item.notes ? `<span>${escapeHtml(item.notes)}</span>` : ''}
      </td>
    </tr>
  `;
}

function renderRequestItemRows(items) {
  if (!items.length) return '<tr><td colspan="9" class="empty-table">Δεν έχουν προστεθεί υλικά.</td></tr>';
  return items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(item.nominalNumber)}</td>
          <td class="material-description-cell">${escapeHtml(item.description)}</td>
          <td class="number-cell">${escapeHtml(item.quantity)}</td>
          <td>${escapeHtml(item.measurementUnit)}</td>
          <td>${escapeHtml(item.justificationCode)}</td>
          <td>${escapeHtml(item.priorityCode)}</td>
          <td>${escapeHtml(item.notes)}</td>
          <td><button class="danger-button" data-remove-request-item="${index}" type="button">Διαγραφή</button></td>
        </tr>`
    )
    .join('');
}

function renderRequestsStatusRows(requests) {
  if (!requests.length) return '<tr><td colspan="6" class="empty-table">Δεν υπάρχουν αιτήσεις στο έτος.</td></tr>';
  return requests
    .map(
      (request) => `
        <tr>
          <td>${request.serialNumber}</td>
          <td>${escapeHtml(request.protocolNumber)}</td>
          <td>${formatGreekDate(request.requestDate)}</td>
          <td class="material-description-cell">${escapeHtml(request.items[0] ? request.items[0].description : '')}</td>
          <td>${escapeHtml(request.status)}</td>
          <td class="row-actions">
            <button class="secondary-button" data-view-request="${request.id}" type="button">Προβολή</button>
          </td>
        </tr>`
    )
    .join('');
}

function input(label, id, type = 'text') {
  return `<label class="field"><span>${label}</span><input id="${id}" type="${type}" autocomplete="off" /></label>`;
}

function selectMeasurement(units) {
  return `
    <label class="field">
      <span>Μονάδα Μέτρησης</span>
      <select id="request-measurement">
        <option value="">Επιλογή</option>
        ${units.map((unit) => `<option value="${escapeHtml(unit.name)}">${escapeHtml(unit.name)}</option>`).join('')}
      </select>
    </label>`;
}

function selectJustification(codes) {
  return `
    <label class="field">
      <span>Κωδικός Αιτιολογίας</span>
      <select id="request-justification">
        <option value="">Επιλογή</option>
        ${codes
          .map(
            (code) =>
              `<option value="${escapeHtml(code.code)}">${escapeHtml(code.code)} - ${escapeHtml(code.description)}</option>`
          )
          .join('')}
      </select>
    </label>`;
}

function selectPriority() {
  const groups = listRequestPriorityOptionGroups();

  return `
    <label class="field">
      <span>Κωδικός Προτεραιότητας</span>
      <select id="request-priority">
        <option value="">Επιλογή</option>
        ${groups
          .map(
            (group) => `
              <optgroup label="${escapeHtml(group.label)}">
                ${group.options
                  .map((option) => `<option value="${escapeHtml(option.code)}">${escapeHtml(option.label)}</option>`)
                  .join('')}
              </optgroup>
            `
          )
          .join('')}
      </select>
    </label>`;
}

function toDocumentMeasurementUnit(value) {
  const normalized = normalize(value);
  const map = new Map([
    ['τεμάχια', 'EA'],
    ['τεμαχια', 'EA'],
    ['τεμ', 'EA'],
    ['κιλά', 'kg'],
    ['κιλα', 'kg'],
    ['λίτρα', 'lit'],
    ['λιτρα', 'lit']
  ]);
  return map.get(normalized) || value;
}

function normalize(value) {
  return String(value || '').trim().toLocaleLowerCase('el-GR');
}

function clearRequestLine(controls) {
  for (const control of Object.values(controls.line)) control.value = '';
}

function formatGreekDate(value) {
  if (!value) return '';
  return new Date(value).toLocaleDateString('el-GR');
}
