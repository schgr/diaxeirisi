import { escapeHtml } from '../components/forms.js';
import { normalize, compactSearchText, formatQuantity, formatDifference } from './shared.js';

const FILTER_DEBOUNCE_MS = 180;
const SHARE_PAGE_SIZE = 100;
const searchIndexCache = new WeakMap();

function prepareShareSearchIndex(shares) {
  if (searchIndexCache.has(shares)) return searchIndexCache.get(shares);
  const prepared = shares.map((share, originalIndex) => {
    const description = normalize(share.description);
    return {
      share,
      originalIndex,
      shareNumber: normalize(share.shareNumber),
      compactShareNumber: compactSearchText(normalize(share.shareNumber)),
      nominalNumber: normalize(share.nominalNumber),
      compactNominalNumber: compactSearchText(normalize(share.nominalNumber)),
      description,
      compactDescription: compactSearchText(description),
      descriptionWords: description.match(/[\p{L}\p{N}]+/gu) || [],
      materialType: normalize(share.materialType)
    };
  });
  searchIndexCache.set(shares, prepared);
  return prepared;
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
  const tableWrap = container.querySelector('.shares-table-wrap');
  const pager = document.createElement('nav');
  pager.className = 'shares-pagination';
  pager.setAttribute('aria-label', 'Σελιδοποίηση μερίδων');
  tableWrap.insertAdjacentElement('afterend', pager);
  let selectedShareId = null;
  let currentPage = 0;
  let currentRows = [];

  function renderPage(filtered, requestedPage = 0) {
    const pageCount = Math.max(1, Math.ceil(filtered.length / SHARE_PAGE_SIZE));
    currentPage = Math.max(0, Math.min(requestedPage, pageCount - 1));
    const start = currentPage * SHARE_PAGE_SIZE;
    currentRows = filtered.slice(start, start + SHARE_PAGE_SIZE);
    body.innerHTML = renderRows(currentRows, false, selectedShareId);
    count.textContent = filtered.length;
    pager.innerHTML = `
      <span>${filtered.length ? start + 1 : 0}–${Math.min(start + SHARE_PAGE_SIZE, filtered.length)} από ${filtered.length}</span>
      <button type="button" data-share-page="${currentPage - 1}" ${currentPage ? '' : 'disabled'} aria-label="Προηγούμενη σελίδα">Προηγούμενη</button>
      <button type="button" data-share-page="${currentPage + 1}" ${currentPage + 1 < pageCount ? '' : 'disabled'} aria-label="Επόμενη σελίδα">Επόμενη</button>
    `;
  }

  const controller = createShareFilterController(shares, {
    onResults: (filtered) => renderPage(filtered, 0),
    onError: (error) => showToast(error.message || 'Δεν ήταν δυνατή η αναζήτηση.', 'error')
  });
  const onTextInput = () => controller.schedule(readFilters(inputs));
  const onSelectChange = () => controller.applyNow(readFilters(inputs));
  const onPagerClick = (event) => {
    const button = event.target.closest('[data-share-page]');
    if (button) renderPage(controller.results(), Number(button.dataset.sharePage));
  };
  const onBodyClick = (event) => {
    const row = event.target.closest('tr[data-share-id]');
    if (!row) return;
    selectedShareId = Number(row.dataset.shareId);
    body.querySelectorAll('tr[data-share-id]').forEach((candidate) => {
      const selected = Number(candidate.dataset.shareId) === selectedShareId;
      candidate.classList.toggle('selected-row', selected);
      candidate.setAttribute('aria-selected', String(selected));
    });
  };
  const onBodyKeydown = (event) => {
    const row = event.target.closest('tr[data-share-id]');
    if (!row || !['ArrowDown', 'ArrowUp'].includes(event.key)) return;
    event.preventDefault();
    const rows = [...body.querySelectorAll('tr[data-share-id]')];
    const next = rows[Math.max(0, Math.min(rows.length - 1, rows.indexOf(row) + (event.key === 'ArrowDown' ? 1 : -1)))];
    next?.focus();
    next?.click();
  };

  for (const input of inputs) {
    if (input.tagName === 'SELECT') input.addEventListener('change', onSelectChange);
    else input.addEventListener('input', onTextInput);
  }
  pager.addEventListener('click', onPagerClick);
  body.addEventListener('click', onBodyClick);
  body.addEventListener('keydown', onBodyKeydown);
  controller.applyNow(readFilters(inputs));

  return () => {
    controller.cancel();
    for (const input of inputs) {
      if (input.tagName === 'SELECT') input.removeEventListener('change', onSelectChange);
      else input.removeEventListener('input', onTextInput);
    }
    pager.removeEventListener('click', onPagerClick);
    body.removeEventListener('click', onBodyClick);
    body.removeEventListener('keydown', onBodyKeydown);
  };
}

function readFilters(inputs) {
  return Object.fromEntries(inputs.map((input) => [input.dataset.filter, input.value]));
}

function createShareFilterController(shares, options = {}) {
  const scheduler = options.scheduler || { setTimeout, clearTimeout };
  const delay = options.delay === undefined ? FILTER_DEBOUNCE_MS : options.delay;
  let timer = null;
  let generation = 0;
  let latestResults = [];

  function cancel() {
    generation += 1;
    if (timer !== null) scheduler.clearTimeout(timer);
    timer = null;
  }
  function apply(filters, requestGeneration) {
    if (requestGeneration !== generation) return false;
    try {
      latestResults = filterAndRankShares(shares, filters);
      if (requestGeneration !== generation) return false;
      options.onResults?.(latestResults);
      return true;
    } catch (error) {
      options.onError?.(error);
      return false;
    }
  }
  function schedule(filters) {
    cancel();
    const requestGeneration = generation;
    timer = scheduler.setTimeout(() => {
      timer = null;
      apply(filters, requestGeneration);
    }, delay);
    return requestGeneration;
  }
  function applyNow(filters) {
    cancel();
    return apply(filters, generation);
  }
  return { schedule, applyNow, cancel, results: () => latestResults };
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

function filterAndRankShares(shares, filters = {}) {
  const normalizedFilters = Object.fromEntries(
    Object.entries(filters).map(([key, value]) => [key, normalize(value)])
  );
  const descriptionFilter = normalizedFilters.description;

  return prepareShareSearchIndex(shares)
    .filter((entry) => {
      const materialMatch = !normalizedFilters.materialType ||
        entry.materialType === normalizedFilters.materialType;
      return (
        materialMatch &&
        indexedIncludes(entry.shareNumber, entry.compactShareNumber, normalizedFilters.shareNumber) &&
        indexedIncludes(entry.nominalNumber, entry.compactNominalNumber, normalizedFilters.nominalNumber) &&
        indexedIncludes(entry.description, entry.compactDescription, descriptionFilter)
      );
    })
    .sort((left, right) => {
      if (!descriptionFilter) return left.originalIndex - right.originalIndex;

      const rankDifference =
        descriptionMatchRankPrepared(left, descriptionFilter) -
        descriptionMatchRankPrepared(right, descriptionFilter);
      if (rankDifference) return rankDifference;

      const descriptionOrder = String(left.share.description || '')
        .localeCompare(String(right.share.description || ''), 'el', { sensitivity: 'base' });
      return descriptionOrder || left.originalIndex - right.originalIndex;
    })
    .map(({ share }) => share);
}

function indexedIncludes(normalizedValue, compactValue, filter) {
  if (!filter) return true;
  const compactFilter = compactSearchText(filter);
  return normalizedValue.includes(filter) ||
    Boolean(compactFilter && compactValue.includes(compactFilter));
}

function descriptionMatchRankPrepared(entry, filter) {
  if (entry.description === filter) return 0;
  if (entry.description.startsWith(filter)) return 1;
  if (entry.descriptionWords.some((word) => word.startsWith(filter))) return 2;
  if (entry.description.includes(filter)) return 3;
  return 4;
}

function renderRows(shares, compositionOnly = false, selectedShareId = null) {
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
        <tr data-share-id="${share.id}" tabindex="0" aria-selected="${Number(share.id) === Number(selectedShareId)}" class="${Number(share.id) === Number(selectedShareId) ? 'selected-row' : ''}">
          <td class="strong-cell">${escapeHtml(share.shareNumber)}</td>
          <td>${escapeHtml(share.nominalNumber)}</td>
          <td class="share-description-cell">${escapeHtml(share.description)}</td>
          <td class="number-cell">${formatQuantity(share.accountingBalance)}</td>
        </tr>
      ` : `
        <tr data-share-id="${share.id}" tabindex="0" aria-selected="${Number(share.id) === Number(selectedShareId)}" class="${Number(share.id) === Number(selectedShareId) ? 'selected-row' : ''}">
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

export {
  renderSharesTableHeader,
  bindLiveFilters,
  collectMaterialTypes,
  createShareFilterController,
  filterAndRankShares,
  prepareShareSearchIndex,
  renderRows
};
