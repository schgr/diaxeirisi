import { escapeHtml, renderFiscalYearOptions } from '../components/forms.js';

export async function renderSharesPage(container, sharesApi, settingsApi, showToast, options = {}) {
  const [allShares, settings] = await Promise.all([
    sharesApi.list(),
    settingsApi.get()
  ]);
  const shares = options.compositionOnly
    ? allShares.filter((share) => share.requiresComposition)
    : allShares;
  const materialTypes = collectMaterialTypes(shares, settings.materialCategories);
  const heading = options.compositionOnly ? 'Συνθέσεις μερίδων' : 'Κατάσταση Μερίδων';
  const eyebrow = options.compositionOnly ? 'ΣΥΝΘΕΣΕΙΣ ΜΕΡΙΔΩΝ' : 'ΜΕΡΙΔΕΣ';

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">${eyebrow}</p>
        <h2>${heading}</h2>
        ${options.compositionOnly
          ? '<p class="page-description">Εμφανίζονται μόνο οι μερίδες στις οποίες έχει επιλεγεί ότι υπάρχει σύνθεση. Με διπλό κλικ ανοίγουν η σύνθεση και το φύλλο μεταβολών.</p>'
          : ''}
      </div>
      <div class="record-count"><span id="shares-count">${shares.length}</span> εγγραφές</div>
    </section>

    ${options.compositionOnly ? '' : `<section class="page-panel shares-filter-panel">
      <div class="shares-filter-grid">
        <label class="field">
          <span>Αριθμός μερίδας</span>
          <input data-filter="shareNumber" autocomplete="off" />
        </label>
        <label class="field">
          <span>Αριθμός ονομαστικού</span>
          <input data-filter="nominalNumber" autocomplete="off" />
        </label>
        <label class="field">
          <span>Περιγραφή</span>
          <input data-filter="description" autocomplete="off" />
        </label>
        <label class="field">
          <span>Είδος υλικού</span>
          <select data-filter="materialType">
            <option value="">Όλα</option>
            ${materialTypes.map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`).join('')}
          </select>
        </label>
      </div>
    </section>`}

    <section class="page-panel shares-panel">
      <div class="shares-table-wrap">
        <table class="shares-table">
          <thead>
            ${renderSharesTableHeader(options.compositionOnly)}
          </thead>
          <tbody id="shares-body"></tbody>
        </table>
      </div>
    </section>
  `;

  if (options.compositionOnly) {
    container.querySelector('#shares-body').innerHTML = renderRows(shares, true);
  } else {
    bindLiveFilters(container, shares, showToast);
  }
  bindShareCardOpen(container, sharesApi, showToast, settings, options);
}

function renderSharesTableHeader(compositionOnly) {
  if (compositionOnly) {
    return `
      <tr>
        <th>Αριθμός μερίδας</th>
        <th>Αριθμός ονομαστικού</th>
        <th class="share-description-column">Περιγραφή</th>
        <th class="number-cell">Λογιστικό</th>
      </tr>
    `;
  }

  return `
    <tr>
      <th>Αριθμός μερίδας</th>
      <th>Αριθμός ονομαστικού</th>
      <th>Αριθμός Κυρίου Υλικού</th>
      <th class="share-description-column">Περιγραφή</th>
      <th>Είδος υλικού</th>
      <th class="number-cell">Λογιστικό</th>
      <th class="number-cell">Σε Μερικές Διαχειρίσεις</th>
      <th class="number-cell">Διαφορά</th>
      <th>Κατάσταση</th>
    </tr>
  `;
}

function bindLiveFilters(container, shares, showToast) {
  const inputs = [...container.querySelectorAll('[data-filter]')];
  const body = container.querySelector('#shares-body');
  const count = container.querySelector('#shares-count');

  function applyFilters() {
    const filters = Object.fromEntries(
      inputs.map((input) => [input.dataset.filter, normalize(input.value)])
    );

    const filtered = filterAndRankShares(shares, filters);

    body.innerHTML = renderRows(filtered);
    count.textContent = filtered.length;
  }

  for (const input of inputs) {
    input.addEventListener('input', applyFilters);
    input.addEventListener('change', applyFilters);
  }

  try {
    applyFilters();
  } catch (error) {
    showToast(error.message || 'Δεν ήταν δυνατή η αναζήτηση.', 'error');
  }
}

function bindShareCardOpen(container, sharesApi, showToast, settings, options) {
  container.addEventListener('dblclick', async (event) => {
    const row = event.target.closest('tr[data-share-id]');
    if (!row) {
      return;
    }

    try {
      const card = await sharesApi.getCard(
        Number(row.dataset.shareId),
        Number(settings?.serviceInfo?.activeFiscalYear || new Date().getFullYear())
      );
      openShareCard(card, sharesApi, showToast, settings, options);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατό το άνοιγμα της καρτέλας υλικού.', 'error');
    }
  });
}

function openShareCard(card, sharesApi, showToast, settings, options = {}) {
  const existing = document.querySelector('.modal-backdrop');
  if (existing) {
    existing.remove();
  }

  const modal = document.createElement('div');
  const compositionEditor = Boolean(options.compositionOnly);
  const compositionLocked = !compositionEditor || card.compositionItems.length > 0;
  const changeSheetLocked = !compositionEditor || card.changeSheetEntries.length > 0;
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="material-card-modal" role="dialog" aria-modal="true">
      <header class="material-card-header">
        <div>
          <p class="eyebrow">${options.compositionOnly ? 'Σύνθεση μερίδας' : 'Καρτέλα υλικού'}</p>
          <h2>${escapeHtml(card.share.description)}</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-card type="button">Κλείσιμο</button>
        </div>
      </header>

      ${options.compositionOnly ? '' : `<section class="material-card-top">
        <div class="material-card-summary material-card-fields">
          ${detailField('Αριθμός μερίδας', 'shareNumber', card.share.shareNumber, 'text', true)}
          ${detailField('Αριθμός ονομαστικού', 'nominalNumber', card.share.nominalNumber, 'text', true)}
          ${detailField('Αριθμός Κυρίου Υλικού', 'mainMaterialNumber', card.share.mainMaterialNumber)}
          ${detailField('Περιγραφή', 'description', card.share.description, 'text', true)}
          ${detailField('Είδος υλικού', 'materialType', card.share.materialType, 'text', true)}
          ${detailField('Προβλεπόμενη Ποσότητα', 'projectedQuantity', card.share.projectedQuantity, 'number')}
          ${detailField('Λογιστικό υπόλοιπο', 'accountingBalance', card.share.accountingBalance, 'number', true)}
          ${detailField('Τιμή', 'unitPrice', card.share.unitPrice ?? '', 'number')}
          ${summaryItem('Σε Μερικές Διαχειρίσεις', formatQuantity(card.share.chargedQuantity))}
          ${summaryItem('Διαφορά', formatDifference(card.share.differenceQuantity))}
          ${toggleField('Απαιτεί Σύνθεση', 'requiresComposition', card.share.requiresComposition)}
          ${toggleField('Απαιτεί Σειριακό Αριθμό', 'requiresSerialNumber', card.share.requiresSerialNumber)}
          ${toggleField('Μητρώο Οπλισμού', 'requiresWeaponRegistry', card.share.requiresWeaponRegistry)}
          ${toggleField('Πυρομαχικά Β.Φ.', 'requiresAmmunitionBatchBook', card.share.requiresAmmunitionBatchBook)}
        </div>
        <div class="material-details-form">
          <div class="material-photo-box" data-photo-path="${escapeHtml(card.share.photoPath || '')}">
            ${card.share.photoPath ? `<img src="${escapeHtml(pathToFileUrl(card.share.photoPath))}" alt="Φωτογραφία υλικού" />` : '<span>Δεν έχει οριστεί φωτογραφία.</span>'}
          </div>
          <div class="row-actions">
            <button class="secondary-button" data-choose-share-photo type="button">Επιλογή Φωτογραφίας</button>
            <button class="primary-button" data-save-share-details type="button">Αποθήκευση</button>
          </div>
        </div>
      </section>`}

      ${card.share.requiresComposition ? `
      <section class="material-card-section material-records-section">
        <div class="material-card-section-title">
          <div><h3>Σύνθεση Υλικού</h3><p class="muted">ΔΥΠ/190 · εξαρτήματα και προβλεπόμενες ποσότητες.</p></div>
          <div class="row-actions">
            <button class="secondary-button" data-view-composition type="button">Προβολή</button>
            ${compositionEditor ? `
              <button class="secondary-button" data-edit-composition type="button" ${compositionLocked ? '' : 'hidden'}>Επεξεργασία</button>
              <button class="secondary-button" data-add-composition-row type="button" ${compositionLocked ? 'disabled' : ''}>Προσθήκη γραμμής</button>
            ` : ''}
          </div>
        </div>
        <div class="card-table-wrap">
          <table class="editable-records-table">
            <thead><tr><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Μ/Μ</th><th>Ποσότητα ανά Υλικό</th><th>Προβλεπόμενη Ποσότητα</th><th>Μη Χορηγηθείσα</th><th>Παρατηρήσεις</th><th></th></tr></thead>
            <tbody data-composition-body>${renderCompositionRows(card.compositionItems, compositionLocked)}</tbody>
          </table>
        </div>
        ${compositionEditor ? `<div class="addy-save-row">
          <span class="muted" data-composition-lock-state>${compositionLocked ? 'Η σύνθεση είναι κλειδωμένη.' : 'Η σύνθεση είναι σε επεξεργασία.'}</span>
          <button class="primary-button" data-save-composition type="button" ${compositionLocked ? 'disabled' : ''}>Αποθήκευση Σύνθεσης</button>
        </div>` : ''}
      </section>

      <section class="material-card-section material-records-section">
        <div class="material-card-section-title">
          <div><h3>Φύλλο Μεταβολών</h3><p class="muted">ΔΥΠ/191 · ιστορικό μεταβολών των ειδών συνθέσεως.</p></div>
          <div class="row-actions">
            <button class="secondary-button" data-view-change-sheet type="button">Προβολή</button>
            ${compositionEditor ? `
              <button class="secondary-button" data-edit-change-sheet type="button" ${changeSheetLocked ? '' : 'hidden'}>Επεξεργασία</button>
              <button class="secondary-button" data-add-change-row type="button" ${changeSheetLocked ? 'disabled' : ''}>Προσθήκη μεταβολής</button>
            ` : ''}
          </div>
        </div>
        <div class="card-table-wrap">
          <table class="editable-records-table">
            <thead><tr><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Ημερομηνία</th><th>Κίνηση</th><th>Ποσότητα</th><th>Παρατηρήσεις</th><th></th></tr></thead>
            <tbody data-change-sheet-body>${renderChangeSheetRows(card.changeSheetEntries, card.compositionItems, changeSheetLocked)}</tbody>
          </table>
        </div>
        ${compositionEditor ? `<div class="addy-save-row">
          <span class="muted" data-change-sheet-lock-state>${changeSheetLocked ? 'Το φύλλο μεταβολών είναι κλειδωμένο.' : 'Το φύλλο μεταβολών είναι σε επεξεργασία.'}</span>
          <button class="primary-button" data-save-change-sheet type="button" ${changeSheetLocked ? 'disabled' : ''}>Αποθήκευση Φύλλου</button>
        </div>` : ''}
      </section>
      ` : ''}

      ${options.compositionOnly ? '' : `<section class="material-card-section">
        <div class="material-card-section-title">
          <h3>Δοσοληψίες Έτους</h3>
          <label class="field compact-year-field">
            <span>Έτος</span>
            <select id="share-card-year">${renderFiscalYearOptions(card.year)}</select>
          </label>
        </div>
        <div class="card-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Α/Α</th>
                <th>Ημερομηνία</th>
                <th>Μονάδα Δοσοληψίας</th>
                <th>Αριθμός Ευρετηρίου</th>
                <th class="number-cell">Εισαγωγές</th>
                <th class="number-cell">Εξαγωγές</th>
                <th class="number-cell">Υπόλοιπο</th>
                <th>Παρατηρήσεις</th>
              </tr>
            </thead>
            <tbody>${renderTransactionRows(card.transactions)}</tbody>
          </table>
        </div>
      </section>

      <section class="material-card-section">
        <h3>Κατανομή σε Μερικές Διαχειρίσεις</h3>
        <div class="card-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Διαχειριστής</th>
                <th>Μερική Διαχείριση</th>
                <th class="number-cell">Ποσότητα</th>
                <th>Παρατηρήσεις</th>
              </tr>
            </thead>
            <tbody>${renderAssignmentRows(card.assignments)}</tbody>
          </table>
        </div>
      </section>`}
    </div>
  `;

  modal.addEventListener('click', (event) => {
    if (event.target === modal || event.target.closest('[data-close-card]')) {
      modal.remove();
      return;
    }

    if (event.target.closest('[data-choose-share-photo]')) {
      const photoBox = modal.querySelector('.material-photo-box');
      sharesApi.choosePhoto().then((photoPath) => {
        if (photoPath) {
          photoBox.dataset.photoPath = photoPath;
          photoBox.innerHTML = `<img src="${escapeHtml(pathToFileUrl(photoPath))}" alt="Φωτογραφία υλικού" />`;
        }
      }).catch((error) => showToast(error.message || 'Δεν ήταν δυνατή η επιλογή φωτογραφίας.', 'error'));
      return;
    }

    if (event.target.closest('[data-save-share-details]')) {
      const photoBox = modal.querySelector('.material-photo-box');
      const details = getShareDetailControls(modal);
      sharesApi.updateDetails(card.share.id, {
        shareNumber: details.shareNumber.value.trim(),
        nominalNumber: details.nominalNumber.value.trim(),
        mainMaterialNumber: details.mainMaterialNumber.value.trim(),
        materialCode: card.share.materialCode || '',
        description: details.description.value.trim(),
        materialType: details.materialType.value.trim(),
        projectedQuantity: details.projectedQuantity.value,
        accountingBalance: details.accountingBalance.value,
        chargedQuantity: card.share.chargedQuantity,
        unitPrice: details.unitPrice.value,
        photoPath: photoBox.dataset.photoPath || '',
        requiresComposition: details.requiresComposition.checked,
        requiresSerialNumber: details.requiresSerialNumber.checked,
        requiresWeaponRegistry: details.requiresWeaponRegistry.checked,
        requiresAmmunitionBatchBook: details.requiresAmmunitionBatchBook.checked,
        requiresChangeSheet: card.share.requiresChangeSheet
      }).then(async () => {
        showToast('Τα στοιχεία της μερίδας αποθηκεύτηκαν.');
        const refreshed = await sharesApi.getCard(card.share.id, card.year);
        modal.remove();
        openShareCard(refreshed, sharesApi, showToast, settings, options);
      })
        .catch((error) => showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση.', 'error'));
      return;
    }

    if (event.target.closest('[data-add-composition-row]')) {
      const body = modal.querySelector('[data-composition-body]');
      body.querySelector('.empty-record-row')?.remove();
      body.insertAdjacentHTML('beforeend', renderCompositionRows([{}], false));
      return;
    }

    if (event.target.closest('[data-edit-composition]')) {
      setCompositionLocked(modal, false);
      return;
    }

    if (event.target.closest('[data-view-composition]')) {
      openMaterialFormPreview(
        'Κατάσταση Συνθέσεως',
        renderCompositionDocument({
          ...card,
          compositionItems: collectCompositionRows(modal)
        }, settings)
      );
      return;
    }

    if (event.target.closest('[data-add-change-row]')) {
      const body = modal.querySelector('[data-change-sheet-body]');
      body.querySelector('.empty-record-row')?.remove();
      body.insertAdjacentHTML('beforeend', renderChangeSheetRows([{}], collectCompositionRows(modal)));
      return;
    }

    if (event.target.closest('[data-edit-change-sheet]')) {
      setChangeSheetLocked(modal, false);
      return;
    }

    if (event.target.closest('[data-view-change-sheet]')) {
      openMaterialFormPreview(
        'Φύλλο Μεταβολών',
        renderChangeSheetDocument({
          ...card,
          compositionItems: collectCompositionRows(modal),
          changeSheetEntries: collectChangeSheetRows(modal)
        }),
        true
      );
      return;
    }

    if (event.target.closest('[data-remove-record-row]')) {
      event.target.closest('tr').remove();
      return;
    }

    if (event.target.closest('[data-save-composition]')) {
      sharesApi.saveComposition(card.share.id, collectCompositionRows(modal))
        .then(async (result) => {
          showToast(result.message);
          const refreshed = await sharesApi.getCard(card.share.id, card.year);
          modal.remove();
          openShareCard(refreshed, sharesApi, showToast, settings, options);
        })
        .catch((error) => showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση της σύνθεσης.', 'error'));
      return;
    }

    if (event.target.closest('[data-save-change-sheet]')) {
      sharesApi.saveChangeSheet(card.share.id, collectChangeSheetRows(modal))
        .then((result) => {
          setChangeSheetLocked(modal, true);
          showToast(result.message);
        })
        .catch((error) => showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του φύλλου μεταβολών.', 'error'));
      return;
    }

  });

  modal.addEventListener('change', (event) => {
    const selector = event.target.closest('[data-field="componentLineNumber"]');
    if (!selector) return;
    const row = selector.closest('[data-change-row]');
    const composition = collectCompositionRows(modal);
    const item = composition[Number(selector.value) - 1];
    row.querySelector('[data-component-description]').textContent = item ? item.componentDescription : '';
  });

  modal.querySelector('#share-card-year')?.addEventListener('change', async (event) => {
    try {
      const refreshed = await sharesApi.getCard(card.share.id, Number(event.target.value) || new Date().getFullYear());
      modal.remove();
      openShareCard(refreshed, sharesApi, showToast, settings, options);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αλλαγή έτους.', 'error');
    }
  });

  document.body.appendChild(modal);
}

function summaryItem(label, value) {
  return `
    <div class="summary-item">
      <span>${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function detailField(label, name, value, type = 'text', readonly = false) {
  const step = type === 'number' ? ' min="0" step="0.001"' : '';
  const readonlyAttribute = readonly ? ' readonly' : '';
  return `
    <label class="summary-item material-detail-field">
      <span>${label}</span>
      <input data-share-detail="${name}" type="${type}" value="${escapeHtml(value ?? '')}"${step}${readonlyAttribute} autocomplete="off" />
    </label>
  `;
}

function toggleField(label, name, checked) {
  return `
    <label class="summary-item material-detail-toggle">
      <span>${label}</span>
      <input data-share-detail="${name}" type="checkbox" ${checked ? 'checked' : ''} />
    </label>
  `;
}

function renderCompositionRows(items, locked = false) {
  if (!items.length) return '<tr class="empty-record-row"><td colspan="8" class="empty-table">Δεν έχει καταχωρηθεί σύνθεση.</td></tr>';
  const lockedAttribute = locked ? ' readonly' : '';
  const disabledAttribute = locked ? ' disabled' : '';
  return items.map((item) => `
    <tr data-composition-row>
      <td><input data-field="componentNominalNumber" value="${escapeHtml(item.componentNominalNumber || '')}"${lockedAttribute} /></td>
      <td><input data-field="componentDescription" value="${escapeHtml(item.componentDescription || '')}"${lockedAttribute} /></td>
      <td><input data-field="measurementUnit" value="${escapeHtml(item.measurementUnit || '')}"${lockedAttribute} /></td>
      <td><input data-field="projectedQuantity" type="number" min="0.001" step="0.001" value="${escapeHtml(item.quantityPerMaterial ?? item.quantity ?? item.projectedQuantity ?? '')}"${lockedAttribute} /></td>
      <td><span class="record-derived-value">${formatQuantity(item.projectedQuantity ?? '')}</span></td>
      <td><input data-field="notIssuedQuantity" type="number" min="0" step="0.001" value="${escapeHtml(item.notIssuedQuantity ?? '')}"${lockedAttribute} /></td>
      <td><input data-field="notes" value="${escapeHtml(item.notes || '')}"${lockedAttribute} /></td>
      <td><button class="danger-button" data-remove-record-row type="button"${disabledAttribute}>Διαγραφή</button></td>
    </tr>
  `).join('');
}

function setCompositionLocked(modal, locked) {
  modal.querySelectorAll('[data-composition-row] input').forEach((input) => {
    input.readOnly = locked;
  });
  modal.querySelectorAll('[data-composition-row] [data-remove-record-row]').forEach((button) => {
    button.disabled = locked;
  });
  modal.querySelector('[data-add-composition-row]').disabled = locked;
  modal.querySelector('[data-save-composition]').disabled = locked;
  modal.querySelector('[data-edit-composition]').hidden = !locked;
  modal.querySelector('[data-composition-lock-state]').textContent = locked
    ? 'Η σύνθεση είναι κλειδωμένη.'
    : 'Η σύνθεση είναι σε επεξεργασία.';
}

function renderChangeSheetRows(entries, compositionItems, locked = false) {
  if (!entries.length) return '<tr class="empty-record-row"><td colspan="7" class="empty-table">Δεν έχουν καταχωρηθεί μεταβολές.</td></tr>';
  const lockedAttribute = locked ? ' disabled' : '';
  return entries.map((entry) => {
    const lineNumber = Number(entry.componentLineNumber || 1);
    const component = compositionItems[lineNumber - 1] || {};
    return `
      <tr data-change-row>
        <td>
          <select data-field="componentLineNumber"${lockedAttribute}>
            ${compositionItems
              .map(
                (item, index) =>
                  `<option value="${index + 1}" ${index + 1 === lineNumber ? 'selected' : ''}>${escapeHtml(item.componentNominalNumber || `ΓΡΑΜΜΗ ${index + 1}`)}</option>`
              )
              .join('')}
          </select>
        </td>
        <td><span class="record-derived-value" data-component-description>${escapeHtml(component.componentDescription || '')}</span></td>
        <td><input data-field="changeDate" type="date" value="${escapeHtml(entry.changeDate || '')}"${lockedAttribute} /></td>
        <td>
          <select data-field="movementType"${lockedAttribute}>
            <option value="ΧΡΕΩΣΗ" ${entry.movementType !== 'ΠΙΣΤΩΣΗ' ? 'selected' : ''}>ΧΡΕΩΣΗ</option>
            <option value="ΠΙΣΤΩΣΗ" ${entry.movementType === 'ΠΙΣΤΩΣΗ' ? 'selected' : ''}>ΠΙΣΤΩΣΗ</option>
          </select>
        </td>
        <td><input data-field="quantity" type="number" min="0.001" step="0.001" value="${escapeHtml(entry.quantity || '')}"${lockedAttribute} /></td>
        <td><input data-field="notes" value="${escapeHtml(entry.notes || '')}"${lockedAttribute} /></td>
        <td><button class="danger-button" data-remove-record-row type="button"${lockedAttribute}>Διαγραφή</button></td>
      </tr>
    `;
  }).join('');
}

function setChangeSheetLocked(modal, locked) {
  modal.querySelectorAll('[data-change-row] input, [data-change-row] select').forEach((control) => {
    control.disabled = locked;
  });
  modal.querySelectorAll('[data-change-row] [data-remove-record-row]').forEach((button) => {
    button.disabled = locked;
  });
  modal.querySelector('[data-add-change-row]').disabled = locked;
  modal.querySelector('[data-save-change-sheet]').disabled = locked;
  modal.querySelector('[data-edit-change-sheet]').hidden = !locked;
  modal.querySelector('[data-change-sheet-lock-state]').textContent = locked
    ? 'Το φύλλο μεταβολών είναι κλειδωμένο.'
    : 'Το φύλλο μεταβολών είναι σε επεξεργασία.';
}

function collectCompositionRows(modal) {
  return [...modal.querySelectorAll('[data-composition-row]')].map((row) => collectRecordRow(row));
}

function collectChangeSheetRows(modal) {
  return [...modal.querySelectorAll('[data-change-row]')].map((row) => collectRecordRow(row));
}

function collectRecordRow(row) {
  return Object.fromEntries([...row.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value]));
}

function getShareDetailControls(container) {
  return Object.fromEntries(
    [...container.querySelectorAll('[data-share-detail]')].map((input) => [input.dataset.shareDetail, input])
  );
}

function renderTransactionRows(transactions) {
  if (!transactions.length) {
    return '<tr><td colspan="8" class="empty-table">Δεν υπάρχουν δοσοληψίες για το έτος.</td></tr>';
  }

  return transactions
    .map(
      (transaction) => `
        <tr>
          <td>${transaction.serialNumber}</td>
          <td>${formatDate(transaction.date)}</td>
          <td>${escapeHtml(transaction.transactionUnit)}</td>
          <td>${escapeHtml(transaction.registryNumber)}</td>
          <td class="number-cell">${transaction.imports ? formatQuantity(transaction.imports) : ''}</td>
          <td class="number-cell">${transaction.exports ? formatQuantity(transaction.exports) : ''}</td>
          <td class="number-cell">${formatQuantity(transaction.balance)}</td>
          <td>${escapeHtml(transaction.notes)}</td>
        </tr>
      `
    )
    .join('');
}

function renderAssignmentRows(assignments) {
  if (!assignments.length) {
    return '<tr><td colspan="4" class="empty-table">Δεν υπάρχει υλικό σε Μερικές Διαχειρίσεις.</td></tr>';
  }

  return assignments
    .map(
      (assignment) => `
        <tr>
          <td>${escapeHtml(assignment.holderName)}</td>
          <td>${escapeHtml(assignment.department)}</td>
          <td class="number-cell">${formatQuantity(assignment.quantity)}</td>
          <td>${escapeHtml(assignment.notes)}</td>
        </tr>
      `
    )
    .join('');
}

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
  const pageStyle = document.createElement('style');
  pageStyle.dataset.materialFormPageStyle = 'true';
  pageStyle.textContent = `@page { size: A4 ${landscape ? 'landscape' : 'portrait'} !important; margin: 0; }`;
  document.head.appendChild(pageStyle);
  try {
    await window.appApi.print.currentDocument({ landscape });
  } finally {
    pageStyle.remove();
  }
}

export function renderCompositionDocument(card, settings) {
  const rowsPerPage = 16;
  const items = card.compositionItems || [];
  const pageCount = Math.max(1, Math.ceil(items.length / rowsPerPage));

  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const pageItems = items.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
    const isFirstPage = pageIndex === 0;
    const isLastPage = pageIndex === pageCount - 1;
    return `
      <article class="composition-document-page print-document-area">
        ${isFirstPage ? renderCompositionDocumentHeader(card, settings) : ''}
        ${renderCompositionDocumentTable(pageItems, pageIndex * rowsPerPage)}
        ${isLastPage ? renderCompositionDocumentFooter() : ''}
        <div class="material-form-page-number">Σελίδα ${pageIndex + 1} από ${pageCount}</div>
      </article>
    `;
  }).join('');
}

function renderCompositionDocumentHeader(card, settings) {
  return `
    <div class="material-form-code">ΔΥΠ/190</div>
    <h1>ΚΑΤΑΣΤΑΣΗ ΣΥΝΘΕΣΕΩΣ</h1>
    <div class="composition-document-details">
      <p class="composition-field-one"><span>1.</span> ΑΡΙΘΜΟΣ ΣΥΝΘΕΣΕΩΣ:
        <strong>${escapeHtml(card.share.shareNumber)}</strong></p>
      <div class="composition-details-row">
        <p><span>2.</span> ΑΡΙΘΜ. ΗΜΕΡΟΜ. ΔΙΚΑΙΟΛ. ΧΟΡΗΓΗΣΕΩΣ: ................................</p>
        <p><span>3.</span> ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ:
          <strong>${escapeHtml(settings?.serviceInfo?.serviceName || '')}</strong></p>
      </div>
      <p class="composition-title"><span>4.</span>
        ΣΥΝΘΕΣΗ (Α/Ο <strong>${escapeHtml(card.share.nominalNumber)}</strong>
        - ΠΕΡΙΓΡΑΦΗ <strong>${escapeHtml(card.share.description)}</strong>
        - ΤΙΤΛΟΣ ΣΥΛΛΟΓΗΣ)</p>
    </div>
  `;
}

function renderCompositionDocumentTable(items, startIndex) {
  return `
    <table class="composition-document-table">
      <thead>
        <tr>
          <th rowspan="3">Α/Α</th>
          <th rowspan="3">ΑΡΙΘΜΟΣ<br />ΟΝΟΜΑΣΤΙΚΟΥ</th>
          <th rowspan="3">ΠΕΡΙΓΡΑΦΗ</th>
          <th rowspan="3">ΜΟΝΑΔΑ<br />ΜΕΤΡΗΣΗΣ</th>
          <th colspan="4">ΠΟΣΟΤΗΤΑ</th>
        </tr>
        <tr>
          <th colspan="2">ΠΡΟΒΛΕΠΟΜ.</th>
          <th colspan="2">ΜΗ ΧΟΡΗΓΗΘΕΙΣΑ</th>
        </tr>
        <tr>
          <th>ΑΡΙΘ.</th><th>ΟΛΟΓΡΑΦ.</th><th>ΑΡΙΘ.</th><th>ΟΛΟΓΡΑΦ.</th>
        </tr>
        <tr class="composition-column-numbers">
          <th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th>
        </tr>
      </thead>
      <tbody>
        ${items.map((item, index) => renderCompositionDocumentRow(item, startIndex + index + 1)).join('')}
      </tbody>
    </table>
  `;
}

function renderCompositionDocumentRow(item, rowNumber) {
  return `
    <tr>
      <td>${rowNumber}</td>
      <td>${escapeHtml(item.componentNominalNumber)}</td>
      <td class="material-description-cell">${escapeHtml(item.componentDescription)}</td>
      <td>${escapeHtml(item.measurementUnit)}</td>
      <td>${formatQuantity(item.projectedQuantity)}</td>
      <td>${escapeHtml(numberToGreekWords(item.projectedQuantity))}</td>
      <td>${formatQuantity(item.notIssuedQuantity)}</td>
      <td>${escapeHtml(numberToGreekWords(item.notIssuedQuantity))}</td>
    </tr>
  `;
}

export function renderCompositionDocumentFooter() {
  return `
    <div class="composition-document-footer">
      <div class="composition-footer-field composition-footer-field-13">
        <span><b>13.</b> ΧΟΡΗΓΟΥΣΑ ΜΟΝΑΔΑ</span>
      </div>
      <div class="composition-footer-field composition-footer-field-14">
        <span><b>14.</b> ΠΑΡΑΛΑΜΒΑΝΟΥΣΑ ΜΟΝΑΔΑ</span>
        <small>Αριθμ. Ημερ. Ευρετ. Δικ. Εξωτ. Δοσ.</small>
        <small class="composition-footer-reference">......../........................ 20....</small>
      </div>
    </div>
  `;
}

export function numberToGreekWords(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '';
  if (!Number.isInteger(number)) {
    const [integerPart, decimalPart] = String(number).split('.');
    return `${integerToGreekWords(Number(integerPart))} ΚΟΜΜΑ ${decimalPart
      .split('')
      .map((digit) => integerToGreekWords(Number(digit)))
      .join(' ')}`;
  }
  return integerToGreekWords(number);
}

function integerToGreekWords(value) {
  const number = Math.max(0, Math.trunc(value));
  const units = ['', 'ΕΝΑ', 'ΔΥΟ', 'ΤΡΙΑ', 'ΤΕΣΣΕΡΑ', 'ΠΕΝΤΕ', 'ΕΞΙ', 'ΕΠΤΑ', 'ΟΚΤΩ', 'ΕΝΝΕΑ'];
  const teens = ['ΔΕΚΑ', 'ΕΝΤΕΚΑ', 'ΔΩΔΕΚΑ', 'ΔΕΚΑΤΡΙΑ', 'ΔΕΚΑΤΕΣΣΕΡΑ', 'ΔΕΚΑΠΕΝΤΕ', 'ΔΕΚΑΕΞΙ', 'ΔΕΚΑΕΠΤΑ', 'ΔΕΚΑΟΚΤΩ', 'ΔΕΚΑΕΝΝΕΑ'];
  const tens = ['', '', 'ΕΙΚΟΣΙ', 'ΤΡΙΑΝΤΑ', 'ΣΑΡΑΝΤΑ', 'ΠΕΝΗΝΤΑ', 'ΕΞΗΝΤΑ', 'ΕΒΔΟΜΗΝΤΑ', 'ΟΓΔΟΝΤΑ', 'ΕΝΕΝΗΝΤΑ'];
  const hundreds = ['', 'ΕΚΑΤΟΝ', 'ΔΙΑΚΟΣΙΑ', 'ΤΡΙΑΚΟΣΙΑ', 'ΤΕΤΡΑΚΟΣΙΑ', 'ΠΕΝΤΑΚΟΣΙΑ', 'ΕΞΑΚΟΣΙΑ', 'ΕΠΤΑΚΟΣΙΑ', 'ΟΚΤΑΚΟΣΙΑ', 'ΕΝΝΙΑΚΟΣΙΑ'];

  if (number === 0) return 'ΜΗΔΕΝ';
  if (number >= 1000000) return String(number);

  const parts = [];
  const thousandsValue = Math.floor(number / 1000);
  let remainder = number % 1000;
  if (thousandsValue) {
    parts.push(thousandsValue === 1 ? 'ΧΙΛΙΑ' : `${integerToGreekWords(thousandsValue)} ΧΙΛΙΑΔΕΣ`);
  }
  if (remainder >= 100) {
    parts.push(hundreds[Math.floor(remainder / 100)]);
    remainder %= 100;
  }
  if (remainder >= 20) {
    parts.push(tens[Math.floor(remainder / 10)]);
    remainder %= 10;
  } else if (remainder >= 10) {
    parts.push(teens[remainder - 10]);
    remainder = 0;
  }
  if (remainder > 0) parts.push(units[remainder]);
  return parts.join(' ');
}

export function renderChangeSheetDocument(card) {
  const rowCount = Math.max(10, card.compositionItems.length);
  const items = Array.from({ length: rowCount }, (_unused, index) => card.compositionItems[index] || null);
  const changeEntries = card.changeSheetEntries || [];
  const chargeColumns = collectChangeColumns(changeEntries, 'ΧΡΕΩΣΗ');
  const creditColumns = collectChangeColumns(changeEntries, 'ΠΙΣΤΩΣΗ');
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
            .map((item, index) =>
              renderChangeSheetDocumentRow(
                item,
                changeEntries.filter((entry) => Number(entry.componentLineNumber || 1) === index + 1),
                chargeColumns.map((column) => column.key),
                creditColumns.map((column) => column.key)
              )
            )
            .join('')}
        </tbody>
      </table>
    </article>
  `;
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
    const label = column.reference
      ? column.reference === 'ΑΠΟΓΡΑΦΗ'
        ? `${column.reference} ${date}`
        : `${column.reference}/${date}`
      : date;
    return `<th class="vertical-table-heading">${escapeHtml(label)}</th>`;
  }).join('');
}

function formatChangeSheetDate(value) {
  const [year, month, day] = String(value || '').slice(0, 10).split('-');
  return year && month && day ? `${day.padStart(2, '0')}-${month.padStart(2, '0')}-${year}` : '';
}

function renderChangeSheetDocumentRow(item, entries, chargeKeys, creditKeys) {
  const chargeByDate = sumChangesByColumn(entries, 'ΧΡΕΩΣΗ');
  const creditByDate = sumChangesByColumn(entries, 'ΠΙΣΤΩΣΗ');
  const totalCharge = [...chargeByDate.values()].reduce((sum, value) => sum + value, 0);
  const totalCredit = [...creditByDate.values()].reduce((sum, value) => sum + value, 0);
  const numericDifference = totalCharge - totalCredit;
  const chargeCells = Array.from({ length: 10 }, (_unused, index) => {
    const quantity = chargeByDate.get(chargeKeys[index]);
    return `<td>${quantity ? formatQuantity(quantity) : ''}</td>`;
  }).join('');
  const creditCells = Array.from({ length: 10 }, (_unused, index) => {
    const quantity = creditByDate.get(creditKeys[index]);
    return `<td>${quantity ? formatQuantity(quantity) : ''}</td>`;
  }).join('');
  return `
    <tr>
      <td>${item ? escapeHtml(item.componentNominalNumber) : ''}</td>
      <td>${item ? escapeHtml(item.componentDescription) : ''}</td>
      ${chargeCells}
      ${creditCells}
      <td>${numericDifference > 0 ? formatQuantity(numericDifference) : ''}</td>
      <td>${numericDifference < 0 ? formatQuantity(Math.abs(numericDifference)) : ''}</td>
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

export function renderSharePrintDocument(card, options = {}) {
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
        ${options.issuerName
          ? shareDocumentOverlay(options.issuerName, 4.1, 19.1, 28.2, 1.6, 'share-issuer-name-overlay')
          : ''}
        ${options.issuerRank
          ? shareDocumentOverlay(options.issuerRank, 4.1, 20.7, 28.2, 1.6, 'share-issuer-rank-overlay')
          : ''}
        ${shareDocumentOverlay(card.share.nominalNumber, 33.5, 14.2, 34.0, 2.6)}
        ${shareDocumentOverlay(card.share.shareNumber, 69.5, 14.2, 19.0, 2.6)}
        ${shareDocumentOverlay(card.share.description, 33.5, 18.6, 34.0, 2.8, 'material-description-overlay')}
        ${shareDocumentOverlay(card.share.materialCode, 70.0, 22.9, 18.0, 2.6)}
        ${shareDocumentOverlay(card.share.measurementUnit, 4.0, 30.6, 28.4, 2.6)}
        ${shareDocumentOverlay(card.share.unitPrice ? formatQuantity(card.share.unitPrice) : '', 55.0, 30.6, 16.0, 2.6)}
        ${pageIndex === 0 && card.openingTransfer?.inventoryDate
          ? shareDocumentOverlay(
            `ΑΠΟ ΜΕΤΑΦΟΡΑ - ΑΠΟΓΡΑΦΗ ${formatDate(card.openingTransfer.inventoryDate)}`,
            3.9,
            64.45,
            86.2,
            1.75,
            'share-opening-inventory-overlay'
          )
          : shareDocumentOverlay(
            'ΑΠΟ ΜΕΤΑΦΟΡΑ',
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

function renderOfficialShareBackPage(rows, openingBalance, transferBalance) {
  const blankRows = Array.from({ length: Math.max(0, 32 - rows.length) }, () => null);
  return `
    <article class="official-share-page official-share-back-page print-document-area">
      <div class="official-share-back-sheet">
        <div class="official-share-back-code">Κ 2309/ΔΥΠ</div>
        <h2>ΜΕΡΙΔΑ ΥΛΙΚΟΥ - ΔΕΛΤΙΟ ΥΠΟΛΟΙΠΩΝ</h2>
        <table class="official-share-back-table">
          <thead>
            <tr>
              <th>Α/Α</th><th>ΗΜΕΡ</th><th>ΧΡΕΩΣΗ<br />Ή ΠΙΣΤΩΣΗ</th>
              <th>ΑΡΙΘΜ<br />ΕΥΡΕΤΗΡΙΟΥ</th><th>ΕΙΣΑΓΩΓΕΣ</th><th>ΕΞΑΓΩΓΕΣ</th>
              <th>ΥΠΟΛΟΙΠΟ</th><th>ΠΑΡΣΕΙΣ</th>
            </tr>
            <tr class="official-share-back-column-numbers">
              <th>22</th><th>23</th><th>24</th><th>25</th><th>26</th><th>27</th><th>28</th><th>29</th>
            </tr>
          </thead>
          <tbody>
            <tr class="official-share-back-transfer-row">
              <td colspan="6">ΑΠΟ ΜΕΤΑΦΟΡΑ</td>
              <td>${escapeHtml(openingBalance === '' || openingBalance === null || openingBalance === undefined
                ? ''
                : formatQuantity(openingBalance))}</td><td></td>
            </tr>
            ${[...rows, ...blankRows].map((item) => item
              ? `<tr>
                  <td>${escapeHtml(item.serialNumber)}</td>
                  <td>${escapeHtml(formatDate(item.date))}</td>
                  <td>${escapeHtml(item.transactionUnit)}</td>
                  <td>${escapeHtml(item.registryNumber)}</td>
                  <td>${escapeHtml(item.imports ? formatQuantity(item.imports) : '')}</td>
                  <td>${escapeHtml(item.exports ? formatQuantity(item.exports) : '')}</td>
                  <td>${escapeHtml(formatQuantity(item.balance))}</td>
                  <td></td>
                </tr>`
              : '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>')
              .join('')}
            <tr class="official-share-back-transfer-row official-share-back-carry-row">
              <td colspan="6">ΓΙΑ ΜΕΤΑΦΟΡΑ</td>
              <td>${escapeHtml(transferBalance === '' ? '' : formatQuantity(transferBalance))}</td><td></td>
            </tr>
          </tbody>
        </table>
        <table class="official-share-back-summary">
          <tbody>
            <tr><th>30. ΤΜΗΜΑΤΑ</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><th>31. ΠΡΟΒΛΕΠΟΜΕΝΑ</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><th>32. ΥΠΑΡΧΟΝΤΑ</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
            <tr><th>33. ΔΙΑΦΟΡΑ</th><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
          </tbody>
        </table>
        <div class="official-share-back-footer">ΕΦΕΔ 202</div>
      </div>
    </article>
  `;
}

export function renderShareBackTemplate() {
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

function collectMaterialTypes(shares, materialCategories) {
  const values = new Set();

  for (const category of materialCategories || []) {
    if (category.name) {
      values.add(category.name);
    }
  }

  for (const share of shares) {
    if (share.materialType) {
      values.add(share.materialType);
    }
  }

  return [...values].sort((a, b) => a.localeCompare(b, 'el'));
}

function includes(value, filter) {
  if (!filter) return true;
  const normalizedValue = normalize(value);
  const compactFilter = compactSearchText(filter);
  return normalizedValue.includes(filter) ||
    Boolean(compactFilter && compactSearchText(normalizedValue).includes(compactFilter));
}

function normalize(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('el-GR')
    .replace(/ς/g, 'σ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactSearchText(value) {
  return value.replace(/[^\p{L}\p{N}]+/gu, '');
}

export function filterAndRankShares(shares, filters = {}) {
  const normalizedFilters = Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, normalize(value)])
  );
  const descriptionFilter = normalizedFilters.description;

  return shares
    .map((share, originalIndex) => ({ share, originalIndex }))
    .filter(({ share }) => {
      const materialMatch = !normalizedFilters.materialType ||
        normalize(share.materialType) === normalizedFilters.materialType;
      return (
        materialMatch &&
        includes(share.shareNumber, normalizedFilters.shareNumber) &&
        includes(share.nominalNumber, normalizedFilters.nominalNumber) &&
        includes(share.description, descriptionFilter)
      );
    })
    .sort((left, right) => {
      if (!descriptionFilter) return left.originalIndex - right.originalIndex;

      const rankDifference =
        descriptionMatchRank(left.share.description, descriptionFilter) -
        descriptionMatchRank(right.share.description, descriptionFilter);
      if (rankDifference) return rankDifference;

      const descriptionOrder = String(left.share.description || '')
        .localeCompare(String(right.share.description || ''), 'el', { sensitivity: 'base' });
      return descriptionOrder || left.originalIndex - right.originalIndex;
    })
    .map(({ share }) => share);
}

function descriptionMatchRank(description, filter) {
  const normalizedDescription = normalize(description);
  if (normalizedDescription === filter) return 0;
  if (normalizedDescription.startsWith(filter)) return 1;

  const words = normalizedDescription.match(/[\p{L}\p{N}]+/gu) || [];
  if (words.some((word) => word.startsWith(filter))) return 2;
  if (normalizedDescription.includes(filter)) return 3;
  return 4;
}

export function renderRows(shares, compositionOnly = false) {
  if (!shares.length) {
    return `
      <tr>
        <td colspan="${compositionOnly ? 4 : 9}" class="empty-table">Δεν βρέθηκαν μερίδες.</td>
      </tr>
    `;
  }

  return shares
    .map(
      (share) => compositionOnly ? `
        <tr data-share-id="${share.id}">
          <td class="strong-cell">${escapeHtml(share.shareNumber)}</td>
          <td>${escapeHtml(share.nominalNumber)}</td>
          <td class="share-description-cell">${escapeHtml(share.description)}</td>
          <td class="number-cell">${formatQuantity(share.accountingBalance)}</td>
        </tr>
      ` : `
        <tr data-share-id="${share.id}">
          <td class="strong-cell">${escapeHtml(share.shareNumber)}</td>
          <td>${escapeHtml(share.nominalNumber)}</td>
          <td>${escapeHtml(share.mainMaterialNumber)}</td>
          <td class="share-description-cell">${escapeHtml(share.description)}</td>
          <td>${escapeHtml(share.materialType)}</td>
          <td class="number-cell">${formatQuantity(share.accountingBalance)}</td>
          <td class="number-cell">${formatQuantity(share.chargedQuantity)}</td>
          <td class="number-cell ${share.statusTone}">${formatDifference(share.differenceQuantity)}</td>
          <td><span class="status-pill ${share.statusTone}">${escapeHtml(share.status)}</span></td>
        </tr>
      `
    )
    .join('');
}

function formatQuantity(value) {
  return Number(value).toLocaleString('el-GR', {
    maximumFractionDigits: 3
  });
}

function formatSignedQuantity(value) {
  const number = Number(value);
  const formatted = formatQuantity(Math.abs(number));

  if (number > 0) {
    return `+${formatted}`;
  }

  if (number < 0) {
    return `-${formatted}`;
  }

  return '0';
}

function formatDifference(value) {
  return formatQuantity(Math.abs(Number(value)));
}

function formatDate(value) {
  if (!value) {
    return '';
  }

  return new Date(value).toLocaleDateString('el-GR');
}

function formatDateWithDashes(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}-${month}-${year}` : value;
}

function pathToFileUrl(value) {
  if (!value) return '';
  const normalized = String(value).replace(/\\/g, '/');
  return `file:///${normalized.replace(/^\/+/, '')}`;
}
