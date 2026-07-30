import { escapeHtml } from '../components/forms.js';
import { openShareCard } from '../shares/shareCard.js';
import { renderSharesTableHeader, bindLiveFilters, collectMaterialTypes } from '../shares/shareList.js';

export { filterAndRankShares, renderRows } from '../shares/shareList.js';
export { renderCompositionDocument, renderCompositionDocumentFooter, numberToGreekWords } from '../shares/shareComposition.js';
export { renderChangeSheetDocument, renderSharePrintDocument, renderShareBackTemplate } from '../shares/sharePrint.js';

export async function renderSharesPage(container, sharesApi, settingsApi, showToast, options = {}) {
  const [allShares, settings] = await Promise.all([
    sharesApi.list(),
    settingsApi.get()
  ]);
  const shares = options.compositionOnly
    ? allShares.filter((share) => share.requiresComposition)
    : allShares;
  const materialTypes = collectMaterialTypes(shares, settings.materialCategories);
  const heading = options.compositionOnly ? 'Συνθέσεις Μερίδων' : 'Κατάσταση Μερίδων';
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
