import { escapeHtml } from '../components/forms.js';
import { formatOfficerName, formatOfficerRank } from '../officerSignature.js';
import { renderIndexAnnualSignatures } from './indexPrint.js';
import { printIsolatedPreview } from './printPreview.js';
import { compareShareNumbers, formatNumber } from './shared.js';

const ROWS_PER_REGISTRY_PAGE = 28;

function renderRegistryControls(shareCount, state) {
  return `
    <div class="registry-controls registry-print-controls">
      <label class="field">
        <span>Πλήθος μερίδων για εμφάνιση</span>
        <input id="registry-display-count" type="number" min="1" value="${state.displayCount || shareCount || 1}" />
      </label>
      <button id="print-current-document" class="primary-button compact-print-button" data-no-document-export type="button">Εκτύπωση</button>
    </div>
  `;
}

function bindRegistryControls(container, shares, settings, state, preview) {
  const countInput = container.querySelector('#registry-display-count');

  function updatePreview() {
    state.displayCount = Math.max(1, Number(countInput.value) || 1);
    preview.innerHTML = renderMaterialRegistryPages(shares, settings, state);
  }

  countInput.addEventListener('input', updatePreview);
}

function getMaterialCategoryNames(shares, settings) {
  const names = new Set(
    (settings?.materialCategories || [])
      .map((category) => String(category.name || '').trim())
      .filter(Boolean)
  );
  shares.forEach((share) => {
    const category = String(share.materialType || '').trim();
    if (category) names.add(category);
  });
  return [...names].sort((left, right) => left.localeCompare(right, 'el'));
}

function renderCategoryShareControls(categories, state) {
  return `
    <div class="category-share-controls">
      <div class="category-share-selection">
        <strong>Κατηγορίες Υλικού</strong>
        <div class="card-table-wrap category-share-options">
          <table class="category-share-selection-table">
            <thead>
              <tr><th>Α/Α</th><th>Κατηγορία Υλικού</th><th>Επιλογή</th></tr>
            </thead>
            <tbody>
              ${categories.map((category, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${escapeHtml(category)}</td>
                  <td>
                    <input type="checkbox" data-material-category="${escapeHtml(category)}"
                      aria-label="Επιλογή ${escapeHtml(category)}"
                      ${state.selectedMaterialCategories.includes(category) ? 'checked' : ''} />
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
      <button id="preview-category-shares" class="primary-button compact-print-button"
        data-no-document-export type="button" ${state.selectedMaterialCategories.length ? '' : 'disabled'}>
        Προβολή
      </button>
    </div>
  `;
}

function bindCategoryShareControls(container, shares, settings, state) {
  container.querySelectorAll('[data-material-category]').forEach((input) => {
    input.addEventListener('change', () => {
      state.selectedMaterialCategories = [...container.querySelectorAll('[data-material-category]:checked')]
        .map((item) => item.dataset.materialCategory);
      const previewButton = container.querySelector('#preview-category-shares');
      if (previewButton) previewButton.disabled = !state.selectedMaterialCategories.length;
    });
  });
}

function openCategorySharePreview(documentHtml) {
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop category-share-preview-backdrop';
  backdrop.innerHTML = `
    <section class="category-share-preview-modal" role="dialog" aria-modal="true"
      aria-label="Προβολή μερίδων ανά κατηγορία υλικού">
      <header class="category-share-preview-header no-print">
        <h2>Μερίδες ανά Κατηγορία Υλικού</h2>
        <div class="row-actions">
          <button class="primary-button" data-print-category-shares type="button">Εκτύπωση</button>
          <button class="secondary-button" data-close-category-shares type="button">Κλείσιμο</button>
        </div>
      </header>
      <div class="category-share-preview-content" data-category-share-preview>${documentHtml}</div>
    </section>
  `;
  document.body.appendChild(backdrop);
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-category-shares]')) close();
    if (event.target.closest('[data-print-category-shares]')) {
      void printIsolatedPreview(backdrop.querySelector('[data-category-share-preview]'), false);
    }
  });
}

function renderSharesByCategoryPages(shares, settings, selectedCategories) {
  const selected = new Set(selectedCategories || []);
  const filtered = shares
    .filter((share) => selected.has(String(share.materialType || '').trim()))
    .sort((left, right) =>
      String(left.materialType || '').localeCompare(String(right.materialType || ''), 'el') ||
      Number(left.shareNumber) - Number(right.shareNumber) ||
      String(left.shareNumber).localeCompare(String(right.shareNumber), 'el')
    );
  if (!filtered.length) {
    return '<section class="page-panel empty-table">Δεν υπάρχουν μερίδες στις επιλεγμένες κατηγορίες.</section>';
  }

  const pages = [];
  const pageCount = Math.ceil(filtered.length / ROWS_PER_REGISTRY_PAGE);
  for (let index = 0; index < pageCount; index += 1) {
    const rows = filtered.slice(index * ROWS_PER_REGISTRY_PAGE, (index + 1) * ROWS_PER_REGISTRY_PAGE);
    pages.push(`
      <article class="material-registry-page category-share-page print-document-area">
        <div class="registry-topline">
          <span>ΜΟΝΑΔΑ: ${escapeHtml(settings?.serviceInfo?.serviceName || '')}</span>
        </div>
        <h1>ΜΕΡΙΔΕΣ ΑΝΑ ΚΑΤΗΓΟΡΙΑ ΥΛΙΚΟΥ</h1>
        <table class="registry-table category-share-table">
          <thead>
            <tr>
              <th>Α/Α</th>
              <th>ΚΑΤΗΓΟΡΙΑ ΥΛΙΚΟΥ</th>
              <th>ΑΡΙΘΜΟΣ ΜΕΡΙΔΑΣ</th>
              <th>ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ</th>
              <th>ΠΕΡΙΓΡΑΦΗ ΥΛΙΚΟΥ</th>
              <th>ΜΟΝΑΔΑ ΜΕΤΡΗΣΗΣ</th>
              <th>ΥΠΟΛΟΙΠΟ</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map((share, rowIndex) => `
              <tr>
                <td>${index * ROWS_PER_REGISTRY_PAGE + rowIndex + 1}</td>
                <td>${escapeHtml(share.materialType || '')}</td>
                <td>${escapeHtml(share.shareNumber || '')}</td>
                <td>${escapeHtml(share.nominalNumber || '')}</td>
                <td class="registry-description-cell">${escapeHtml(share.description || '')}</td>
                <td>${escapeHtml(share.measurementUnit || '')}</td>
                <td class="number-cell">${formatNumber(share.accountingBalance)}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="registry-footer">Σελίδα ${index + 1} από ${pageCount}</div>
      </article>
    `);
  }
  return pages.join('');
}

function renderMaterialRegistryPages(shares, settings, state) {
  const sharesByNumber = new Map(
    shares
      .filter((share) => Number.isInteger(Number(share.shareNumber)) && Number(share.shareNumber) > 0)
      .map((share) => [Number(share.shareNumber), share])
  );
  const registryPageCount = Math.max(1, Math.ceil(state.displayCount / ROWS_PER_REGISTRY_PAGE));
  const pageCount = registryPageCount + 1;
  const pages = [];

  for (let pageIndex = 0; pageIndex < registryPageCount; pageIndex += 1) {
    const start = pageIndex * ROWS_PER_REGISTRY_PAGE;
    const pageRows = Array.from({ length: ROWS_PER_REGISTRY_PAGE }, (_unused, index) => {
      const rowNumber = start + index + 1;
      return {
        rowNumber,
        share: sharesByNumber.get(rowNumber) || null
      };
    });
    pages.push(renderMaterialRegistryPage(pageRows, settings, pageIndex + 1, pageCount));
  }
  pages.push(renderMaterialRegistryCertificationPage(settings, pageCount));

  return pages.join('');
}

function renderMaterialRegistryPage(rows, settings, pageNumber, pageCount) {
  return `
    <article class="material-registry-page print-document-area">
      <div class="registry-topline">
        <span>ΜΟΝΑΔΑ: ${escapeHtml(settings.serviceInfo.serviceName || '')}</span>
        <span>Κ 2317/ΔΥΠ</span>
      </div>
      <h1>ΜΗΤΡΩΟ ΜΕΡΙΔΩΝ ΥΛΙΚΟΥ</h1>
      <table class="registry-table">
        <thead>
          <tr>
            <th>Α/Α</th>
            <th>ΑΡΙΘΜΟΣ<br />ΟΝΟΜΑΣΤΙΚΟΥ</th>
            <th>ΠΕΡΙΓΡΑΦΗ ΥΛΙΚΟΥ</th>
            <th>ΗΜΕΡΟΜΗΝΙΑ<br />ΜΕΤΑΦΟΡΑΣ<br />ΣΤΟ ΑΡΧΕΙΟ</th>
            <th>ΛΟΓΟΣ<br />ΜΕΤΑΦΟΡΑΣ</th>
            <th>ΠΑΡΑΤΗΡΗΣΕΙΣ</th>
          </tr>
          <tr class="registry-column-numbers">
            <th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th>
          </tr>
        </thead>
        <tbody>${rows.map((row) => renderRegistryRow(row)).join('')}</tbody>
      </table>
      <div class="registry-footer">Σελίδα ${pageNumber} από ${pageCount}</div>
    </article>
  `;
}

function renderRegistryRow(row) {
  const { share, rowNumber } = row;
  return `
    <tr>
      <td>${share ? escapeHtml(share.shareNumber) : rowNumber}</td>
      <td>${share ? escapeHtml(share.nominalNumber) : ''}</td>
      <td class="registry-description-cell"><div class="registry-description-text">${share ? escapeHtml(share.description) : ''}</div></td>
      <td></td><td></td><td></td>
    </tr>
  `;
}

function renderMaterialRegistryCertificationPage(settings, pageCount) {
  const managementType = String(settings?.serviceInfo?.managementType || '').trim();
  const location = String(settings?.serviceInfo?.serviceLocation || '').trim();
  return `
    <article class="material-registry-page material-registry-certification-page print-document-area">
      <div class="registry-certification-text">
        Το Παρόν αφού σελιδομετρήθηκε βρέθηκε να έχει ${pageCount} σελίδες και θα χρησιμοποιηθεί ως
        Μητρώο Μερίδων της ${escapeHtml(managementType)} Διαχείρισης Υλικού.
      </div>
      <div class="registry-certification-location">
        Τόπος: ${escapeHtml(location)} .................................
      </div>
      ${renderIndexAnnualSignatures(settings?.financialOfficers || {})}
      <div class="registry-footer">Σελίδα ${pageCount} από ${pageCount}</div>
    </article>
  `;
}

export { bindCategoryShareControls, bindRegistryControls, getMaterialCategoryNames, openCategorySharePreview, renderCategoryShareControls, renderMaterialRegistryPages, renderRegistryControls, renderSharesByCategoryPages };
