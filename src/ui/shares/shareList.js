import { escapeHtml } from '../components/forms.js';
import { includes, normalize, compactSearchText, formatQuantity, formatDifference } from './shared.js';

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

function renderRows(shares, compositionOnly = false) {
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

export { renderSharesTableHeader, bindLiveFilters, collectMaterialTypes, filterAndRankShares, renderRows };
