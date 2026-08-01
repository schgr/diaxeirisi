import { escapeHtml } from '../components/forms.js';
import { formatOfficerName, formatOfficerRank, splitOfficerSignature } from '../officerSignature.js';
import { formatDate, formatNumber } from './shared.js';

function renderInventoryPrintControls(sessions, state) {
  return `
    <div class="registry-controls inventory-print-controls">
      <label class="field">
        <span>Απογραφή</span>
        <select id="prints-inventory-id">
          ${sessions.map((session) => `
            <option value="${session.id}" ${Number(state.selectedInventoryId) === Number(session.id) ? 'selected' : ''}>
              ${session.serialNumber} - ${escapeHtml(session.title)}
            </option>
          `).join('')}
        </select>
      </label>
      <button id="print-current-document" class="primary-button compact-print-button" type="button">Εκτύπωση</button>
    </div>
  `;
}

function bindInventoryPrintControls(container, state, renderActiveTab) {
  const select = container.querySelector('#prints-inventory-id');
  if (!select) return;
  select.addEventListener('change', () => {
    state.selectedInventoryId = select.value;
    renderActiveTab();
  });
}

function renderInventoryStatement(settings, session) {
  const rowsPerPage = 28;
  const pageCount = Math.max(1, Math.ceil(session.items.length / rowsPerPage));
  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const rows = session.items.slice(pageIndex * rowsPerPage, pageIndex * rowsPerPage + rowsPerPage);
    return `
      <article class="official-inventory-page print-document-area">
        <img src="./assets/official-forms/inventory-statement-clean.png" alt="Κατάσταση Απογραφής" />
        ${inventoryDocumentOverlay(pageIndex + 1, 74.5, 9.45, 10.0, 1.8, 'inventory-meta-overlay')}
        ${inventoryDocumentOverlay(pageCount, 74.5, 11.05, 10.0, 1.8, 'inventory-meta-overlay')}
        ${inventoryDocumentOverlay(settings.serviceInfo.serviceName || '', 20.0, 13.15, 13.5, 2.2, 'inventory-meta-overlay')}
        ${inventoryDocumentOverlay(settings.serviceInfo.managementType || '', 42.0, 13.45, 12.0, 1.8, 'inventory-meta-overlay')}
        ${inventoryDocumentOverlay(formatDate(session.periodStart || session.inventoryDate), 64.0, 14.45, 12.0, 2.0, 'inventory-date-overlay')}
        ${inventoryDocumentOverlay(formatDate(session.periodEnd || session.inventoryDate), 82.0, 14.45, 12.0, 2.0, 'inventory-date-overlay')}
        ${renderOfficialInventoryRows(rows, pageIndex * rowsPerPage)}
        ${renderInventoryOfficerSignature(settings.financialOfficers?.commander, 9.0, 86.0, 20.8, 4.8)}
        ${renderInventoryCommitteeSignatures(session, 31.0, 85.6, 20.5, 5.4)}
        ${renderInventoryOfficerSignature(settings.financialOfficers?.manager, 53.0, 86.0, 20.5, 4.8)}
        ${renderInventoryOfficerSignature(settings.financialOfficers?.ped, 75.0, 86.0, 20.5, 4.8)}
      </article>
    `;
  }).join('');
}

function renderOfficialInventoryRows(rows, offset) {
  const columns = [
    { left: 8.7, width: 4.6, value: (_item, index) => offset + index + 1 },
    { left: 13.5, width: 6.6, value: (item) => item.shareNumber },
    { left: 20.3, width: 16.5, value: (item) => item.nominalNumber },
    { left: 37.0, width: 22.4, value: (item) => item.description, className: 'material-description-overlay' },
    { left: 59.7, width: 3.1, value: (item) => item.measurementUnit },
    { left: 63.1, width: 5.3, value: (item) => formatNumber(item.finalCount) },
    { left: 68.6, width: 5.3, value: (item) => formatNumber(item.accountingBalance) },
    { left: 74.0, width: 5.2, value: (item) => formatInventorySurplus(item.difference) },
    { left: 79.4, width: 5.2, value: (item) => formatInventoryDeficit(item.difference) },
    { left: 84.8, width: 11.2, value: (item) => item.settlementReference }
  ];
  return rows.map((item, rowIndex) => columns.map((column) => inventoryDocumentOverlay(
    column.value(item, rowIndex),
    column.left,
    35.15 + rowIndex * 1.7,
    column.width,
    1.7,
    `inventory-row-overlay ${column.className || ''}`.trim()
  )).join('')).join('');
}

function inventoryDocumentOverlay(value, left, top, width, height, className = '') {
  return `<div class="official-inventory-overlay ${className}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escapeHtml(value ?? '')}</div>`;
}

function formatInventorySurplus(difference) {
  return Number(difference) > 0 ? formatNumber(difference) : '0';
}

function formatInventoryDeficit(difference) {
  return Number(difference) < 0 ? formatNumber(Math.abs(difference)) : '0';
}

function renderInventoryOfficerSignature(value, left, top, width, height) {
  const officer = splitOfficerSignature(value);
  return renderInventorySignature(officer.name, officer.rank, left, top, width, height);
}

function renderInventorySignature(name, rank, left, top, width, height) {
  return `
    <div class="official-inventory-overlay inventory-signature-overlay" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">
      <strong>${escapeHtml(name || '')}</strong>
      <em>${escapeHtml(rank || '')}</em>
    </div>
  `;
}

function renderInventoryCommitteeSignatures(session, left, top, width, height) {
  const members = [
    ['Πρόεδρος', session.committeePresidentName, session.committeePresidentRank],
    ['Α΄ Μέλος', session.committeeMemberAName, session.committeeMemberARank],
    ['Β΄ Μέλος', session.committeeMemberBName, session.committeeMemberBRank]
  ];
  return `
    <div class="official-inventory-overlay inventory-committee-overlay" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">
      ${members.map(([_role, name, rank]) => `
        <span><b>${escapeHtml(formatOfficerName(name))}</b><i>${escapeHtml(formatOfficerRank(rank))}</i></span>
      `).join('')}
    </div>
  `;
}

export { bindInventoryPrintControls, renderInventoryPrintControls, renderInventoryStatement };
