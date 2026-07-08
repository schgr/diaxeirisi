import { escapeHtml } from '../components/forms.js';
import {
  compareShareNumbers,
  displaySupportStatus,
  findShareByNominal,
  findShareByNumber,
  formatDate,
  formatQuantity,
  isCommerceUnit,
  normalize
} from './shared.js';

export async function maybeSuggestShareNumber(transactionsApi, referenceData, controls, showToast) {
  const shareNumber = controls.shareNumber.value.trim();
  const canSuggest =
    !shareNumber &&
    controls.nominalNumber.value.trim() &&
    Number(controls.quantity.value) > 0 &&
    controls.transactionType.value &&
    controls.unit.value.trim() &&
    controls.materialType.value;

  if (!canSuggest || controls.shareNumber.dataset.suggestionAsked === 'true') {
    return;
  }

  controls.shareNumber.dataset.suggestionAsked = 'true';
  const suggestion = await transactionsApi.suggestShareNumber(controls.materialType.value);
  const accepted = window.confirm(
    `Δεν βρέθηκε αντιστοιχία μερίδας. Προτείνεται ο αριθμός ${suggestion.shareNumber}. Θέλεις να χρησιμοποιηθεί;`
  );

  if (accepted) {
    controls.shareNumber.value = suggestion.shareNumber;
    controls.shareNumber.dataset.proposedShareCreated = 'true';
    return;
  }

  showToast('Μπορείς να πληκτρολογήσεις δικό σου αριθμό μερίδας.', 'error');
}

export function getControls(container) {
  return {
    date: container.querySelector('#addy-date'),
    unit: container.querySelector('#addy-unit'),
    notes: container.querySelector('#addy-notes'),
    justificationReference: container.querySelector('#addy-justification-reference'),
    shareNumber: container.querySelector('#addy-share-number'),
    nominalNumber: container.querySelector('#addy-nominal-number'),
    description: container.querySelector('#addy-description'),
    quantity: container.querySelector('#addy-quantity'),
    unitPrice: container.querySelector('#addy-unit-price'),
    measurementUnit: container.querySelector('#addy-measurement-unit'),
    transactionType: container.querySelector('#addy-transaction-type'),
    materialType: container.querySelector('#addy-material-type'),
    addItem: container.querySelector('#addy-add-item'),
    save: container.querySelector('#addy-save'),
    limitText: container.querySelector('#addy-limit-text'),
    body: container.querySelector('#addy-items-body')
  };
}

export function getExhpControls(container) {
  return {
    shareNumber: container.querySelector('#exhp-share-number'),
    nominalNumber: container.querySelector('#exhp-nominal-number'),
    description: container.querySelector('#exhp-description'),
    measurementUnit: container.querySelector('#exhp-measurement-unit'),
    quantity: container.querySelector('#exhp-quantity'),
    transactionType: container.querySelector('#exhp-transaction-type'),
    addItem: container.querySelector('#exhp-add-item')
  };
}

export function applyExhpShareDefaults(controls, share) {
  controls.nominalNumber.value = share ? share.nominalNumber : '';
  controls.description.value = share ? share.description : '';
  controls.measurementUnit.value = share ? share.measurementUnit : '';
}

export function clearExhpLine(controls) {
  controls.shareNumber.value = '';
  controls.nominalNumber.value = '';
  controls.description.value = '';
  controls.measurementUnit.value = '';
  controls.quantity.value = '';
  controls.transactionType.value = '';
}

export function renderExhpEntryState(container, state) {
  container.querySelector('#exhp-items-view').innerHTML = renderExhpEntryTables(state.exhpItems);
  container.querySelector('#exhp-limit-text').textContent = `${state.exhpItems.length} καταχωρήσεις`;
  container.querySelector('#exhp-save').disabled = !state.exhpItems.length;
}

export function renderExhpEntryTables(items) {
  return ['Χρέωση', 'Πίστωση']
    .map((transactionType) => {
      const rows = items
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => item.transactionType === transactionType);
      return `
        <section class="exhp-entry-section">
          <h4>${transactionType} Διαχειρίσεως</h4>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Αριθμός Μερίδας</th>
                  <th>Αριθμός Ονομαστικού</th>
                  <th>Περιγραφή</th>
                  <th>Μονάδα Μέτρησης</th>
                  <th>Ποσότητα</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length
                    ? rows
                        .map(
                          ({ item, index }) => `
                            <tr>
                              <td>${escapeHtml(item.shareNumber)}</td>
                              <td>${escapeHtml(item.nominalNumber)}</td>
                              <td class="material-description-cell">${escapeHtml(item.description)}</td>
                              <td>${escapeHtml(item.measurementUnit)}</td>
                              <td>${formatQuantity(item.quantity)}</td>
                              <td><button class="danger-button" data-remove-exhp-item="${index}" type="button">Διαγραφή</button></td>
                            </tr>
                          `
                        )
                        .join('')
                    : '<tr><td colspan="6" class="empty-table">Δεν υπάρχουν υλικά.</td></tr>'
                }
              </tbody>
            </table>
          </div>
        </section>
      `;
    })
    .join('');
}

export function canAddItem(controls, state) {
  return (
    state.items.length < 10 &&
    controls.unit.value.trim() &&
    controls.shareNumber.value.trim() &&
    controls.nominalNumber.value.trim() &&
    controls.description.value.trim() &&
    Number(controls.quantity.value) > 0 &&
    (!isCommerceUnit(controls.materialType.value) || controls.unitPrice.value.trim()) &&
    controls.measurementUnit.value &&
    controls.transactionType.value &&
    (controls.transactionType.value !== 'Χρέωση' || controls.materialType.value) &&
    hasValidShareForAdd(controls)
  );
}

export function hasValidShareForAdd(controls) {
  return Boolean(controls.shareNumber.value.trim());
}

export function updateAddButton(controls, state) {
  const isCharge = controls.transactionType.value === 'Χρέωση';
  const isCredit = controls.transactionType.value === 'Πίστωση';
  const isCommerceMaterial = isCharge && isCommerceUnit(controls.materialType.value);
  controls.justificationReference.disabled = !isCharge;
  if (!isCharge) {
    controls.justificationReference.value = '';
  }
  controls.measurementUnit.disabled = isCredit && Boolean(findCurrentShare(controls)?.measurementUnit);
  controls.materialType.disabled = !isCharge;
  if (isCharge && !controls.materialType.value) {
    const share = findShareByNumber(controls.referenceData.shares, controls.shareNumber.value);
    if (share) {
      controls.materialType.value = share.materialType;
    }
  } else if (!isCharge) {
    controls.materialType.value = '';
  }
  controls.unitPrice.disabled = !isCommerceMaterial;
  if (!isCommerceMaterial) {
    controls.unitPrice.value = '';
  }
  controls.addItem.disabled = !canAddItem(controls, state);
  controls.save.disabled = !state.items.length;
}

export function applyShareDefaults(controls, share) {
  controls.nominalNumber.value = share.nominalNumber || controls.nominalNumber.value;
  controls.description.value = share.description || '';
  controls.materialType.value = share.materialType || '';
  if (share.measurementUnit) {
    controls.measurementUnit.value = share.measurementUnit;
  }
}

export function findCurrentShare(controls) {
  return (
    findShareByNumber(controls.referenceData.shares, controls.shareNumber.value) ||
    findShareByNominal(controls.referenceData.shares, controls.nominalNumber.value)
  );
}

export function renderSavedAddyRows(documents) {
  if (!documents.length) {
    return '<tr><td colspan="8" class="empty-table">Δεν υπάρχουν καταχωρημένα ΑΔΔΥ.</td></tr>';
  }

  return documents
    .map(
      (documentItem) => `
        <tr>
          <td>${documentItem.id}</td>
          <td>${formatDate(documentItem.documentDate)}</td>
          <td>${escapeHtml(documentItem.transactionUnit)}</td>
          <td>${escapeHtml(documentItem.transactionType)}</td>
          <td>${escapeHtml(documentItem.nominalNumber)}</td>
          <td>${escapeHtml(documentItem.description)}</td>
          <td class="number-cell">${formatQuantity(documentItem.quantity)}</td>
          <td class="row-actions">
            <button class="secondary-button" data-view-addy-document="${documentItem.id}" type="button" ${documentItem.canPrint ? '' : 'disabled'}>Προβολή</button>
          </td>
        </tr>
      `
    )
    .join('');
}

export function renderSavedExhpRows(documents) {
  if (!documents.length) {
    return '<tr><td colspan="6" class="empty-table">Δεν υπάρχουν καταχωρημένες ΕΧΠ.</td></tr>';
  }

  return documents
    .map(
      (documentItem) => `
        <tr>
          <td>${documentItem.registryNumber}</td>
          <td>${formatDate(documentItem.documentDate)}</td>
          <td>${escapeHtml(documentItem.issueReason)}</td>
          <td>${escapeHtml(documentItem.approvalReference)}</td>
          <td><span class="status-pill ${documentItem.supportStatus === 'Πλήρης για ΕΥΣ' ? 'balanced' : 'pending'}">${escapeHtml(displaySupportStatus(documentItem.supportStatus))}</span></td>
          <td class="row-actions"><button class="secondary-button" data-view-exhp-document="${documentItem.id}" type="button">Προβολή</button></td>
        </tr>
      `
    )
    .join('');
}

export function renderState(container, state) {
  const controls = getControls(container);
  controls.body.innerHTML = renderAddyRows(state.items);
  controls.limitText.textContent = `${state.items.length}/10 καταχωρήσεις`;
  controls.save.disabled = !state.items.length;
}

export function renderAddyRows(items) {
  if (!items.length) {
    return '<tr><td colspan="11" class="empty-table">Δεν έχουν προστεθεί υλικά.</td></tr>';
  }

  return items
    .map(
      (item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td class="strong-cell">${escapeHtml(item.shareNumber)}</td>
          <td>${escapeHtml(item.nominalNumber)}</td>
          <td>${escapeHtml(item.description)}</td>
          <td class="number-cell">${formatQuantity(item.quantity)}</td>
          <td class="number-cell">${item.unitPrice ? formatQuantity(item.unitPrice) : ''}</td>
          <td>${escapeHtml(item.measurementUnit)}</td>
          <td>${escapeHtml(item.transactionType)}</td>
          <td>${escapeHtml(item.transactionUnit)}</td>
          <td>${escapeHtml(item.materialType)}</td>
          <td><button class="danger-button" data-remove-addy-item="${index}" type="button">Διαγραφή</button></td>
        </tr>
      `
    )
    .join('');
}

export function clearLineControls(controls) {
  controls.shareNumber.value = '';
  controls.shareNumber.dataset.suggestionAsked = 'false';
  controls.shareNumber.dataset.proposedShareCreated = 'false';
  controls.nominalNumber.value = '';
  controls.description.value = '';
  controls.quantity.value = '';
  controls.unitPrice.value = '';
  controls.unitPrice.disabled = true;
  controls.measurementUnit.value = '';
  controls.transactionType.value = '';
  controls.materialType.value = '';
}

export function openAddyCompositionDialog(share, addyQuantity) {
  return new Promise((resolve) => {
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <section class="material-card-modal addy-composition-modal" role="dialog" aria-modal="true">
        <header class="material-card-header">
          <div>
            <p class="eyebrow">ΠΙΣΤΩΣΗ ΑΔΔΥ</p>
            <h2>Σύνθεση ${escapeHtml(share.description)}</h2>
            <p class="muted">Συμπλήρωσε τη μη χορηγηθείσα ποσότητα για κάθε είδος.</p>
          </div>
        </header>
        <div class="card-table-wrap">
          <table class="editable-records-table">
            <thead>
              <tr>
                <th>Αριθμός Ονομαστικού</th>
                <th>Περιγραφή</th>
                <th>Μ/Μ</th>
                <th>Προβλεπόμενη Ποσότητα</th>
                <th>Μη Χορηγηθείσα</th>
              </tr>
            </thead>
            <tbody>
              ${share.composition.map((item) => {
                const projectedQuantity = Number(item.quantityPerMaterial || 0) * addyQuantity;
                return `
                  <tr data-addy-composition-row
                      data-nominal="${escapeHtml(item.componentNominalNumber)}"
                      data-description="${escapeHtml(item.componentDescription)}"
                      data-unit="${escapeHtml(item.measurementUnit)}"
                      data-projected="${projectedQuantity}"
                      data-notes="${escapeHtml(item.notes)}">
                    <td>${escapeHtml(item.componentNominalNumber)}</td>
                    <td class="material-description-cell">${escapeHtml(item.componentDescription)}</td>
                    <td>${escapeHtml(item.measurementUnit)}</td>
                    <td class="number-cell">${formatQuantity(projectedQuantity)}</td>
                    <td><input data-not-issued type="number" min="0" max="${projectedQuantity}" step="0.001" value="0" /></td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <div class="addy-save-row">
          <button class="secondary-button" data-cancel-composition type="button">Ακύρωση</button>
          <button class="primary-button" data-confirm-composition type="button">Καταχώριση Σύνθεσης</button>
        </div>
      </section>
    `;

    const close = (result) => {
      modal.remove();
      resolve(result);
    };
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-cancel-composition]')) {
        close(null);
        return;
      }
      if (!event.target.closest('[data-confirm-composition]')) return;

      const rows = [...modal.querySelectorAll('[data-addy-composition-row]')];
      const invalid = rows.some((row) => {
        const value = Number(row.querySelector('[data-not-issued]').value);
        return !Number.isFinite(value) || value < 0 || value > Number(row.dataset.projected);
      });
      if (invalid) return;

      close(rows.map((row) => ({
        componentNominalNumber: row.dataset.nominal,
        componentDescription: row.dataset.description,
        measurementUnit: row.dataset.unit,
        projectedQuantity: Number(row.dataset.projected),
        notIssuedQuantity: Number(row.querySelector('[data-not-issued]').value || 0),
        notes: row.dataset.notes
      })));
    });
    window.document.body.appendChild(modal);
  });
}
