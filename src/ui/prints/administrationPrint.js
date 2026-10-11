import { escapeHtml } from '../components/forms.js';
import { formatOfficerName, formatOfficerRank } from '../officerSignature.js';
import { renderIndexPages } from './indexPrint.js';
import { formatDate, formatNumber } from './shared.js';

function renderOfficerIdentity(value) {
  const officer = splitOfficerSignature(value);
  return `<strong>${escapeHtml(officer.name)}</strong><em>${escapeHtml(officer.rank)}</em>`;
}

function renderMovementDifferencesIndex(settings, protocols) {
  return renderIndexPages({
    unit: settings.serviceInfo.serviceName,
    code: 'Κ 2315/ΔΥΠ',
    subCode: 'ΕΦΕΔ 304',
    title: 'ΕΥΡΕΤΗΡΙΟ ΠΡΩΤΟΚΟΛΛΩΝ ΔΙΑΦΟΡΩΝ',
    subtitle: 'ΑΠΟ ΔΙΑΚΙΝΗΣΗ ΥΛΙΚΟΥ',
    columns: [
      'Α/Α',
      'ΗΜΕΡΟΜΗΝΙΑ',
      'ΜΟΝΑΔΑ',
      'ΕΙΔΟΣ ΔΙΑΦΟΡΑΣ',
      'ΜΕΡΙΔΑ / ΑΡΙΘΜΟΣ ΟΝΟΜΑΣΤΙΚΟΥ',
      'ΗΜΕΡΟΜΗΝΙΑ ΑΠΟΣΤΟΛΗΣ',
      'ΑΠΑΝΤΗΣΗ ΜΟΝΑΔΑΣ',
      'ΑΠΟΣΤΟΛΗ ΣΕ ΠΡΟΪΣΤΑΜΕΝΗ ΑΡΧΗ',
      'ΤΕΛΙΚΗ ΤΑΚΤΟΠΟΙΗΣΗ'
    ],
    numbers: ['2', '3', '4', '5', '6', '7', '8', '9', '10'],
    rows: protocols.map((item) => [
      item.registryNumber,
      formatDate(item.protocolDate),
      item.counterpartyUnit,
      `${item.differenceType} ${formatNumber(item.differenceQuantity)} ${item.measurementUnit}`,
      `${item.shareNumber} / ${item.nominalNumber}`,
      formatDate(item.dispatchDate),
      item.responseDate ? `${item.responseStatus} ${formatDate(item.responseDate)}` : item.responseStatus,
      formatDate(item.escalationDate),
      item.settlementReference || item.settlementStatus
    ]),
    rowsPerPage: 25,
    showPageNumber: true
  });
}

function renderBalanceDifferenceControls(state, rows) {
  const deficits = rows.filter((row) => row.status === 'Έλλειμμα').length;
  const surpluses = rows.filter((row) => row.status === 'Πλεόνασμα').length;
  return `
    <div class="registry-controls balance-difference-controls">
      <label class="field">
        <span>Εμφάνιση</span>
        <select id="balance-difference-filter">
          <option value="all" ${state.balanceDifferenceFilter === 'all' ? 'selected' : ''}>Όλα (${rows.length})</option>
          <option value="deficit" ${state.balanceDifferenceFilter === 'deficit' ? 'selected' : ''}>Ελλείμματα (${deficits})</option>
          <option value="surplus" ${state.balanceDifferenceFilter === 'surplus' ? 'selected' : ''}>Πλεονάσματα (${surpluses})</option>
        </select>
      </label>
      <div class="row-actions">
        <button id="print-current-document" class="primary-button compact-print-button" type="button" ${rows.length ? '' : 'disabled'}>Προβολή</button>
      </div>
    </div>
  `;
}

function renderBalanceDifferenceTable(rows) {
  const pageSize = 18;
  const pages = rows.length
    ? Array.from({ length: Math.ceil(rows.length / pageSize) }, (_unused, index) =>
        rows.slice(index * pageSize, (index + 1) * pageSize))
    : [[]];
  return pages.map((pageRows, pageIndex) => `
    <article class="balance-differences-page print-document-area">
      <h1>ΠΛΕΟΝΑΣΜΑΤΑ - ΕΛΛΕΙΜΜΑΤΑ</h1>
      <table class="index-table balance-differences-table">
        <thead>
          <tr>
            <th>Α/Α</th>
            <th>Είδος</th>
            <th>Μερίδα</th>
            <th>Αριθμός Ονομαστικού</th>
            <th>Περιγραφή</th>
            <th>Μονάδα Μέτρησης</th>
            <th>Υπάρχουσα Ποσότητα</th>
            <th>Χρεωμένη Ποσότητα</th>
            <th>Διαφορά</th>
            <th>Κατάσταση</th>
          </tr>
        </thead>
        <tbody>
          ${pageRows.length ? pageRows.map((row, index) => `
            <tr>
              <td>${pageIndex * pageSize + index + 1}</td>
              <td>${escapeHtml(row.sourceType)}</td>
              <td>${escapeHtml(row.shareNumber)}</td>
              <td>${escapeHtml(row.nominalNumber)}</td>
              <td class="material-description-cell">
                ${escapeHtml(row.description)}
                ${row.sourceType === 'Σύνθεση' ? `<small>Σύνθεση Μερίδας: ${escapeHtml(row.parentDescription)}</small>` : ''}
              </td>
              <td>${escapeHtml(row.measurementUnit)}</td>
              <td>${formatNumber(row.existingQuantity)}</td>
              <td>${formatNumber(row.chargedQuantity)}</td>
              <td>${formatNumber(row.differenceQuantity)}</td>
              <td>${escapeHtml(row.status)}</td>
            </tr>
          `).join('') : '<tr><td colspan="10" class="empty-table">Δεν υπάρχουν πλεονάσματα ή ελλείμματα για την επιλεγμένη κατηγορία.</td></tr>'}
        </tbody>
      </table>
      <div class="balance-differences-page-number">Σελίδα ${pageIndex + 1} από ${pages.length}</div>
    </article>
  `).join('');
}

function renderBalanceDifferenceActionList(rows, departments) {
  const shareRows = rows.filter((row) => row.sourceType === 'Μερίδα');
  if (!shareRows.length) {
    return '<section class="balance-difference-action-list no-print"><p class="empty-table">Δεν υπάρχουν μερίδες για τακτοποίηση στην επιλεγμένη προβολή.</p></section>';
  }
  return `
    <section class="balance-difference-action-list no-print">
      <div>
        <h3>Μερίδες προς τακτοποίηση</h3>
        <p class="muted">Η κατανομή επιτρέπει χρέωση ή επιστροφή σε ένα ή περισσότερα τμήματα, με έλεγχο ότι το άθροισμα συμφωνεί με τη διαφορά.</p>
      </div>
      <div class="table-wrap">
        <table class="balance-difference-action-table">
          <thead><tr><th>Μερίδα</th><th>Υλικό</th><th>Διαφορά</th><th>Τύπος</th><th>Ενέργειες</th></tr></thead>
          <tbody>
            ${shareRows.map((row) => {
              const isDeficit = row.status === 'Έλλειμμα';
              const canSettle = departments.length;
              return `
                <tr>
                  <td>${escapeHtml(row.shareNumber)}</td>
                  <td>${escapeHtml(row.description)}</td>
                  <td class="${isDeficit ? 'deficit' : 'surplus'}">${formatNumber(row.differenceQuantity)} ${escapeHtml(row.measurementUnit)}</td>
                  <td>${isDeficit ? 'Χρέωση' : 'Πίστωση'}</td>
                  <td><button class="primary-button" data-settle-balance-difference
                    data-share-id="${Number(row.shareId)}"
                    data-status="${escapeHtml(row.status)}"
                    data-quantity="${Number(row.differenceQuantity)}"
                    data-share-number="${escapeHtml(row.shareNumber)}"
                    type="button" ${canSettle ? '' : 'disabled'}>${row.requiresComposition ? 'Κατανομή σύνθεσης' : 'Κατανομή'}</button></td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>
    </section>`;
}

function filterBalanceDifferences(rows, filter) {
  const filtered = filter === 'deficit'
    ? rows.filter((row) => row.status === 'Έλλειμμα')
    : filter === 'surplus'
      ? rows.filter((row) => row.status === 'Πλεόνασμα')
      : rows;
  return [...filtered].sort((left, right) =>
    String(left.shareNumber || '').localeCompare(String(right.shareNumber || ''), 'el', {
      numeric: true,
      sensitivity: 'base'
    })
  );
}

function bindBalanceDifferenceControls(container, state, rows, preview, onFilterChange = null) {
  container.querySelector('#balance-difference-filter')?.addEventListener('change', (event) => {
    state.balanceDifferenceFilter = event.target.value;
    preview.innerHTML = renderBalanceDifferenceTable(
      filterBalanceDifferences(rows, state.balanceDifferenceFilter)
    );
    onFilterChange?.(filterBalanceDifferences(rows, state.balanceDifferenceFilter));
  });
}

export { bindBalanceDifferenceControls, filterBalanceDifferences, renderBalanceDifferenceActionList, renderBalanceDifferenceControls, renderBalanceDifferenceTable, renderMovementDifferencesIndex };
