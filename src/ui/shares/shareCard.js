import { escapeHtml, renderFiscalYearOptions } from '../components/forms.js';
import { summaryItem, detailField, toggleField, getShareDetailControls, renderTransactionRows, renderAssignmentRows } from './shareDetails.js';
import { renderCompositionRows, setCompositionLocked, renderChangeSheetRows, setChangeSheetLocked, collectCompositionRows, collectChangeSheetRows, collectRecordRow, renderCompositionDocument } from './shareComposition.js';
import { openMaterialFormPreview, printMaterialFormDocument, renderChangeSheetDocument, openSharePrintDocument } from './sharePrint.js';
import { formatQuantity, formatDate, pathToFileUrl, formatDifference } from './shared.js';

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
            <tbody data-composition-body>${renderCompositionRows(card.compositionItems, compositionLocked, settings?.measurementUnits)}</tbody>
          </table>
        </div>
        ${compositionEditor ? `<div class="addy-save-row">
          <span class="muted" data-composition-lock-state>${compositionLocked ? 'Η σύνθεση είναι κλειδωμένη.' : 'Η σύνθεση είναι σε επεξεργασία.'}</span>
          <button class="primary-button" data-save-composition type="button" ${compositionLocked ? 'disabled' : ''}>Αποθήκευση Σύνθεσης</button>
        </div>` : ''}
      </section>

      <section class="material-card-section material-records-section">
        <div class="material-card-section-title">
          <div>
            <h3>Φύλλο Μεταβολών</h3>
            <p class="muted">Το ίδιο αυτόματο φύλλο που συνοδεύει τη μερίδα στις «Μερίδες με Κίνηση».</p>
          </div>
          <div class="row-actions">
            <button class="secondary-button" data-view-change-sheet type="button">Προβολή</button>
          </div>
        </div>
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
      body.insertAdjacentHTML('beforeend', renderCompositionRows([{}], false, settings?.measurementUnits));
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
        renderChangeSheetDocument(card),
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

export { openShareCard };
