import { escapeHtml, renderFiscalYearOptions } from '../components/forms.js';

import { renderShareBackTemplate, renderSharePrintDocument } from './sharesPage.js';
import { formatOfficerName, formatOfficerRank, splitOfficerSignature } from '../officerSignature.js';

const ROWS_PER_REGISTRY_PAGE = 25;
const ROWS_PER_INDEX_PAGE = 34;
const PRINT_TILE_META = {
  registry: { icon: 'ΜΜ', code: '§ ΣΕ-Α' },
  'share-card': { icon: 'ΜΥ', code: '§ ΣΕ-Β' },
  'shares-by-category': { icon: 'ΚΥ', code: '§ ΣΕ-Γ' },
  external: { icon: 'ΕΔ', code: '§ ΕΥ-Α' },
  orders: { icon: 'ΕΧ', code: '§ ΕΥ-Β' },
  'balance-differences': { icon: 'ΠΕ', code: '§ ΣΕ-Γ' }
};
const printTabGroups = [
  {
    key: 'shares',
    label: 'Μερίδες',
    tabs: [
      { key: 'registry', label: 'Μητρώο Μερίδων' },
      { key: 'share-card', label: 'Μερίδα Υλικού' },
      { key: 'shares-by-category', label: 'Μερίδες ανά Κατηγορία Υλικού' },
      { key: 'balance-differences', label: 'Πλεονάσματα - Ελλείμματα' }
    ]
  },
  {
    key: 'transactions',
    label: 'Δοσοληψίες',
    tabs: [
      { key: 'external', label: 'Ευρετήριο Εξωτερικών Δοσοληψιών' },
      { key: 'orders', label: 'Ευρετήριο Εντολών Χρεωπιστώσεως' }
    ]
  },
  {
    key: 'management',
    label: 'Διαφορές',
    tabs: [
      { key: 'movement-differences', label: 'Ευρετήριο Πρωτοκόλλων Διαφορών από Διακίνηση Υλικού' }
    ]
  }
];

export async function renderPrintsPage(
  container,
  sharesApi,
  settingsApi,
  transactionsApi,
  inventoryApi,
  movementDifferencesApi,
  administrationApi,
  showToast,
  options = {}
) {
  const [shares, settings, inventoryReference] = await Promise.all([
    sharesApi.list(),
    settingsApi.get(),
    inventoryApi.getReferenceData()
  ]);
  const visiblePrintTabGroups = getVisiblePrintTabGroups(options.visibleGroups);
  const initialGroup = visiblePrintTabGroups.some((group) => group.key === options.initialGroup)
    ? options.initialGroup
    : visiblePrintTabGroups[0].key;
  const materialCategories = getMaterialCategoryNames(shares, settings);
  const state = {
    activeGroup: initialGroup,
    activeTab: visiblePrintTabGroups.find((group) => group.key === initialGroup).tabs[0].key,
    showTileMenu: Boolean(options.tileMenu),
    displayCount: getDefaultRegistryCount(shares),
    fiscalYear: Number(settings?.serviceInfo?.activeFiscalYear || new Date().getFullYear()),
    selectedShareId: shares[0] ? shares[0].id : '',
    selectedInventoryId: inventoryReference.sessions[0] ? inventoryReference.sessions[0].id : '',
    onlyMovedCards: !options.latestInventoryShareCards,
    selectedAddyIndexId: '',
    selectedExhpIndexId: '',
    balanceDifferenceFilter: 'all',
    selectedMaterialCategories: []
  };

  container.innerHTML = `
    <section class="page-header no-print">
      <div>
        <p class="eyebrow">ΕΚΤΥΠΩΣΕΙΣ</p>
        <h2 id="prints-title">${escapeHtml(options.title || 'Εργασίες Οικονομικού Έτους')}</h2>
      </div>
    </section>

    <section class="page-panel no-print" ${options.tileMenu ? 'hidden' : ''} data-print-standard-menu>
      <details class="print-menu" open>
        <summary>${escapeHtml(options.menuTitle || 'Εργασίες Οικονομικού Έτους')}</summary>
        ${visiblePrintTabGroups.length > 1 ? `
          <div class="transaction-tabs" aria-label="Κατηγορίες εκτυπώσεων">
            ${visiblePrintTabGroups
            .map(
              (group) => `
                <button class="transaction-tab ${group.key === state.activeGroup ? 'active' : ''}" data-print-group="${group.key}" type="button">
                  ${group.label}
                </button>
              `
            )
            .join('')}
          </div>
        ` : ''}
        <div class="print-tabs" data-print-subtabs>
          ${renderPrintSubtabs(state, visiblePrintTabGroups)}
        </div>
      </details>
    </section>

    ${options.tileMenu ? `
      <section class="print-index-tile-menu no-print" data-print-tile-menu aria-label="${escapeHtml(options.menuTitle || 'Ευρετήρια')}">
        <div class="home-group corner print-tile-group">
          <div class="home-group-header">
            <p class="home-group-label">${escapeHtml(options.menuTitle || visiblePrintTabGroups[0].label)}</p>
            <span class="home-zone-tag">§ ${visiblePrintTabGroups[0].key === 'shares' ? 'ΣΕ' : 'ΕΥ'}</span>
          </div>
          <div class="home-tile-grid print-tile-grid">
            ${visiblePrintTabGroups[0].tabs.map((tab) => `
              <button class="home-tile panel corner" data-print-tab="${tab.key}" type="button">
                <span class="home-tile-icon" aria-hidden="true">${escapeHtml(PRINT_TILE_META[tab.key]?.icon || 'ΕΥ')}</span>
                <span class="home-tile-title">${escapeHtml(tab.label)}</span>
                <span class="home-tile-code">${escapeHtml(PRINT_TILE_META[tab.key]?.code || '§ ΕΥ')}</span>
              </button>
            `).join('')}
          </div>
        </div>
      </section>
      <div class="page-toolbar no-print" data-print-menu-back hidden>
        <button class="secondary-button" type="button">Πίσω στις Εκτυπώσεις</button>
      </div>
    ` : ''}

    <section class="page-panel no-print" data-print-controls-panel ${options.tileMenu ? 'hidden' : ''}>
      <div id="print-controls"></div>
    </section>

    <section id="print-preview" class="print-preview-shell" ${options.tileMenu ? 'hidden' : ''}></section>
  `;

  const title = container.querySelector('#prints-title');
  const controls = container.querySelector('#print-controls');
  const preview = container.querySelector('#print-preview');
  const tileMenu = container.querySelector('[data-print-tile-menu]');
  const menuBack = container.querySelector('[data-print-menu-back]');
  const controlsPanel = container.querySelector('[data-print-controls-panel]');

  async function renderActiveTab() {
    if (options.tileMenu) {
      container.classList.toggle('print-index-menu-mode', state.showTileMenu);
      tileMenu.hidden = !state.showTileMenu;
      tileMenu.style.display = state.showTileMenu ? '' : 'none';
      menuBack.hidden = state.showTileMenu;
      menuBack.style.display = state.showTileMenu ? 'none' : '';
      controlsPanel.hidden = state.showTileMenu;
      controlsPanel.style.display = state.showTileMenu ? 'none' : '';
      preview.hidden = state.showTileMenu;
      preview.style.display = state.showTileMenu ? 'none' : '';
      if (state.showTileMenu) {
        title.textContent = options.title || 'Ευρετήρια';
        controls.innerHTML = '';
        preview.innerHTML = '';
        return;
      }
    }
    renderPrintNavigation(container, state, visiblePrintTabGroups);
    preview.style.display = '';
    preview.classList.toggle('share-card-preview', state.activeTab === 'share-card');
    preview.classList.toggle('index-table-preview', ['external', 'orders'].includes(state.activeTab));

    container.querySelectorAll('[data-print-tab]').forEach((button) => {
      button.classList.toggle('active', button.dataset.printTab === state.activeTab);
    });

    if (state.activeTab === 'registry') {
      title.textContent = 'Μητρώο Μερίδων';
      controls.innerHTML = renderRegistryControls(shares.length, state);
      preview.innerHTML = renderMaterialRegistryPages(shares, settings, state);
      bindRegistryControls(container, shares, settings, state, preview);
      return;
    }

    if (state.activeTab === 'share-card') {
      title.textContent = 'Μερίδα Υλικού';
      if (options.latestInventoryShareCards) {
        controls.innerHTML = renderAllShareCardControls(shares.length);
        await renderAllShareCardPreview(
          sharesApi,
          shares,
          settings,
          state,
          preview
        );
        bindAllShareCardControls(container, preview);
      } else {
        controls.innerHTML = renderShareCardControls(shares, state);
        await renderShareCardPreview(sharesApi, shares, state, preview);
        bindShareCardControls(container, sharesApi, shares, state, preview);
      }
      return;
    }

    if (state.activeTab === 'shares-by-category') {
      title.textContent = 'Μερίδες ανά Κατηγορία Υλικού';
      controls.innerHTML = renderCategoryShareControls(materialCategories, state);
      preview.innerHTML = '';
      preview.style.display = 'none';
      bindCategoryShareControls(container, shares, settings, state);
      return;
    }

    if (state.activeTab === 'external') {
      const rows = await transactionsApi.listExternalIndexRows(state.fiscalYear);
      title.textContent = 'Ευρετήριο Εξωτερικών Δοσοληψιών';
      controls.innerHTML = renderIndexTableControls(state, 'external');
      preview.innerHTML = renderExternalIndexTable(rows);
      bindExternalIndexControls(
        container,
        transactionsApi,
        state,
        rows,
        settings,
        preview,
        renderActiveTab,
        showToast
      );
      return;
    }

    if (state.activeTab === 'inventory') {
      title.textContent = 'Κατάσταση Απογραφής';
      controls.innerHTML = renderInventoryPrintControls(inventoryReference.sessions, state);
      if (state.selectedInventoryId) {
        const session = await inventoryApi.getSession(Number(state.selectedInventoryId));
        preview.innerHTML = renderInventoryStatement(settings, session);
      } else {
        preview.innerHTML = '<section class="page-panel empty-table">Δεν υπάρχουν απογραφές.</section>';
      }
      bindInventoryPrintControls(container, state, renderActiveTab);
      return;
    }

    if (state.activeTab === 'movement-differences') {
      const protocols = await movementDifferencesApi.list(state.fiscalYear);
      title.textContent = 'Ευρετήριο Πρωτοκόλλων Διαφορών από Διακίνηση Υλικού';
      controls.innerHTML = renderFiscalYearControls(state);
      preview.innerHTML = renderMovementDifferencesIndex(settings, protocols);
      bindFiscalYearControls(container, state, renderActiveTab);
      return;
    }

    if (state.activeTab === 'balance-differences') {
      const rows = await administrationApi.getBalanceDifferences();
      title.textContent = 'Πλεονάσματα - Ελλείμματα';
      controls.innerHTML = renderBalanceDifferenceControls(state, rows);
      preview.innerHTML = renderBalanceDifferenceTable(
        filterBalanceDifferences(rows, state.balanceDifferenceFilter)
      );
      bindBalanceDifferenceControls(container, state, rows, preview);
      return;
    }

    const rows = await transactionsApi.listExhpIndexRows(state.fiscalYear);
    title.textContent = 'Ευρετήριο Εντολών Χρεωπιστώσεως';
    controls.innerHTML = renderIndexTableControls(state, 'orders');
    preview.innerHTML = renderOrdersIndexTable(rows);
    bindOrdersIndexControls(
      container,
      transactionsApi,
      state,
      rows,
      settings,
      preview,
      renderActiveTab,
      showToast
    );
  }

  container.addEventListener('click', (event) => {
    const groupButton = event.target.closest('[data-print-group]');
    if (groupButton) {
      const group = visiblePrintTabGroups.find((item) => item.key === groupButton.dataset.printGroup);
      if (!group) return;
      state.activeGroup = group.key;
      state.activeTab = group.tabs[0].key;
      renderActiveTab();
      return;
    }

    const tab = event.target.closest('[data-print-tab]');
    if (tab) {
      state.activeTab = tab.dataset.printTab;
      state.showTileMenu = false;
      renderActiveTab();
      return;
    }

    if (event.target.closest('[data-print-menu-back]')) {
      state.showTileMenu = true;
      renderActiveTab();
      return;
    }

    if (event.target.closest('#print-current-document')) {
      if (['external', 'orders', 'movement-differences', 'balance-differences'].includes(state.activeTab)) {
        void printIsolatedPreview(preview, true);
        return;
      }
      void printIsolatedPreview(preview, false);
    }

    if (event.target.closest('#preview-category-shares')) {
      openCategorySharePreview(
        renderSharesByCategoryPages(shares, settings, state.selectedMaterialCategories)
      );
    }
  });

  await renderActiveTab();
}

function getVisiblePrintTabGroups(visibleGroups) {
  if (!Array.isArray(visibleGroups) || !visibleGroups.length) {
    return printTabGroups;
  }
  const keys = new Set(visibleGroups);
  const groups = printTabGroups.filter((group) => keys.has(group.key));
  return groups.length ? groups : printTabGroups;
}

function renderPrintSubtabs(state, groups = printTabGroups) {
  const group = groups.find((item) => item.key === state.activeGroup) || groups[0];
  return group.tabs
    .map(
      (tab) => `
        <button class="nav-item ${tab.key === state.activeTab ? 'active' : ''}" data-print-tab="${tab.key}" type="button">
          ${tab.label}
        </button>
      `
    )
    .join('');
}

function renderPrintNavigation(container, state, groups = printTabGroups) {
  container.querySelectorAll('[data-print-group]').forEach((button) => {
    button.classList.toggle('active', button.dataset.printGroup === state.activeGroup);
  });
  const subtabs = container.querySelector('[data-print-subtabs]');
  if (subtabs) {
    subtabs.innerHTML = renderPrintSubtabs(state, groups);
  }
}

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

export function renderBalanceDifferenceControls(state, rows) {
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
        <button id="print-current-document" class="primary-button compact-print-button" type="button" ${rows.length ? '' : 'disabled'}>Εκτύπωση</button>
      </div>
    </div>
  `;
}

export function renderBalanceDifferenceTable(rows) {
  return `
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
          ${rows.length ? rows.map((row, index) => `
            <tr>
              <td>${index + 1}</td>
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
    </article>
  `;
}

function filterBalanceDifferences(rows, filter) {
  if (filter === 'deficit') return rows.filter((row) => row.status === 'Έλλειμμα');
  if (filter === 'surplus') return rows.filter((row) => row.status === 'Πλεόνασμα');
  return rows;
}

function bindBalanceDifferenceControls(container, state, rows, preview) {
  container.querySelector('#balance-difference-filter')?.addEventListener('change', (event) => {
    state.balanceDifferenceFilter = event.target.value;
    preview.innerHTML = renderBalanceDifferenceTable(
      filterBalanceDifferences(rows, state.balanceDifferenceFilter)
    );
  });
}

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

export function renderInventoryStatement(settings, session) {
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

async function printIsolatedPreview(preview, landscape) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = preview.innerHTML;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({ landscape });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

function renderShareCardControls(shares, state) {
  return `
    <div class="registry-controls share-print-controls">
      <label class="field">
        <span>Οικονομικό Έτος</span>
        <select id="prints-fiscal-year">${renderFiscalYearOptions(state.fiscalYear)}</select>
      </label>
      <label class="field">
        <span>Καρτέλα Υλικού</span>
        <select id="print-share-id" ${state.onlyMovedCards ? 'disabled' : ''}>
          ${shares
            .map(
              (share) =>
                `<option value="${share.id}" ${Number(state.selectedShareId) === Number(share.id) ? 'selected' : ''}>${escapeHtml(share.shareNumber)}</option>`
            )
            .join('')}
        </select>
      </label>
      <label class="field checkbox-field">
        <span>Με διακίνηση στο έτος</span>
        <input id="print-moved-only" type="checkbox" ${state.onlyMovedCards ? 'checked' : ''} />
      </label>
      <button id="print-current-document" class="primary-button" data-no-document-export type="button">Εκτύπωση</button>
    </div>
  `;
}

function renderAllShareCardControls(shareCount) {
  return `
    <div class="registry-controls share-print-controls all-share-controls">
      <div class="latest-inventory-share-summary">
        <span>Σύνολο Μερίδων Υλικού</span>
        <strong>${escapeHtml(shareCount)}</strong>
      </div>
      <button id="print-current-document" class="primary-button compact-print-button all-share-print-button" data-no-document-export type="button" ${shareCount ? '' : 'disabled'}>Εκτύπωση Μερίδων</button>
      <button id="print-share-back-side" class="secondary-button compact-print-button" data-no-document-export type="button">Προβολή Πίσω Πλευράς</button>
    </div>
  `;
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

  const cards = await Promise.all(shares.map(async (share) => {
    const card = await sharesApi.getCard(share.id, state.fiscalYear);
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
  }));
  if (state.activeTab !== 'share-card') return;

  const issuer = splitOfficerSignature(settings?.financialOfficers?.ped || '');
  preview.innerHTML = cards
    .map((card) => renderSharePrintDocument(card, {
      issuerName: issuer.name,
      issuerRank: issuer.rank
    }))
    .join('');
}

function bindAllShareCardControls(container, preview) {
  const button = container.querySelector('#print-share-back-side');
  if (!button) return;
  button.addEventListener('click', () => openShareBackPreview(renderShareBackTemplate()));
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

function bindShareCardControls(container, sharesApi, shares, state, preview) {
  const yearInput = container.querySelector('#prints-fiscal-year');
  const shareSelect = container.querySelector('#print-share-id');
  const movedOnly = container.querySelector('#print-moved-only');
  if (!yearInput || !shareSelect || !movedOnly) return;

  async function updatePreview() {
    state.fiscalYear = Number(yearInput.value) || new Date().getFullYear();
    state.selectedShareId = shareSelect.value;
    state.onlyMovedCards = movedOnly.checked;
    shareSelect.disabled = state.onlyMovedCards;
    await renderShareCardPreview(sharesApi, shares, state, preview);
  }

  yearInput.addEventListener('change', updatePreview);
  shareSelect.addEventListener('change', updatePreview);
  movedOnly.addEventListener('change', updatePreview);
}

async function renderShareCardPreview(sharesApi, shares, state, preview) {
  if (!shares.length) {
    preview.innerHTML = '<section class="page-panel empty-table">Δεν υπάρχουν καρτέλες υλικού.</section>';
    return;
  }

  if (state.onlyMovedCards) {
    const cards = await Promise.all(shares.map((share) => sharesApi.getCard(share.id, state.fiscalYear)));
    if (state.activeTab !== 'share-card') return;
    const movedCards = cards.filter((card) => card.transactions.length);
    preview.innerHTML = movedCards.length
      ? movedCards.map(renderSharePrintDocument).join('')
      : '<section class="page-panel empty-table">Δεν υπάρχουν καρτέλες με διακίνηση για το έτος.</section>';
    return;
  }

  const selectedId = Number(state.selectedShareId) || shares[0].id;
  const card = await sharesApi.getCard(selectedId, state.fiscalYear);
  if (state.activeTab !== 'share-card') return;
  preview.innerHTML = renderSharePrintDocument(card);
}

function renderFiscalYearControls(state) {
  return `
    <div class="registry-controls">
      <label class="field">
        <span>Οικονομικό Έτος</span>
        <select id="prints-fiscal-year">${renderFiscalYearOptions(state.fiscalYear)}</select>
      </label>
      <button id="print-current-document" class="primary-button compact-print-button" type="button">Εκτύπωση</button>
    </div>
  `;
}

function renderIndexTableControls(state, type) {
  return `
    <div class="registry-controls index-table-controls">
      <label class="field">
        <span>Οικονομικό Έτος</span>
        <select id="prints-fiscal-year">${renderFiscalYearOptions(state.fiscalYear)}</select>
      </label>
      <div class="row-actions index-table-actions">
        <button id="preview-index-document" class="secondary-button" type="button" data-index-type="${type}">Προβολή</button>
      </div>
    </div>
  `;
}

function renderExternalIndexTable(rows) {
  return renderEditableIndexTable({
    className: 'external-index-data-table',
    headers: [
      'Α/Α',
      'Ημερομηνία',
      'Μονάδα',
      'Είδος Δικ/κού',
      'Α/Ο Υλικού',
      'Αριθμός / Ημερομηνία Δικαιολογητικού',
      'Ημερομηνία Παραλαβής ή (ΔΙΑΖ) Αποστολής Υλικού',
      'Ημερομηνία Επιστροφής ή (ΔΙΑΖ) Παραλαβής Οριστικού «Π»-«Χ» Δικαιολογητικού Δοσοληψίας',
      'Παρατηρήσεις'
    ],
    rows,
    cells: (row) => [
      escapeHtml(row.serial),
      escapeHtml(formatDate(row.date)),
      escapeHtml(row.unit),
      escapeHtml(row.documentType),
      escapeHtml(row.nominalNumber),
      indexTableInput(row, 7, row.indexField7),
      indexTableInput(row, 8, row.indexField8),
      indexTableInput(row, 9, row.indexField9),
      escapeHtml(row.notes)
    ]
  });
}

function renderOrdersIndexTable(rows) {
  return renderEditableIndexTable({
    className: 'orders-index-data-table',
    headers: [
      'Α/Α',
      'Ημερομηνία',
      'Αιτιολογία Εκδόσεως',
      'Ημερομηνία Αποστολής προς Έγκριση',
      'Αριθμός / Ημερομηνία Εγκρίσεως',
      'Παρατηρήσεις'
    ],
    rows,
    cells: (row) => [
      escapeHtml(row.serial),
      escapeHtml(formatDate(row.date)),
      escapeHtml(row.reason),
      escapeHtml(formatDate(row.date)),
      indexTableInput(row, 6, row.indexField6),
      indexTableInput(row, 7, row.indexField7)
    ]
  });
}

function renderEditableIndexTable({ className, headers, rows, cells }) {
  return `
    <section class="page-panel index-table-panel">
      <div class="table-wrap index-table-editor-wrap">
        <table class="index-table index-table-editor ${className}">
          <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.length
              ? rows.map((row) => `<tr data-index-row="${row.id}">${cells(row).map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')
              : `<tr><td colspan="${headers.length}" class="empty-table">Δεν υπάρχουν εγγραφές για το επιλεγμένο οικονομικό έτος.</td></tr>`}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

function indexTableInput(row, field, value) {
  return `<input class="index-cell-input" data-index-id="${row.id}" data-index-field="${field}" value="${escapeHtml(value || '')}" />`;
}

function bindExternalIndexControls(
  container,
  transactionsApi,
  state,
  rows,
  settings,
  preview,
  renderActiveTab,
  showToast
) {
  bindFiscalYearControls(container, state, renderActiveTab);
  const previewButton = container.querySelector('#preview-index-document');
  if (!previewButton) return;
  const saveRows = async (rowsToSave = rows) => {
    const values = collectIndexTableValues(preview, [7, 8, 9]);
    const uniqueRows = [...new Map(rowsToSave.map((row) => [Number(row.id), row])).values()];
    await Promise.all(uniqueRows.map((row) => transactionsApi.updateAddyIndexFields(row.id, {
      field7: values.get(row.id)?.[7] || '',
      field8: values.get(row.id)?.[8] || '',
      field9: values.get(row.id)?.[9] || ''
    })));
  };
  preview.oninput = (event) => {
    const input = event.target.closest('.index-cell-input');
    if (!input) return;
    preview.querySelectorAll('.index-cell-input').forEach((candidate) => {
      if (candidate === input) return;
      if (candidate.dataset.indexId !== input.dataset.indexId) return;
      if (candidate.dataset.indexField !== input.dataset.indexField) return;
      candidate.value = input.value;
    });
  };
  preview.onchange = async (event) => {
    const input = event.target.closest('.index-cell-input');
    if (!input) return;
    try {
      await saveRows(rows.filter((row) => Number(row.id) === Number(input.dataset.indexId)));
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ευρετηρίου.', 'error');
    }
  };
  previewButton.addEventListener('click', async () => {
    try {
      await saveRows();
      const allRows = collectIndexRows(preview, rows, [7, 8, 9]);
      openIndexDocumentPreview(
        'Ευρετήριο Εξωτερικών Δοσοληψιών',
        renderExternalTransactionsIndex(settings, allRows),
        settings.financialOfficers,
        {
          singleMaterialHtml: renderExternalTransactionsIndex(
            settings,
            selectFirstMaterialPerAddy(allRows)
          )
        }
      );
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ευρετηρίου.', 'error');
    }
  });
}

function bindOrdersIndexControls(
  container,
  transactionsApi,
  state,
  rows,
  settings,
  preview,
  renderActiveTab,
  showToast
) {
  bindFiscalYearControls(container, state, renderActiveTab);
  const previewButton = container.querySelector('#preview-index-document');
  if (!previewButton) return;
  const saveRows = async (rowsToSave = rows) => {
    const values = collectIndexTableValues(preview, [6, 7]);
    const uniqueRows = [...new Map(rowsToSave.map((row) => [Number(row.id), row])).values()];
    await Promise.all(uniqueRows.map((row) => transactionsApi.updateExhpIndexFields(row.id, {
      field6: values.get(row.id)?.[6] || '',
      field7: values.get(row.id)?.[7] || ''
    })));
  };
  preview.onchange = async (event) => {
    const input = event.target.closest('.index-cell-input');
    if (!input) return;
    try {
      await saveRows(rows.filter((row) => Number(row.id) === Number(input.dataset.indexId)));
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ευρετηρίου.', 'error');
    }
  };
  previewButton.addEventListener('click', async () => {
    try {
      await saveRows();
      openIndexDocumentPreview(
        'Ευρετήριο Εντολών Χρεωπιστώσεως',
        renderChargeCreditOrdersIndex(settings, collectIndexRows(preview, rows, [6, 7])),
        settings.financialOfficers
      );
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση του ευρετηρίου.', 'error');
    }
  });
}

function collectIndexTableValues(preview, fields) {
  const values = new Map();
  preview.querySelectorAll('.index-cell-input').forEach((input) => {
    const id = Number(input.dataset.indexId);
    const field = Number(input.dataset.indexField);
    if (!fields.includes(field)) return;
    if (!values.has(id)) values.set(id, {});
    values.get(id)[field] = input.value.trim();
  });
  return values;
}

function collectIndexRows(preview, rows, fields) {
  const values = collectIndexTableValues(preview, fields);
  return rows.map((row) => {
    const result = { ...row };
    fields.forEach((field) => { result[`indexField${field}`] = values.get(Number(row.id))?.[field] || ''; });
    return result;
  });
}

export function selectFirstMaterialPerAddy(rows = []) {
  const documentIds = new Set();
  return rows
    .filter((row) => {
      const id = Number(row.id);
      if (documentIds.has(id)) return false;
      documentIds.add(id);
      return true;
    })
    .map((row, index) => ({ ...row, serial: index + 1 }));
}

function openIndexDocumentPreview(title, documentHtml, financialOfficers = {}, options = {}) {
  document.querySelector('.index-document-preview-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop index-document-preview-backdrop';
  backdrop.innerHTML = `
    <div class="request-document-modal index-document-preview-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">ΕΛΕΓΧΟΣ ΕΚΤΥΠΩΣΗΣ</p><h2>${escapeHtml(title)}</h2></div>
        <div class="row-actions">
          ${options.singleMaterialHtml ? '<button class="secondary-button" data-toggle-index-materials type="button">Εκτύπωση με ένα υλικό ανά ΑΔΔΥ</button>' : ''}
          <button class="secondary-button" data-toggle-index-signatures type="button">Υπογραφές Έτους</button>
          <button class="secondary-button" data-close-index-preview type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-index-preview data-no-document-export type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="print-preview-shell index-document-preview-content">${documentHtml}</div>
    </div>
  `;
  const content = backdrop.querySelector('.index-document-preview-content');
  const signaturesButton = backdrop.querySelector('[data-toggle-index-signatures]');
  const materialsButton = backdrop.querySelector('[data-toggle-index-materials]');
  let signaturesVisible = false;
  let singleMaterialVisible = false;

  const renderPreviewContent = () => {
    content.innerHTML = singleMaterialVisible ? options.singleMaterialHtml : documentHtml;
    if (signaturesVisible) {
      content.querySelector('.official-index-page:last-child')?.insertAdjacentHTML(
        'beforeend',
        renderIndexAnnualSignatures(financialOfficers)
      );
    }
  };

  materialsButton?.addEventListener('click', () => {
    singleMaterialVisible = !singleMaterialVisible;
    materialsButton.textContent = singleMaterialVisible
      ? 'Εκτύπωση με όλα τα υλικά'
      : 'Εκτύπωση με ένα υλικό ανά ΑΔΔΥ';
    materialsButton.classList.toggle('active', singleMaterialVisible);
    renderPreviewContent();
  });
  signaturesButton.addEventListener('click', () => {
    signaturesVisible = !signaturesVisible;
    signaturesButton.textContent = signaturesVisible ? 'Απόκρυψη Υπογραφών' : 'Υπογραφές Έτους';
    signaturesButton.classList.toggle('active', signaturesVisible);
    renderPreviewContent();
  });
  backdrop.querySelector('[data-close-index-preview]').addEventListener('click', () => backdrop.remove());
  backdrop.querySelector('[data-print-index-preview]').addEventListener('click', () => {
    void printIsolatedPreview(content, true);
  });
  backdrop.addEventListener('click', (event) => { if (event.target === backdrop) backdrop.remove(); });
  document.body.appendChild(backdrop);
}

export function renderIndexAnnualSignatures(financialOfficers = {}) {
  const commander = splitOfficerSignature(financialOfficers.commander);
  const ped = splitOfficerSignature(financialOfficers.ped);
  const manager = splitOfficerSignature(financialOfficers.manager);
  return `
    <div class="official-index-annual-signatures">
      <div class="official-index-signature-column">
        <strong>ΘΕΩΡΗΘΗΚΕ</strong>
        <span>Ο</span>
        <span>ΔΚΤΗΣ</span>
        ${renderIndexSignatureIdentity(commander)}
      </div>
      <div class="official-index-signature-column">
        <span>Ο</span>
        <span>Π.Ε.Δ</span>
        ${renderIndexSignatureIdentity(ped)}
      </div>
      <div class="official-index-signature-column">
        <span>Ο</span>
        <span>ΔΧΣΤΗΣ</span>
        ${renderIndexSignatureIdentity(manager)}
      </div>
    </div>
  `;
}

function renderIndexSignatureIdentity(officer) {
  return `
    <b class="official-index-signature-name">${escapeHtml(officer.name)}</b>
    <em class="official-index-signature-rank">${escapeHtml(officer.rank)}</em>
  `;
}

function bindFiscalYearControls(container, state, renderActiveTab) {
  const input = container.querySelector('#prints-fiscal-year');
  if (!input) return;
  input.addEventListener('change', () => {
    state.fiscalYear = Number(input.value) || new Date().getFullYear();
    renderActiveTab();
  });
}

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

export function renderSharesByCategoryPages(shares, settings, selectedCategories) {
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

export function renderMaterialRegistryPages(shares, settings, state) {
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

export function renderExternalTransactionsIndex(settings, entries) {
  return renderOfficialIndexPages({
    unit: settings.serviceInfo.serviceName,
    image: 'te34-254-page-227.png',
    rowsPerPage: 22,
    rowTop: 38.45,
    rowStep: 2.08,
    columns: [
      { left: 6.1, width: 3.8 },
      { left: 9.95, width: 10.5 },
      { left: 20.5, width: 10.1 },
      { left: 30.65, width: 10.05 },
      { left: 40.75, width: 11.65 },
      { left: 52.45, width: 11.95 },
      { left: 64.45, width: 9.7 },
      { left: 74.2, width: 9.65 },
      { left: 83.95, width: 10.3, className: 'official-index-left-cell' }
    ],
    rows: entries.map((entry) => {
      return [
        entry.serial,
        formatDate(entry.date),
        entry.unit,
        entry.documentType,
        entry.nominalNumber,
        entry.indexField7 || '',
        entry.indexField8 || '',
        entry.indexField9 || '',
        entry.notes
      ];
    })
  });
}

export function renderChargeCreditOrdersIndex(settings, entries) {
  return renderOfficialIndexPages({
    unit: settings.serviceInfo.serviceName,
    image: 'te34-254-page-228.png',
    rowsPerPage: 27,
    rowTop: 29.95,
    rowStep: 2.13,
    columns: [
      { left: 6.1, width: 3.8 },
      { left: 9.95, width: 11.85 },
      { left: 21.85, width: 28.6 },
      { left: 50.5, width: 13.4 },
      { left: 64.0, width: 21.85 },
      { left: 85.9, width: 8.4 }
    ],
    rows: entries.map((entry) => [
      entry.serial,
      formatDate(entry.date),
      entry.reason,
      formatDate(entry.date),
      entry.indexField6 || '',
      entry.indexField7 || ''
    ])
  });
}

function renderOfficialIndexPages(config) {
  const pageCount = Math.max(1, Math.ceil((config.rows || []).length / config.rowsPerPage));
  return Array.from({ length: pageCount }, (_unused, pageIndex) => {
    const rows = (config.rows || []).slice(
      pageIndex * config.rowsPerPage,
      (pageIndex + 1) * config.rowsPerPage
    );
    return renderOfficialIndexPage({ ...config, rows, pageNumber: pageIndex + 1, pageCount });
  }).join('');
}

function renderOfficialIndexPage({ unit, image, rows, rowsPerPage, rowTop, rowStep, columns, pageNumber, pageCount }) {
  const overlays = [
    officialIndexOverlay(unit, 13.2, 11.75, 16, 2.7, 'official-index-unit')
  ];
  const pageRows = Array.from({ length: rowsPerPage }, (_unused, index) => rows[index] || null);
  pageRows.forEach((row, rowIndex) => {
    if (!row) return;
    columns.forEach((column, columnIndex) => {
      overlays.push(officialIndexOverlay(
        row[columnIndex] || '',
        column.left,
        rowTop + (rowIndex * rowStep),
        column.width,
        rowStep,
        `official-index-cell ${column.className || ''}`.trim()
      ));
    });
  });
  return `
    <article class="official-index-page print-document-area">
      <img src="./assets/official-forms/${image}" alt="Επίσημο ευρετήριο ΤΕ 34-254" />
      <div class="official-index-cleanup official-index-page-number-mask"></div>
      <div class="official-index-cleanup official-index-footer-mask"></div>
      <div class="official-index-page-counter">Σελίδα ${pageNumber} από Σελίδα ${pageCount}</div>
      ${overlays.join('')}
    </article>
  `;
}

function officialIndexOverlay(value, left, top, width, height, className) {
  return `<div class="official-index-overlay ${className}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;">${escapeHtml(value ?? '')}</div>`;
}

function renderIndexPages(config) {
  const rowsPerPage = config.rowsPerPage || ROWS_PER_INDEX_PAGE;
  const pageCount = Math.max(1, Math.ceil((config.rows || []).length / rowsPerPage));
  return Array.from({ length: pageCount }, (_unused, pageIndex) =>
    renderIndexPage({
      ...config,
      rows: (config.rows || []).slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage),
      rowsPerPage
    })
  ).join('');
}

function renderIndexPage({ unit, code, subCode, title, subtitle, columns, numbers, rows = [], rowsPerPage = ROWS_PER_INDEX_PAGE }) {
  const pageRows = Array.from({ length: rowsPerPage }, (_unused, index) => rows[index] || null);
  return `
    <article class="index-page print-document-area">
      <div class="index-topline">
        <span>ΜΟΝΑΔΑ:${escapeHtml(unit || '')}</span>
        <span><strong>${code}</strong>${subCode ? `<br />${subCode}` : ''}</span>
      </div>
      <h1>${title}</h1>
      ${subtitle ? `<h2>${subtitle}</h2>` : ''}
      <table class="index-table index-columns-${columns.length}">
        <thead>
          <tr>${columns.map((column) => `<th>${column}</th>`).join('')}</tr>
          <tr>${numbers.map((number) => `<th>${number}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${pageRows.map((row) => `<tr>${columns.map((_column, index) => `<td>${row ? escapeHtml(row[index] || '') : ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </article>
  `;
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  if (!year || !month || !day) return value;
  return `${day}/${month}/${year}`;
}

function formatNumber(value) {
  return Number(value).toLocaleString('el-GR', { maximumFractionDigits: 3 });
}

function formatSignedNumber(value) {
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${formatNumber(number)}`;
}

function compareShareNumbers(a, b) {
  const left = Number(a.shareNumber);
  const right = Number(b.shareNumber);
  if (Number.isFinite(left) && Number.isFinite(right)) return left - right;
  return String(a.shareNumber).localeCompare(String(b.shareNumber), 'el');
}

function getDefaultRegistryCount(shares) {
  const maxShareNumber = shares.reduce((max, share) => {
    const number = Number(share.shareNumber);
    return Number.isInteger(number) && number > max ? number : max;
  }, 0);
  return Math.max(maxShareNumber, shares.length, 1);
}

function printLandscapeDocument() {
  const style = document.createElement('style');
  style.textContent = '@page { size: A4 landscape; margin: 0; }';
  document.head.appendChild(style);
  window.print();
  window.setTimeout(() => style.remove(), 500);
}
