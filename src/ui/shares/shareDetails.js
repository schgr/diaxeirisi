import { escapeHtml } from '../components/forms.js';
import { formatQuantity, formatSignedQuantity, formatDate } from './shared.js';

function summaryItem(label, value) {
  return `
    <div class="summary-item">
      <span>${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function detailField(label, name, value, type = 'text', readonly = false) {
  const step = type === 'number' ? ' min="0" step="0.001"' : '';
  const readonlyAttribute = readonly ? ' readonly' : '';
  return `
    <label class="summary-item material-detail-field">
      <span>${label}</span>
      <input data-share-detail="${name}" type="${type}" value="${escapeHtml(value ?? '')}"${step}${readonlyAttribute} autocomplete="off" />
    </label>
  `;
}

function toggleField(label, name, checked, disabled = false) {
  return `
    <label class="summary-item material-detail-toggle">
      <span>${label}</span>
      <input data-share-detail="${name}" type="checkbox" ${checked ? 'checked' : ''}${disabled ? ' disabled' : ''} />
    </label>
  `;
}

function getShareDetailControls(container) {
  return Object.fromEntries(
    [...container.querySelectorAll('[data-share-detail]')].map((input) => [input.dataset.shareDetail, input])
  );
}

function renderTransactionRows(transactions) {
  if (!transactions.length) {
    return '<tr><td colspan="8" class="empty-table">Δεν υπάρχουν δοσοληψίες για το έτος.</td></tr>';
  }

  return transactions
    .map(
      (transaction) => `
        <tr>
          <td>${transaction.serialNumber}</td>
          <td>${formatDate(transaction.date)}</td>
          <td>${escapeHtml(transaction.transactionUnit)}</td>
          <td>${escapeHtml(transaction.registryNumber)}</td>
          <td class="number-cell">${transaction.imports ? formatQuantity(transaction.imports) : ''}</td>
          <td class="number-cell">${transaction.exports ? formatQuantity(transaction.exports) : ''}</td>
          <td class="number-cell">${formatQuantity(transaction.balance)}</td>
          <td>${escapeHtml(transaction.notes)}</td>
        </tr>
      `
    )
    .join('');
}

function renderAssignmentRows(assignments) {
  if (!assignments.length) {
    return '<tr><td colspan="4" class="empty-table">Δεν υπάρχει υλικό σε Μερικές Διαχειρίσεις.</td></tr>';
  }

  return assignments
    .map(
      (assignment) => `
        <tr>
          <td>${escapeHtml(assignment.holderName)}</td>
          <td>${escapeHtml(assignment.department)}</td>
          <td class="number-cell">${formatQuantity(assignment.quantity)}</td>
          <td>${escapeHtml(assignment.notes)}</td>
        </tr>
      `
    )
    .join('');
}

export { summaryItem, detailField, toggleField, getShareDetailControls, renderTransactionRows, renderAssignmentRows };
