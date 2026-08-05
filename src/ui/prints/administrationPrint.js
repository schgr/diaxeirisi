import { escapeHtml } from '../components/forms.js';
import { formatOfficerName, formatOfficerRank } from '../officerSignature.js';
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
      `${item.registryNumber}/${item.fiscalYear}`,
      formatDate(item.protocolDate),
      item.counterpartyUnit,
      `${item.differenceType} ${formatNumber(item.differenceQuantity)} ${item.measurementUnit}`,
      `${item.shareNumber} / ${item.nominalNumber}`,
      formatDate(item.dispatchDate),
      item.responseDate ? `${item.responseStatus} ${formatDate(item.responseDate)}` : item.responseStatus,
      formatDate(item.escalationDate),
      item.settlementReference || item.settlementStatus
    ])
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
              <td><span class="status-pill ${row.status === 'Πλεόνασμα' ? 'surplus' : 'deficit'}">${escapeHtml(row.status)}</span></td>
            </tr>
          `).join('') : '<tr><td colspan="10" class="empty-table">Δεν υπάρχουν πλεονάσματα ή ελλείμματα για την επιλεγμένη κατηγορία.</td></tr>'}
        </tbody>
      </table>
      <div class="balance-differences-page-number">Σελίδα ${pageIndex + 1} από ${pages.length}</div>
    </article>
  `).join('');
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

function bindBalanceDifferenceControls(container, state, rows, preview) {
  container.querySelector('#balance-difference-filter')?.addEventListener('change', (event) => {
    state.balanceDifferenceFilter = event.target.value;
    preview.innerHTML = renderBalanceDifferenceTable(
      filterBalanceDifferences(rows, state.balanceDifferenceFilter)
    );
  });
}

export { bindBalanceDifferenceControls, filterBalanceDifferences, renderBalanceDifferenceControls, renderBalanceDifferenceTable, renderMovementDifferencesIndex };
