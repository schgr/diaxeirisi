import { escapeHtml } from '../components/forms.js';
import { displaySupportStatus } from './shared.js';
import { isInventorySupportTemplate } from './exhpSupportChecklist.js';
import { openExhpSupportTemplate } from './exhpSupportTemplateModal.js';
export function openExhpSupportFolder(documentData, api, showToast, settings = {}) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <section class="material-card-modal exhp-support-modal">
      <header class="material-card-header">
        <div><p class="eyebrow">ΕΧΠ ${documentData.registryNumber}</p><h2>Φάκελος Δικαιολογητικών</h2><p class="muted">${escapeHtml(documentData.reason)}</p></div>
        <button class="secondary-button" data-close-support-folder type="button">Κλείσιμο</button>
      </header>
      <div class="exhp-support-grid">
        ${documentData.supports.length ? documentData.supports.map((support) => `
          <label class="exhp-support-row" data-saved-support="${support.id}">
            <input data-support-completed type="checkbox" ${support.completed ? 'checked' : ''} />
            <span><strong>${escapeHtml(support.documentCode || 'Δικαιολογητικό')}</strong>${escapeHtml(support.title)}</span>
            <input data-support-reference value="${escapeHtml(support.documentReference)}" placeholder="Αριθμός / ημερομηνία / στοιχεία" />
            <div class="row-actions">
              ${support.printable ? `<button class="secondary-button" data-print-support="${support.id}" type="button">${isInventorySupportTemplate(support) ? 'Κατάσταση Απογραφής' : 'Έντυπο'}</button>` : ''}
              <button class="secondary-button" data-save-support="${support.id}" type="button">Αποθήκευση</button>
            </div>
          </label>
        `).join('') : '<p class="empty-table">Δεν έχουν αντιστοιχιστεί δικαιολογητικά στην αιτιολογία.</p>'}
        <label class="exhp-support-row exhp-other-support-row">
          <span><strong>Άλλο δικαιολογητικό</strong>Πρόσθεσε οποιοδήποτε άλλο δικαιολογητικό απαιτείται.</span>
          <input data-exhp-other-support value="${escapeHtml(documentData.otherSupportDocument || '')}" placeholder="Τίτλος / αριθμός / ημερομηνία / στοιχεία" />
          <button class="secondary-button" data-save-other-support type="button">Αποθήκευση</button>
        </label>
      </div>
      <footer class="addy-save-row"><span class="status-pill ${documentData.supportStatus === 'Πλήρης για ΕΥΣ' ? 'balanced' : 'pending'}">${escapeHtml(displaySupportStatus(documentData.supportStatus))}</span></footer>
    </section>
  `;
  modal.addEventListener('click', async (event) => {
    if (event.target === modal || event.target.closest('[data-close-support-folder]')) {
      modal.remove();
      return;
    }
    const save = event.target.closest('[data-save-support]');
    const saveOther = event.target.closest('[data-save-other-support]');
    const print = event.target.closest('[data-print-support]');
    if (print) {
      const support = documentData.supports.find((item) => item.id === Number(print.dataset.printSupport));
      if (isInventorySupportTemplate(support)) {
        modal.remove();
        document.dispatchEvent(new CustomEvent('diaxeirisi:navigate', {
          detail: { sectionId: 'as', inventoryTab: 'counts' }
        }));
        return;
      }
      openExhpSupportTemplate(documentData, support, api, showToast, { settings });
      return;
    }
    if (saveOther) {
      try {
        const value = modal.querySelector('[data-exhp-other-support]').value;
        const result = await api.updateExhpOtherSupport(documentData.id, value);
        documentData.otherSupportDocument = value.trim();
        showToast(result.message);
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του πρόσθετου δικαιολογητικού.', 'error');
      }
      return;
    }
    if (!save) return;
    const row = save.closest('[data-saved-support]');
    try {
      const result = await api.updateExhpSupport(documentData.id, Number(save.dataset.saveSupport), {
        completed: row.querySelector('[data-support-completed]').checked,
        documentReference: row.querySelector('[data-support-reference]').value,
        notes: ''
      });
      modal.querySelector('footer .status-pill').textContent = displaySupportStatus(result.supportStatus);
      modal.querySelector('footer .status-pill').className = `status-pill ${result.supportStatus === 'Πλήρης για ΕΥΣ' ? 'balanced' : 'pending'}`;
      showToast(result.message);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση.', 'error');
    }
  });
  document.body.appendChild(modal);
}
