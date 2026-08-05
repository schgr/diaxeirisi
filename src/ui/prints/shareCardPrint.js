import { escapeHtml, renderFiscalYearOptions } from '../components/forms.js';
import { splitOfficerSignature } from '../officerSignature.js';
import { renderShareBackTemplate, renderSharePrintDocument } from '../pages/sharesPage.js';
import { printIsolatedPreview } from './printPreview.js';
import { compareShareNumbers } from './shared.js';

function renderShareCardControls(shares, state) {
  return `
    <div class="registry-controls share-print-controls">
      <label class="field"><span>Οικονομικό Έτος</span>
        <select id="prints-fiscal-year">${renderFiscalYearOptions(state.fiscalYear)}</select>
      </label>
      <label class="field"><span>Καρτέλα Υλικού</span>
        <select id="print-share-id" ${state.onlyMovedCards ? 'disabled' : ''}>
          ${shares.map((share) =>
            `<option value="${share.id}" ${Number(state.selectedShareId) === Number(share.id) ? 'selected' : ''}>${escapeHtml(share.shareNumber)}</option>`
          ).join('')}
        </select>
      </label>
      <label class="field checkbox-field"><span>Με διακίνηση στο έτος</span>
        <input id="print-moved-only" type="checkbox" ${state.onlyMovedCards ? 'checked' : ''} />
      </label>
      ${renderShareRangeControls(state)}
      <button id="print-current-document" class="primary-button" data-no-document-export type="button">Προβολή</button>
    </div>`;
}

function renderAllShareCardControls(shareCount, state) {
  return `
    <div class="registry-controls share-print-controls all-share-controls">
      <div class="latest-inventory-share-summary">
        <span>Σύνολο Μερίδων Υλικού</span>
        <strong>${escapeHtml(shareCount)}</strong>
      </div>
      ${renderShareRangeControls(state)}
      <button id="print-current-document" class="primary-button compact-print-button all-share-print-button" data-no-document-export type="button" ${shareCount ? '' : 'disabled'}>Προβολή Μερίδων</button>
      <button id="print-share-back-side" class="secondary-button compact-print-button" data-no-document-export type="button">Προβολή Πίσω Πλευράς</button>
    </div>
  `;
}

function renderShareRangeControls(state) {
  return `
    <label class="field"><span>Από Μερίδα</span>
      <input id="print-share-from" type="number" min="0" value="${escapeHtml(state.shareFrom || '')}" />
    </label>
    <label class="field"><span>Έως Μερίδα</span>
      <input id="print-share-to" type="number" min="0" value="${escapeHtml(state.shareTo || '')}" />
    </label>`;
}

async function renderAllShareCardPreview(
  sharesApi,
  shares,
  settings,
  state,
  preview
) {
  if (!shares.length) {
    preview.innerHTML = '<section class="page-panel empty-table">Δεν υπάρχουν Μερίδες Υλικού.</section>';
    return;
  }

  const token = ++state.shareRenderToken;
  preview.innerHTML = renderSharePreparationStatus('Φόρτωση μερίδων…');
  const loadedCards = await loadShareCardsWithProgress(sharesApi, {
    taskId: crypto.randomUUID(),
    mode: 'all',
    year: state.fiscalYear,
    fromShareNumber: state.shareFrom,
    toShareNumber: state.shareTo
  }, preview, state, token);
  if (token !== state.shareRenderToken || state.activeTab !== 'share-card') return;
  const cards = loadedCards.map((card) => {
    const share = shares.find((item) => Number(item.id) === Number(card.share.id)) || {};
    return {
      ...card,
      share: {
        ...card.share,
        ...share
      },
      openingTransfer: {
        balance: Number(card.share.accountingBalance || 0),
        inventoryDate: '',
        reference: ''
      },
      transactions: []
    };
  });
  state.sharePrintCards = cards;
  state.sharePreviewPage = 0;
  renderShareCardBatchPreview(cards, settings, state, preview, true);
}

function bindAllShareCardControls(container, preview, state, renderActiveTab) {
  const button = container.querySelector('#print-share-back-side');
  if (!button) return;
  button.addEventListener('click', () => openShareBackPreview(renderShareBackTemplate()));
  const updateRange = () => {
    state.shareFrom = container.querySelector('#print-share-from')?.value || '';
    state.shareTo = container.querySelector('#print-share-to')?.value || '';
    void renderActiveTab();
  };
  container.querySelector('#print-share-from')?.addEventListener('change', updateRange);
  container.querySelector('#print-share-to')?.addEventListener('change', updateRange);
}

function openShareBackPreview(documentHtml) {
  document.querySelector('.share-back-preview-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop index-document-preview-backdrop share-back-preview-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal index-document-preview-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">Κ 2309/ΑΥΠ</p>
          <h2>Πίσω Πλευρά Μερίδας Υλικού</h2>
        </div>
        <div class="row-actions">
          <button class="primary-button" data-print-share-back type="button">Εκτύπωση</button>
          <button class="secondary-button" data-close-share-back type="button">Κλείσιμο</button>
        </div>
      </header>
      <div class="print-preview-shell index-document-preview-content share-back-preview-content">${documentHtml}</div>
    </div>
  `;
  const content = backdrop.querySelector('.share-back-preview-content');
  backdrop.querySelector('[data-print-share-back]').addEventListener('click', () => {
    void printIsolatedPreview(content, false);
  });
  backdrop.querySelector('[data-close-share-back]').addEventListener('click', () => backdrop.remove());
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) backdrop.remove();
  });
  document.body.appendChild(backdrop);
}

function bindShareCardControls(container, sharesApi, shares, settings, state, preview) {
  const yearInput = container.querySelector('#prints-fiscal-year');
  const shareSelect = container.querySelector('#print-share-id');
  const movedOnly = container.querySelector('#print-moved-only');
  if (!yearInput || !shareSelect || !movedOnly) return;

  async function updatePreview() {
    state.fiscalYear = Number(yearInput.value) || new Date().getFullYear();
    state.selectedShareId = shareSelect.value;
    state.onlyMovedCards = movedOnly.checked;
    state.shareFrom = container.querySelector('#print-share-from')?.value || '';
    state.shareTo = container.querySelector('#print-share-to')?.value || '';
    shareSelect.disabled = state.onlyMovedCards;
    await renderShareCardPreview(sharesApi, shares, settings, state, preview);
  }

  yearInput.addEventListener('change', updatePreview);
  shareSelect.addEventListener('change', updatePreview);
  movedOnly.addEventListener('change', updatePreview);
  container.querySelector('#print-share-from')?.addEventListener('change', updatePreview);
  container.querySelector('#print-share-to')?.addEventListener('change', updatePreview);
}

async function renderShareCardPreview(sharesApi, shares, settings, state, preview) {
  if (!shares.length) {
    preview.innerHTML = '<section class="page-panel empty-table">Δεν υπάρχουν καρτέλες υλικού.</section>';
    return;
  }

  const token = ++state.shareRenderToken;
  preview.innerHTML = renderSharePreparationStatus('Προετοιμασία μερίδων…');
  const selectedId = Number(state.selectedShareId) || shares[0].id;
  const cards = await loadShareCardsWithProgress(sharesApi, {
    taskId: crypto.randomUUID(),
    mode: state.onlyMovedCards ? 'moved' : 'single',
    shareId: selectedId,
    year: state.fiscalYear,
    fromShareNumber: state.shareFrom,
    toShareNumber: state.shareTo
  }, preview, state, token);
  if (token !== state.shareRenderToken || state.activeTab !== 'share-card') return;
  state.sharePrintCards = cards;
  state.sharePreviewPage = 0;
  renderShareCardBatchPreview(cards, settings, state, preview, false);
}

function renderSharePreparationStatus(message, current = 0, total = 0) {
  const progress = total
    ? `<progress max="${total}" value="${current}"></progress><span>${current}/${total}</span>`
    : '';
  return `<section class="page-panel share-print-preparation"><strong>${escapeHtml(message)}</strong>${progress}</section>`;
}

async function loadShareCardsWithProgress(sharesApi, payload, preview, state, token) {
  if (state.activeSharePrintTaskId && state.activeSharePrintTaskId !== payload.taskId) {
    void window.appApi.heavyTasks.cancel(state.activeSharePrintTaskId);
  }
  state.activeSharePrintTaskId = payload.taskId;
  let acceptingProgress = true;
  const stopProgress = window.appApi.heavyTasks.onProgress((progress) => {
    if (
      !acceptingProgress
      || progress.id !== payload.taskId
      || token !== state.shareRenderToken
    ) return;
    preview.innerHTML = renderSharePreparationStatus(
      progress.message || 'Προετοιμασία μερίδων…',
      progress.current,
      progress.total
    );
  });
  try {
    const cards = await sharesApi.getCardsBatch(payload);
    acceptingProgress = false;
    return cards;
  } finally {
    acceptingProgress = false;
    stopProgress();
    if (state.activeSharePrintTaskId === payload.taskId) {
      state.activeSharePrintTaskId = '';
    }
  }
}

function renderShareCardBatchPreview(cards, settings, state, preview, latestInventory = null) {
  if (!cards.length) {
    preview.innerHTML = '<section class="page-panel empty-table">Δεν υπάρχουν μερίδες για τα επιλεγμένα κριτήρια.</section>';
    return;
  }
  const pageSize = 20;
  const pageCount = Math.ceil(cards.length / pageSize);
  state.sharePreviewPage = Math.min(state.sharePreviewPage, pageCount - 1);
  const start = state.sharePreviewPage * pageSize;
  let options = state.sharePrintOptions;
  if (latestInventory !== null || !options) {
    const issuer = splitOfficerSignature(
      latestInventory
        ? settings?.financialOfficers?.ped || ''
        : state.onlyMovedCards
          ? settings?.financialOfficers?.manager || ''
          : ''
    );
    options = {
      fiscalYear: state.fiscalYear,
      exactCopy: state.onlyMovedCards ? 'Ακριβές Αντίγραφο' : '',
      issuerName: issuer.name,
      issuerRank: issuer.rank
    };
    state.sharePrintOptions = options;
  }
  preview.innerHTML = `
    <section class="page-panel no-print share-preview-pagination">
      <span>Προεπισκόπηση ${start + 1}–${Math.min(start + pageSize, cards.length)} από ${cards.length}</span>
      <button type="button" data-share-preview-page="${state.sharePreviewPage - 1}" ${state.sharePreviewPage ? '' : 'disabled'}>Προηγούμενη</button>
      <button type="button" data-share-preview-page="${state.sharePreviewPage + 1}" ${state.sharePreviewPage + 1 < pageCount ? '' : 'disabled'}>Επόμενη</button>
    </section>
    ${cards.slice(start, start + pageSize).map((card) => renderSharePrintDocument(card, options)).join('')}
  `;
}

async function printPreparedShareCards(container, preview, settings, state) {
  if (state.sharePrintBusy || !state.sharePrintCards.length) return;
  state.sharePrintBusy = true;
  const button = container.querySelector('#print-current-document');
  if (button) button.disabled = true;
  const status = document.createElement('section');
  status.className = 'page-panel no-print share-print-live-status';
  preview.prepend(status);
  const options = state.sharePrintOptions || { fiscalYear: state.fiscalYear };
  const chunks = [];
  try {
    for (let index = 0; index < state.sharePrintCards.length; index += 25) {
      chunks.push(state.sharePrintCards.slice(index, index + 25)
        .map((card) => renderSharePrintDocument(card, options)).join(''));
      status.innerHTML = renderSharePreparationStatus(
        'Προετοιμασία τελικής εκτύπωσης…',
        Math.min(index + 25, state.sharePrintCards.length),
        state.sharePrintCards.length
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    const printRoot = document.createElement('div');
    printRoot.className = 'isolated-print-root';
    printRoot.innerHTML = chunks.join('');
    document.body.dataset.isolatedDocumentPrint = 'true';
    document.body.appendChild(printRoot);
    try {
      await window.appApi.print.currentDocument({ landscape: false });
    } finally {
      printRoot.remove();
      delete document.body.dataset.isolatedDocumentPrint;
    }
  } finally {
    status.remove();
    state.sharePrintBusy = false;
    if (button) button.disabled = false;
  }
}

export { bindAllShareCardControls, bindShareCardControls, printPreparedShareCards, renderAllShareCardControls, renderAllShareCardPreview, renderShareCardBatchPreview, renderShareCardControls, renderShareCardPreview };
