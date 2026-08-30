import { compareShareNumbers } from '../shared.js';
import {
  exceedsDepartmentCreditBalance,
  formatAddyShareBalance
} from './addyCalculations.js';

export function restoreAddyEntryFocus(controls) {
  window.requestAnimationFrame(() => {
    controls.unit.focus({ preventScroll: true });
  });
}

export function openAddyEditDialog(documentData, transactionsApi, showToast, onSaved) {
  const modal = window.document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal addy-edit-modal">
      <header class="material-card-header">
        <div>
          <p class="eyebrow">ΚΑΤΑΧΩΡΗΜΕΝΟ ΑΔΔΥ</p>
          <h2>Επεξεργασία ΑΔΔΥ</h2>
        </div>
        <button class="secondary-button" data-close-addy-edit type="button">Κλείσιμο</button>
      </header>
      <form data-addy-edit-form class="stacked-form">
        <div class="inline-form">
          <label class="field">
            <span>Αριθμός ΑΔΔΥ</span>
            <input data-addy-edit-id type="number" min="1" step="1" value="${Number(documentData.id)}" required />
          </label>
          <label class="field">
            <span>Ημερομηνία</span>
            <input data-addy-edit-date type="date" value="${documentData.documentDate}" required />
          </label>
          <button class="primary-button" type="submit">Αποθήκευση</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Μερίδα</th>
                <th>Αριθμός Ονομαστικού</th>
                <th>Περιγραφή</th>
                <th>Είδος</th>
                <th>Ποσότητα</th>
                <th>Ενέργεια</th>
              </tr>
            </thead>
            <tbody>
              ${documentData.items.map((item) => `
                <tr>
                  <td>${escapeAddyEditHtml(item.shareNumber)}</td>
                  <td>${escapeAddyEditHtml(item.nominalNumber)}</td>
                  <td>${escapeAddyEditHtml(item.description)}</td>
                  <td>${escapeAddyEditHtml(item.transactionType)}</td>
                  <td>
                    <input
                      data-addy-edit-quantity="${Number(item.id)}"
                      data-original-quantity="${Number(item.quantity)}"
                      type="number"
                      min="0.000001"
                      step="any"
                      value="${Number(item.quantity)}"
                      required
                    />
                  </td>
                  <td><button class="danger-button" data-remove-addy-edit-item="${Number(item.id)}" type="button">Διαγραφή</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        <label class="field">
          <span>Πληροφορίες</span>
          <textarea data-addy-edit-notes rows="4">${escapeAddyEditHtml(documentData.notes || '')}</textarea>
        </label>
        <div class="row-actions">
          <button class="secondary-button" data-close-addy-edit type="button">Ακύρωση</button>
        </div>
      </form>
    </section>
  `;

  const close = () => modal.remove();
  const removedItemIds = new Set();
  modal.querySelectorAll('[data-close-addy-edit]').forEach((button) => {
    button.addEventListener('click', close);
  });
  modal.addEventListener('click', async (event) => {
    if (event.target === modal) close();
    const removeButton = event.target.closest('[data-remove-addy-edit-item]');
    if (!removeButton) return;
    const remainingRows = modal.querySelectorAll('[data-addy-edit-quantity]');
    if (remainingRows.length <= 1) {
      showToast('Το ΑΔΔΥ πρέπει να περιέχει τουλάχιστον ένα υλικό.', 'error');
      return;
    }
    const accepted = await confirmAddyAction('Να διαγραφεί μόνο αυτό το υλικό από το ΑΔΔΥ και από την αντίστοιχη Μερίδα Υλικού;');
    if (!accepted) return;
    removedItemIds.add(Number(removeButton.dataset.removeAddyEditItem));
    removeButton.closest('tr')?.remove();
  });
  modal.querySelector('[data-addy-edit-form]').addEventListener('submit', async (event) => {
    event.preventDefault();
    const quantityInputs = [...modal.querySelectorAll('[data-addy-edit-quantity]')];
    const quantityChanged = quantityInputs.some(
      (input) => Number(input.value) !== Number(input.dataset.originalQuantity)
    );
    const newId = Number(modal.querySelector('[data-addy-edit-id]').value);
    const newDate = modal.querySelector('[data-addy-edit-date]').value;
    const idChanged = newId !== Number(documentData.id);
    const dateChanged = newDate !== documentData.documentDate;

    if (quantityChanged) {
      const accepted = await confirmAddyAction(
        'Αυτή η ενέργεια θα αλλάξει την Ποσότητα από το ΑΔΔΥ και τις κινήσεις από τις Μερίδες Υλικού. Να προχωρήσω;'
      );
      if (!accepted) return;
    }
    if (idChanged) {
      const accepted = await confirmAddyAction('Αυτή η ενέργεια θα αλλάξει τον αριθμό του ΑΔΔΥ. Να προχωρήσω;');
      if (!accepted) return;
    }
    if (dateChanged) {
      const accepted = await confirmAddyAction('Αυτή η ενέργεια θα αλλάξει την ημερομηνία του ΑΔΔΥ. Να προχωρήσω;');
      if (!accepted) return;
    }
    try {
      const result = await transactionsApi.updateAddy(documentData.id, {
        id: newId,
        documentDate: newDate,
        notes: modal.querySelector('[data-addy-edit-notes]').value,
        items: quantityInputs.map((input) => ({
          id: Number(input.dataset.addyEditQuantity),
          quantity: Number(input.value)
        })),
        removedItemIds: [...removedItemIds]
      });
      close();
      showToast(result.message);
      await onSaved();
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ΑΔΔΥ.', 'error');
    }
  });
  window.document.body.appendChild(modal);
}

export function confirmAddyAction(message) {
  return new Promise((resolve) => {
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <section class="request-document-modal action-confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="addy-confirm-title">
        <header class="material-card-header">
          <h2 id="addy-confirm-title">Επιβεβαίωση</h2>
        </header>
        <p data-addy-confirm-message></p>
        <div class="row-actions">
          <button class="secondary-button" data-addy-confirm-cancel type="button">Ακύρωση</button>
          <button class="danger-button" data-addy-confirm-accept type="button">Συνέχεια</button>
        </div>
      </section>
    `;
    modal.querySelector('[data-addy-confirm-message]').textContent = message;

    const finish = (accepted) => {
      window.document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve(accepted);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(false);
    };

    modal.querySelector('[data-addy-confirm-cancel]').addEventListener('click', () => finish(false));
    modal.querySelector('[data-addy-confirm-accept]').addEventListener('click', () => finish(true));
    modal.addEventListener('click', (event) => {
      if (event.target === modal) finish(false);
    });
    window.document.addEventListener('keydown', onKeyDown);
    window.document.body.appendChild(modal);
    window.requestAnimationFrame(() => {
      modal.querySelector('[data-addy-confirm-cancel]').focus({ preventScroll: true });
    });
  });
}

export function openAddyShareSelectionDialog(shares) {
  return new Promise((resolve) => {
    const sortedShares = [...shares].sort(compareShareNumbers);
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop request-document-backdrop';
    modal.innerHTML = `
      <section class="request-document-modal" role="dialog" aria-modal="true" aria-labelledby="addy-share-selection-title">
        <header class="material-card-header">
          <div>
            <p class="eyebrow">ΕΠΙΛΟΓΗ ΜΕΡΙΔΑΣ</p>
            <h2 id="addy-share-selection-title">Μερίδες με τον ίδιο Αριθμό Ονομαστικού</h2>
          </div>
          <button class="secondary-button" data-close-addy-share-selection type="button">Κλείσιμο</button>
        </header>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Α/Α Μερίδας</th>
                <th>Αριθμός Ονομαστικού</th>
                <th>Περιγραφή</th>
                <th>Υπόλοιπο Μερίδας</th>
                <th>Επιλογή</th>
              </tr>
            </thead>
            <tbody>
              ${sortedShares.map((share, index) => `
                <tr>
                  <td>${escapeAddyEditHtml(share.shareNumber)}</td>
                  <td>${escapeAddyEditHtml(share.nominalNumber)}</td>
                  <td>${escapeAddyEditHtml(share.description)}</td>
                  <td>${escapeAddyEditHtml(formatAddyShareBalance(share.accountingBalance))}</td>
                  <td><button class="primary-button" data-select-addy-share="${index}" type="button">Επιλογή</button></td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>
    `;

    const finish = (share = null) => {
      window.document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve(share);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish();
    };

    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-close-addy-share-selection]')) {
        finish();
        return;
      }
      const selectButton = event.target.closest('[data-select-addy-share]');
      if (selectButton) finish(sortedShares[Number(selectButton.dataset.selectAddyShare)] || null);
    });
    window.document.addEventListener('keydown', onKeyDown);
    window.document.body.appendChild(modal);
    window.requestAnimationFrame(() => {
      modal.querySelector('[data-select-addy-share]')?.focus({ preventScroll: true });
    });
  });
}

export async function openAddyDepartmentAllocationDialog({ departments, share, shareNumber, description, transactionType, quantity }) {
  const availableDepartments = departments.length
    ? departments
    : (await window.appApi.internal.getReferenceData()).departmentManagers;
  const balances = await Promise.all(availableDepartments.map(async (department) => {
    if (!share?.id) return { department, quantity: 0 };
    const rows = await window.appApi.internal.listDepartmentBalances(department.id);
    const balance = rows.find((item) => Number(item.shareId) === Number(share.id));
    return { department, quantity: Number(balance?.finalQuantity || 0) };
  }));
  return new Promise((resolve) => {
    const isCharge = transactionType === 'Χρέωση';
    const modal = window.document.createElement('div');
    modal.className = 'modal-backdrop request-document-backdrop';
    modal.innerHTML = `
      <section class="request-document-modal" role="dialog" aria-modal="true" aria-labelledby="addy-department-allocation-title">
        <header class="material-card-header">
          <div>
            <p class="eyebrow">${isCharge ? 'ΧΡΕΩΣΗ ΤΜΗΜΑΤΩΝ' : 'ΠΙΣΤΩΣΗ ΤΜΗΜΑΤΩΝ'}</p>
            <h2 id="addy-department-allocation-title">${escapeAddyEditHtml(shareNumber)} — ${escapeAddyEditHtml(description)}</h2>
            <p class="muted">${isCharge
              ? 'Κατανείμετε την ποσότητα του ΑΔΔΥ στα τμήματα.'
              : 'Επιλέξτε από ποια τμήματα θα αφαιρεθεί η ποσότητα του ΑΔΔΥ.'}
              Οι κινήσεις θα γίνουν μόνο αν πατήσετε Αποθήκευση.</p>
            ${share?.requiresComposition ? '<p class="muted">Η σύνθεση θα κατανεμηθεί αναλογικά σε κάθε τμηματική κίνηση.</p>' : ''}
          </div>
        </header>
        <div class="table-wrap">
          <table class="editable-records-table">
            <thead><tr><th>Τμήμα Μονάδος</th><th>Χρεωμένη ποσότητα</th><th>${isCharge ? 'Ποσότητα χρέωσης' : 'Ποσότητα πίστωσης'}</th></tr></thead>
            <tbody>
              ${balances.length ? balances.map(({ department, quantity: currentQuantity }) => `
                <tr data-addy-department-allocation-row data-department-id="${department.id}">
                  <td>${escapeAddyEditHtml(department.departmentName)}</td>
                  <td class="number-cell">${formatAddyShareBalance(currentQuantity)}</td>
                  <td><input data-addy-department-allocation-quantity type="number" min="0"
                    data-available-quantity="${currentQuantity}"
                    ${isCharge ? '' : `max="${currentQuantity}"`}
                    step="0.001" value="0" ${!isCharge && currentQuantity <= 0 ? 'disabled' : ''} /></td>
                </tr>
              `).join('') : '<tr><td colspan="3" class="empty-table">Δεν έχουν καταχωρηθεί τμήματα Μονάδος.</td></tr>'}
            </tbody>
          </table>
        </div>
        <div class="addy-save-row">
          <strong data-addy-allocation-total>Σύνολο: 0 / ${formatAddyShareBalance(quantity)}</strong>
          <span class="form-error" data-addy-allocation-mismatch></span>
          <button class="secondary-button" data-close-addy-allocation type="button">Κλείσιμο</button>
          <button class="primary-button" data-confirm-addy-allocation type="button" disabled>Αποθήκευση</button>
        </div>
      </section>`;
    const updateAgreement = () => {
      const inputs = [...modal.querySelectorAll('[data-addy-department-allocation-quantity]:not(:disabled)')];
      const invalidCredit = !isCharge && inputs.some((input) => exceedsDepartmentCreditBalance(
        input.value,
        input.dataset.availableQuantity
      ));
      const total = inputs.reduce((sum, input) => sum + (Number(input.value) || 0), 0);
      const difference = total - quantity;
      modal.querySelector('[data-addy-allocation-total]').textContent = `Σύνολο: ${formatAddyShareBalance(total)} / ${formatAddyShareBalance(quantity)}`;
      modal.querySelector('[data-addy-allocation-mismatch]').textContent = invalidCredit
        ? 'Μη συμφωνία: κάποιο τμήμα δεν έχει επαρκή χρεωμένη ποσότητα.'
        : Math.abs(difference) < 0.000001
          ? ''
          : difference < 0
            ? `Μη συμφωνία: υπολείπονται ${formatAddyShareBalance(-difference)}.`
            : `Μη συμφωνία: η κατανομή υπερβαίνει κατά ${formatAddyShareBalance(difference)}.`;
      modal.querySelector('[data-confirm-addy-allocation]').disabled = invalidCredit || Math.abs(difference) >= 0.000001;
    };
    const finish = (result) => {
      window.document.removeEventListener('keydown', onKeyDown);
      modal.remove();
      resolve(result);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') finish(null);
    };
    modal.addEventListener('input', (event) => {
      if (event.target.matches('[data-addy-department-allocation-quantity]')) updateAgreement();
    });
    modal.addEventListener('click', (event) => {
      if (event.target === modal || event.target.closest('[data-close-addy-allocation]')) {
        finish(null);
        return;
      }
      if (!event.target.closest('[data-confirm-addy-allocation]')) return;
      const allocations = [...modal.querySelectorAll('[data-addy-department-allocation-row]')]
        .map((row) => ({
          departmentManagerId: Number(row.dataset.departmentId),
          quantity: Number(row.querySelector('[data-addy-department-allocation-quantity]')?.value || 0)
        }))
        .filter((allocation) => allocation.quantity > 0);
      finish(allocations);
    });
    window.document.addEventListener('keydown', onKeyDown);
    window.document.body.appendChild(modal);
    updateAgreement();
  });
}

function escapeAddyEditHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
