import { escapeHtml } from '../components/forms.js';
import { splitOfficerSignature } from '../officerSignature.js';

export async function renderChargesPage(container, internalApi, showToast) {
  const referenceData = await internalApi.getReferenceData();
  const state = { drafts: [], pendingComposition: null, pendingCompositionShareId: null };

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΓΕΝΙΚΗ ΔΙΑΧΕΙΡΙΣΗ</p>
        <h2>ΚΙΝΗΣΕΙΣ ΜΕΡΙΚΩΝ ΔΙΑΧΕΙΡΙΣΕΩΝ</h2>
      </div>
    </section>

    <section class="page-panel">
      <h3>ΝΕΑ ΕΣΩΤΕΡΙΚΗ ΚΙΝΗΣΗ</h3>
      ${
        referenceData.departmentManagers.length
          ? renderMovementForm(referenceData)
          : '<p class="muted">ΠΡΟΣΘΕΣΕ ΠΡΩΤΑ ΜΕΡΙΚΕΣ ΔΙΑΧΕΙΡΙΣΕΙΣ ΑΠΟ ΤΙΣ ΡΥΘΜΙΣΕΙΣ.</p>'
      }
    </section>

    <section class="page-panel">
      <div class="requests-status-header">
        <h3>ΥΛΙΚΑ ΠΡΟΣ ΚΑΤΑΧΩΡΗΣΗ</h3>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Α/Α</th><th>ΗΜΕΡΟΜΗΝΙΑ</th><th>ΜΕΡΙΚΗ ΔΙΑΧΕΙΡΙΣΗ</th><th>ΚΙΝΗΣΗ</th><th>ΜΕΡΙΔΑ</th><th>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th>ΠΕΡΙΓΡΑΦΗ</th><th>ΜΟΝΑΔΑ ΜΕΤΡΗΣΗΣ</th><th class="number-cell">ΠΟΣΟΤΗΤΑ</th><th></th></tr>
          </thead>
          <tbody id="internal-drafts-body">${renderDraftRows(state.drafts)}</tbody>
        </table>
      </div>
      <div class="row-actions internal-save-list-actions">
        <button id="internal-save-list" class="primary-button" type="button" disabled>ΑΠΟΘΗΚΕΥΣΗ</button>
      </div>
    </section>

    <section class="page-panel">
      <div class="requests-status-header">
        <h3>ΔΕΛΤΙΑ ΔΟΣΟΛΗΨΙΩΝ</h3>
        <div class="internal-print-controls">
          <label class="field">
            <span>ΜΕΡΙΚΗ ΔΙΑΧΕΙΡΙΣΗ</span>
            <select id="internal-print-department">
              <option value="">ΕΠΙΛΟΓΗ</option>
              ${referenceData.departmentManagers.map((manager) => `<option value="${manager.id}">${escapeHtml(manager.departmentName)}</option>`).join('')}
            </select>
          </label>
          <button id="internal-print-k2310" class="secondary-button" type="button">ΠΡΟΒΟΛΗ Κ2310/ΔΥΠ</button>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th>Α/Α</th><th>ΑΡΙΘΜΟΣ ΜΕΡΙΔΑΣ</th><th>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th>ΠΕΡΙΓΡΑΦΗ</th><th>ΜΟΝΑΔΑ ΜΕΤΡΗΣΗΣ</th><th class="number-cell">ΤΕΛΙΚΩΣ ΧΡΕΩΜΕΝΗ ΠΟΣΟΤΗΤΑ</th></tr>
          </thead>
          <tbody id="internal-balances-body">${renderBalanceRows([])}</tbody>
        </table>
      </div>
    </section>
  `;

  bindPage(container, internalApi, referenceData, state, showToast);
}

function renderMovementForm(referenceData) {
  return `
    <div class="internal-movement-line addy-panel">
      <div class="addy-header-grid internal-movement-row internal-movement-context">
        <label class="field"><span>ΗΜΕΡΟΜΗΝΙΑ</span><input id="internal-date" type="date" value="${referenceData.today}" /></label>
        <label class="field">
          <span>ΜΕΡΙΚΗ ΔΙΑΧΕΙΡΙΣΗ</span>
          <select id="internal-department">
            <option value="">ΕΠΙΛΟΓΗ</option>
            ${referenceData.departmentManagers.map((manager) => `<option value="${manager.id}">${escapeHtml(manager.departmentName)} - ${escapeHtml(manager.departmentHead)}</option>`).join('')}
          </select>
        </label>
        <label class="field">
          <span>ΕΙΔΟΣ ΚΙΝΗΣΗΣ</span>
          <select id="internal-type"><option value="">ΕΠΙΛΟΓΗ</option><option value="Χορήγηση">ΧΟΡΗΓΗΣΗ</option><option value="Επιστροφή">ΕΠΙΣΤΡΟΦΗ</option></select>
        </label>
      </div>
      <div class="addy-line-grid internal-movement-row internal-material-line">
        <label class="field">
          <span>ΑΡΙΘΜΟΣ ΜΕΡΙΔΑΣ</span>
          <input id="internal-share" list="internal-share-list" autocomplete="off" />
        </label>
        <label class="field"><span>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</span><input id="internal-nominal" readonly /></label>
        <label class="field"><span>ΠΕΡΙΓΡΑΦΗ</span><input id="internal-description" readonly /></label>
        <label class="field"><span>ΜΟΝΑΔΑ ΜΕΤΡΗΣΗΣ</span><input id="internal-measurement" readonly /></label>
        <label class="field"><span>ΠΟΣΟΤΗΤΑ</span><input id="internal-quantity" type="number" min="0.001" step="0.001" /></label>
        <button id="internal-add" class="primary-button" type="button">ΠΡΟΣΘΗΚΗ</button>
      </div>
    </div>
    <datalist id="internal-share-list">
      ${referenceData.shares.map((share) => `<option value="${escapeHtml(share.shareNumber)}">${escapeHtml(share.nominalNumber)} - ${escapeHtml(share.description)}</option>`).join('')}
    </datalist>
  `;
}

function bindPage(container, internalApi, referenceData, state, showToast) {
  const shareSelect = container.querySelector('#internal-share');
  if (shareSelect) {
    shareSelect.addEventListener('input', () => {
      const share = findShareByNumber(referenceData.shares, shareSelect.value);
      applyShare(container, share);
      if (!share || share.id !== state.pendingCompositionShareId) {
        state.pendingComposition = null;
        state.pendingCompositionShareId = null;
      }
    });

    shareSelect.addEventListener('change', () => {
      const share = findShareByNumber(referenceData.shares, shareSelect.value);
      applyShare(container, share);
    });

    container.querySelector('#internal-add').addEventListener('click', async () => {
      const departmentId = Number(container.querySelector('#internal-department').value);
      const department = referenceData.departmentManagers.find((item) => item.id === departmentId);
      const share = findShareByNumber(referenceData.shares, shareSelect.value);
      const shareId = share ? share.id : 0;
      const quantity = Number(container.querySelector('#internal-quantity').value);
      const movementType = container.querySelector('#internal-type').value;
      if (!department || !share || !movementType || !Number.isFinite(quantity) || quantity <= 0) {
        showToast('ΣΥΜΠΛΗΡΩΣΕ ΜΕΡΙΚΗ ΔΙΑΧΕΙΡΙΣΗ, ΚΙΝΗΣΗ, ΜΕΡΙΔΑ ΚΑΙ ΠΟΣΟΤΗΤΑ.', 'error');
        return;
      }
      let composition = state.pendingComposition || [];
      if (share.requiresComposition && (!composition.length || state.pendingCompositionShareId !== share.id)) {
        composition = await openInternalCompositionDialog(share, quantity);
        if (!composition) return;
      }
      state.drafts.push({
        documentDate: container.querySelector('#internal-date').value,
        departmentManagerId: departmentId,
        departmentName: department.departmentName,
        movementType,
        shareId,
        shareNumber: share.shareNumber,
        nominalNumber: share.nominalNumber,
        description: share.description,
        measurementUnit: share.measurementUnit,
        quantity,
        composition
      });
      state.drafts.sort(compareShareNumbers);
      renderDraftList(container, state);
      shareSelect.value = '';
      container.querySelector('#internal-quantity').value = '';
      state.pendingComposition = null;
      state.pendingCompositionShareId = null;
      applyShare(container, null);
    });
  }

  container.querySelector('#internal-drafts-body').addEventListener('click', (event) => {
    const button = event.target.closest('[data-remove-draft]');
    if (!button) return;
    state.drafts.splice(Number(button.dataset.removeDraft), 1);
    renderDraftList(container, state);
  });

  container.querySelector('#internal-save-list').addEventListener('click', async () => {
    if (!state.drafts.length) return;
    const button = container.querySelector('#internal-save-list');
    button.disabled = true;
    try {
      for (const draft of state.drafts) {
        await internalApi.save(draft);
      }
      showToast('Η ΛΙΣΤΑ ΚΙΝΗΣΕΩΝ ΑΠΟΘΗΚΕΥΤΗΚΕ.');
      await renderChargesPage(container, internalApi, showToast);
    } catch (error) {
      button.disabled = false;
      showToast(error.message || 'ΔΕΝ ΗΤΑΝ ΔΥΝΑΤΗ Η ΑΠΟΘΗΚΕΥΣΗ ΤΗΣ ΛΙΣΤΑΣ.', 'error');
    }
  });

  const departmentSelect = container.querySelector('#internal-print-department');
  let selectedBalances = [];
  departmentSelect?.addEventListener('change', async () => {
    const departmentId = Number(departmentSelect.value);
    if (!departmentId) {
      selectedBalances = [];
      container.querySelector('#internal-balances-body').innerHTML = renderBalanceRows([]);
      return;
    }
    try {
      selectedBalances = await internalApi.listDepartmentBalances(departmentId);
      container.querySelector('#internal-balances-body').innerHTML = renderBalanceRows(selectedBalances);
    } catch (error) {
      showToast(error.message || 'ΔΕΝ ΗΤΑΝ ΔΥΝΑΤΗ Η ΦΟΡΤΩΣΗ ΤΩΝ ΧΡΕΩΜΕΝΩΝ ΥΛΙΚΩΝ.', 'error');
    }
  });

  container.querySelector('#internal-print-k2310')?.addEventListener('click', async () => {
    const departmentId = Number(container.querySelector('#internal-print-department').value);
    const department = referenceData.departmentManagers.find((item) => item.id === departmentId);
    if (!department) {
      showToast('ΕΠΙΛΕΞΕ ΜΕΡΙΚΗ ΔΙΑΧΕΙΡΙΣΗ.', 'error');
      return;
    }
    try {
      selectedBalances = await internalApi.listDepartmentBalances(departmentId);
      openK2310Document(
        referenceData.serviceName,
        department,
        selectedBalances,
        referenceData.financialManager
      );
    } catch (error) {
      showToast(error.message || 'ΔΕΝ ΗΤΑΝ ΔΥΝΑΤΗ Η ΠΡΟΒΟΛΗ ΤΟΥ Κ2310/ΔΥΠ.', 'error');
    }
  });
}

function renderDraftList(container, state) {
  container.querySelector('#internal-drafts-body').innerHTML = renderDraftRows(state.drafts);
  container.querySelector('#internal-save-list').disabled = state.drafts.length === 0;
}

function renderDraftRows(drafts) {
  if (!drafts.length) return '<tr><td colspan="10" class="empty-table">ΔΕΝ ΕΧΟΥΝ ΠΡΟΣΤΕΘΕΙ ΥΛΙΚΑ.</td></tr>';
  return drafts.map((item, index) => `
    <tr>
      <td>${index + 1}</td><td>${formatDate(item.documentDate)}</td><td>${escapeHtml(item.departmentName)}</td>
      <td>${escapeHtml(item.movementType)}</td><td>${escapeHtml(item.shareNumber)}</td><td>${escapeHtml(item.nominalNumber)}</td>
      <td class="material-description-cell">${escapeHtml(item.description)}</td><td>${escapeHtml(item.measurementUnit)}</td>
      <td class="number-cell">${formatQuantity(item.quantity)}</td>
      <td><button class="icon-button danger-button" data-remove-draft="${index}" type="button" title="ΔΙΑΓΡΑΦΗ">×</button></td>
    </tr>
  `).join('');
}

function openK2310Document(serviceName, department, balances, financialManager) {
  const modal = document.createElement('div');
  let signatureMode = 'none';
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">Κ2310/ΔΥΠ</p><h2>ΔΕΛΤΙΟ ΔΟΣΟΛΗΨΙΩΝ</h2></div>
        <div class="row-actions k2310-preview-actions">
          <button class="secondary-button" data-k2310-signature="manager" type="button">Υπογραφή ΔΧΣΤΗ</button>
          <button class="secondary-button" data-k2310-signature="department" type="button">Υπογραφή Μερικού Διαχειριστή</button>
          <button class="secondary-button" data-k2310-signature="all" type="button">Όλες οι υπογραφές</button>
          <button class="secondary-button" data-close-k2310 type="button">ΚΛΕΙΣΙΜΟ</button>
          <button class="primary-button" data-print-k2310 type="button">ΕΚΤΥΠΩΣΗ</button>
        </div>
      </header>
      <div data-k2310-pages></div>
    </section>
  `;
  const renderPreview = () => {
    modal.querySelector('[data-k2310-pages]').innerHTML = renderK2310Pages(
      serviceName,
      department,
      balances,
      { signatureMode, financialManager }
    );
    modal.querySelectorAll('[data-k2310-signature]').forEach((button) => {
      const active = button.dataset.k2310Signature === signatureMode;
      button.classList.toggle('primary-button', active);
      button.classList.toggle('secondary-button', !active);
    });
  };
  modal.addEventListener('click', async (event) => {
    if (event.target === modal || event.target.closest('[data-close-k2310]')) modal.remove();
    const signatureButton = event.target.closest('[data-k2310-signature]');
    if (signatureButton) {
      signatureMode = signatureButton.dataset.k2310Signature;
      renderPreview();
      return;
    }
    if (event.target.closest('[data-print-k2310]')) {
      await printK2310Document(modal);
    }
  });
  renderPreview();
  document.body.appendChild(modal);
}

async function printK2310Document(modal) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = [...modal.querySelectorAll('.k2310-page')]
    .map((page) => page.outerHTML)
    .join('');
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({ landscape: true });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

export function renderK2310Pages(serviceName, department, balances, options = {}) {
  const pageSize = 17;
  const printableRows = balances.flatMap((balance, index) => [
    { type: 'share', balance, serial: index + 1 },
    ...(balance.composition || []).map((component) => ({
      type: 'component',
      component
    }))
  ]);
  const pageCount = Math.max(1, Math.ceil(printableRows.length / pageSize));
  const documentDate = new Date().toLocaleDateString('el-GR');
  const departmentHead = splitOfficerSignature(department.departmentHead || '');
  const financialManager = splitOfficerSignature(options.financialManager || '');
  const signatureMode = options.signatureMode || 'none';
  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const pageItems = printableRows.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);
    const rows = Array.from({ length: pageSize }, (_row, index) => pageItems[index] || null);
    return `
      <article class="index-page print-document-area k2310-page">
        <div class="k2310-heading">
          <div class="print-document-code">Κ2310/ΔΥΠ</div>
          <h1>ΔΕΛΤΙΟ ΔΟΣΟΛΗΨΙΩΝ</h1>
        </div>
        <table class="index-table k2310-table">
          <colgroup>
            <col class="k2310-col-serial" /><col class="k2310-col-share" />
            <col class="k2310-col-nominal" /><col class="k2310-col-description" />
            <col class="k2310-col-unit" /><col class="k2310-col-projected" />
            ${'<col class="k2310-col-movement" />'.repeat(10)}
            <col class="k2310-col-balance" />
          </colgroup>
          <thead>
            <tr>
              <th colspan="17" class="k2310-integrated-meta">
                <div class="k2310-meta-grid">
                  <span><strong>ΧΟΡΗΓΗΘΗΚΑΝ</strong><br />(1) ΑΠΟ: ${escapeHtml(serviceName || '')}</span>
                  <span>(2) ΠΡΟΣ: ${escapeHtml(department.departmentName)}</span>
                  <span>(3) ΑΡΙΘΜΟΣ ΔΕΛΤΙΟΥ: ${pageIndex + 1}</span>
                </div>
              </th>
            </tr>
            <tr>
              <th rowspan="3">Α/Α</th><th rowspan="3">ΑΡΙΘ. ΜΕΡ. ΥΛΙΚΟΥ</th><th rowspan="3">ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th><th rowspan="3">ΠΕΡΙΓΡΑΦΗ ΥΛΙΚΩΝ</th><th rowspan="3">ΜΟΝ. ΜΕΤΡ.</th><th rowspan="3">ΠΡΟΒΛ. ΠΟΣΟΤΗΤΑ</th>
              <th colspan="10">(10) ΗΜΕΡΟΜΗΝΙΕΣ</th><th rowspan="3">ΥΠΟΛ. (13)</th>
            </tr>
            <tr>
              <th colspan="5">(11) ΧΟΡΗΓΗΣΕΙΣ</th><th colspan="5">(12) ΕΠΙΣΤΡΟΦΕΣ</th>
            </tr>
            <tr>
              ${['α', 'β', 'γ', 'δ', 'ε', 'α', 'β', 'γ', 'δ', 'ε']
                .map((letter) => `<th class="k2310-letter-cell" rowspan="2">${letter}</th>`)
                .join('')}
            </tr>
            <tr class="k2310-number-row">
              ${[4, 5, 6, 7, 8, 9].map((number) => `<td>${number}</td>`).join('')}
              <td class="k2310-dark-cell"></td>
            </tr>
            <tr class="k2310-date-row">
              ${'<td class="k2310-dark-cell"></td>'.repeat(6)}
              <td>${escapeHtml(documentDate)}</td>
              ${'<td></td>'.repeat(9)}
              <td class="k2310-dark-cell"></td>
            </tr>
          </thead>
          <tbody>
            ${rows.map((row) => renderK2310Row(row)).join('')}
          </tbody>
          <tfoot>
            <tr>
              ${renderK2310SignatureRow(signatureMode, financialManager, departmentHead)}
            </tr>
          </tfoot>
        </table>
      </article>
    `;
  }).join('');
}

function renderK2310Row(row) {
  if (!row) return `<tr>${'<td></td>'.repeat(17)}</tr>`;
  if (row.type === 'component') {
    const component = row.component;
    const issueCells = [
      component.finalQuantity ? formatQuantity(component.finalQuantity) : '',
      '', '', '', ''
    ];
    const returnCells = ['', '', '', '', ''];
    return `<tr class="k2310-composition-row"><td></td><td></td><td>${escapeHtml(component.componentNominalNumber)}</td><td class="k2310-description-cell">${escapeHtml(component.componentDescription)}</td><td>${escapeHtml(component.measurementUnit)}</td><td></td>${[...issueCells, ...returnCells].map((value) => `<td>${value}</td>`).join('')}<td></td></tr>`;
  }
  const { balance, serial } = row;
  const issueCells = [
    balance.finalQuantity ? formatQuantity(balance.finalQuantity) : '',
    '', '', '', ''
  ];
  const returnCells = ['', '', '', '', ''];
  return `<tr><td>${serial}</td><td>${escapeHtml(balance.shareNumber)}</td><td>${escapeHtml(balance.nominalNumber)}</td><td class="k2310-description-cell">${escapeHtml(balance.description)}</td><td>${escapeHtml(balance.measurementUnit)}</td><td>${formatQuantity(balance.projectedQuantity)}</td>${[...issueCells, ...returnCells].map((value) => `<td>${value}</td>`).join('')}<td></td></tr>`;
}

function renderK2310SignatureRow(mode, financialManager, departmentHead) {
  const selectedIdentity = mode === 'manager' ? financialManager : departmentHead;
  const managerInLabel = mode === 'all';
  const showAdjacent = ['manager', 'department', 'all'].includes(mode);
  const adjacentIdentity = mode === 'all' ? departmentHead : selectedIdentity;
  return `
    <td colspan="6" class="k2310-signatures${managerInLabel ? ' k2310-manager-signature' : ''}">
      <span>(14) ΥΠΟΓΡΑΦΕΣ</span>
      ${managerInLabel ? renderK2310Identity(financialManager) : ''}
    </td>
    ${showAdjacent ? `<td colspan="5" class="k2310-signature-grid-cell k2310-department-signature">${renderK2310Identity(adjacentIdentity)}</td>` : '<td colspan="5" class="k2310-signature-grid-cell"></td>'}
    <td colspan="6" class="k2310-signature-grid-cell"></td>
  `;
}

function renderK2310Identity(identity) {
  if (!identity.name && !identity.rank) return '';
  return `<strong>${escapeHtml(identity.name)}</strong><span>${escapeHtml(identity.rank)}</span>`;
}

function openInternalCompositionDialog(share, defaultQuantity = '') {
  return new Promise((resolve) => {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <section class="material-card-modal addy-composition-modal" role="dialog" aria-modal="true">
        <header class="material-card-header">
          <div>
            <p class="eyebrow">ΕΣΩΤΕΡΙΚΗ ΚΙΝΗΣΗ</p>
            <h2>Σύνθεση ${escapeHtml(share.description)}</h2>
            <p class="muted">Συμπλήρωσε την ποσότητα για κάθε υλικό της συλλογής.</p>
          </div>
        </header>
        <div class="card-table-wrap">
          <table class="editable-records-table">
            <thead>
              <tr><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Μ/Μ</th><th>Ποσότητα</th></tr>
            </thead>
            <tbody>
              ${share.composition.map((item) => `
                <tr data-internal-composition-row
                    data-nominal="${escapeHtml(item.componentNominalNumber)}"
                    data-description="${escapeHtml(item.componentDescription)}"
                    data-unit="${escapeHtml(item.measurementUnit)}">
                  <td>${escapeHtml(item.componentNominalNumber)}</td>
                  <td class="material-description-cell">${escapeHtml(item.componentDescription)}</td>
                  <td>${escapeHtml(item.measurementUnit)}</td>
                  <td><input data-component-quantity type="number" min="0.001" step="0.001" value="${escapeHtml(defaultQuantity || '')}" /></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <div class="addy-save-row">
          <button class="secondary-button" data-cancel-internal-composition type="button">Ακύρωση</button>
          <button class="primary-button" data-confirm-internal-composition type="button">Αποθήκευση</button>
        </div>
      </section>
    `;
    const close = (result) => {
      modal.remove();
      resolve(result);
    };
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-cancel-internal-composition]')) {
        close(null);
        return;
      }
      if (!event.target.closest('[data-confirm-internal-composition]')) return;
      const rows = [...modal.querySelectorAll('[data-internal-composition-row]')];
      const quantities = rows.map((row) => Number(row.querySelector('[data-component-quantity]').value));
      if (quantities.some((quantity) => !Number.isFinite(quantity) || quantity <= 0)) return;
      close(rows.map((row, index) => ({
        componentNominalNumber: row.dataset.nominal,
        componentDescription: row.dataset.description,
        measurementUnit: row.dataset.unit,
        quantity: quantities[index]
      })));
    });
    document.body.appendChild(modal);
  });
}

function applyShare(container, share) {
  container.querySelector('#internal-nominal').value = share ? share.nominalNumber : '';
  container.querySelector('#internal-description').value = share ? share.description : '';
  container.querySelector('#internal-measurement').value = share ? share.measurementUnit : '';
}

function renderBalanceRows(balances) {
  if (!balances.length) return '<tr><td colspan="6" class="empty-table">ΕΠΙΛΕΞΕ ΜΕΡΙΚΗ ΔΙΑΧΕΙΡΙΣΗ Ή ΔΕΝ ΥΠΑΡΧΟΥΝ ΧΡΕΩΜΕΝΑ ΥΛΙΚΑ.</td></tr>';
  return balances.map((balance, index) => `
    <tr>
      <td>${index + 1}</td><td>${escapeHtml(balance.shareNumber)}</td><td>${escapeHtml(balance.nominalNumber)}</td>
      <td class="material-description-cell">${escapeHtml(balance.description)}</td><td>${escapeHtml(balance.measurementUnit)}</td>
      <td class="number-cell">${formatQuantity(balance.finalQuantity)}</td>
    </tr>
  `).join('');
}

function compareShareNumbers(left, right) {
  const leftNumber = Number(left.shareNumber);
  const rightNumber = Number(right.shareNumber);
  const leftNumeric = Number.isFinite(leftNumber);
  const rightNumeric = Number.isFinite(rightNumber);
  if (leftNumeric && rightNumeric && leftNumber !== rightNumber) return leftNumber - rightNumber;
  if (leftNumeric !== rightNumeric) return leftNumeric ? -1 : 1;
  return String(left.shareNumber).localeCompare(String(right.shareNumber), 'el', { numeric: true });
}

function findShareByNumber(shares, value) {
  const normalized = String(value || '').trim().toLocaleLowerCase('el-GR');
  return shares.find(
    (share) => String(share.shareNumber || '').trim().toLocaleLowerCase('el-GR') === normalized
  );
}

function formatQuantity(value) {
  return Number(value || 0).toLocaleString('el-GR', { maximumFractionDigits: 3 });
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}
