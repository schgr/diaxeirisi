import { escapeHtml } from '../components/forms.js';
import { bindCategoryShareControls, bindRegistryControls, getMaterialCategoryNames, openCategorySharePreview, renderCategoryShareControls, renderMaterialRegistryPages, renderRegistryControls, renderSharesByCategoryPages } from '../prints/shareRegistryPrint.js';
import { bindExternalIndexControls, bindFiscalYearControls, bindOrdersIndexControls, renderExternalIndexTable, renderFiscalYearControls, renderIndexTableControls, renderOrdersIndexTable, renderChargeCreditOrdersIndex, renderExternalTransactionsIndex, renderIndexAnnualSignatures, selectFirstMaterialPerAddy } from '../prints/indexPrint.js';
import { bindAllShareCardControls, bindShareCardControls, printPreparedShareCards, renderAllShareCardControls, renderAllShareCardPreview, renderShareCardBatchPreview, renderShareCardControls, renderShareCardPreview } from '../prints/shareCardPrint.js';
import { printIsolatedPreview } from '../prints/printPreview.js';
import { bindInventoryPrintControls, renderInventoryPrintControls, renderInventoryStatement } from '../prints/inventoryPrint.js';
import { bindBalanceDifferenceControls, filterBalanceDifferences, renderBalanceDifferenceControls, renderBalanceDifferenceTable, renderMovementDifferencesIndex } from '../prints/administrationPrint.js';
import { getDefaultRegistryCount } from '../prints/shared.js';

export { renderBalanceDifferenceControls, renderBalanceDifferenceTable };

export { renderInventoryStatement };

export { renderChargeCreditOrdersIndex, renderExternalTransactionsIndex, renderIndexAnnualSignatures, selectFirstMaterialPerAddy };

export { renderMaterialRegistryPages, renderSharesByCategoryPages };

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
    sharePrintCards: [],
    sharePreviewPage: 0,
    shareRenderToken: 0,
    sharePrintBusy: false,
    shareFrom: '',
    shareTo: '',
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
          <div class="home-tile-grid print-tile-grid uniform-task-menu">
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
      preview.style.display = 'none';
      return;
    }

    if (state.activeTab === 'share-card') {
      title.textContent = 'Μερίδα Υλικού';
      if (options.latestInventoryShareCards) {
        controls.innerHTML = renderAllShareCardControls(shares.length, state);
        await renderAllShareCardPreview(
          sharesApi,
          shares,
          settings,
          state,
          preview
        );
        bindAllShareCardControls(container, preview, state, renderActiveTab);
      } else {
        controls.innerHTML = renderShareCardControls(shares, state);
        await renderShareCardPreview(sharesApi, shares, settings, state, preview);
        bindShareCardControls(container, sharesApi, shares, settings, state, preview);
      }
      preview.style.display = 'none';
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
      preview.style.display = 'none';
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
      if (['registry', 'share-card', 'balance-differences'].includes(state.activeTab)) {
        const titleByTab = {
          registry: 'Μητρώο Μερίδων',
          'share-card': 'Μερίδες Υλικού',
          'balance-differences': 'Πλεονάσματα - Ελλείμματα'
        };
        openPrintDocumentPreview(
          titleByTab[state.activeTab],
          preview.innerHTML,
          state.activeTab === 'balance-differences',
          state.activeTab === 'share-card'
            ? () => printPreparedShareCards(container, preview, settings, state)
            : null,
          state.activeTab === 'share-card' ? 'share-card-preview' : '',
          state.activeTab === 'share-card'
            ? (requestedPage, modalPreview) => {
                state.sharePreviewPage = Math.max(
                  0,
                  Math.min(Math.ceil(state.sharePrintCards.length / 20) - 1, requestedPage)
                );
                renderShareCardBatchPreview(
                  state.sharePrintCards,
                  settings,
                  state,
                  modalPreview
                );
              }
            : null
        );
        return;
      }
      if (state.activeTab === 'share-card') {
        void printPreparedShareCards(container, preview, settings, state);
        return;
      }
      if (['external', 'orders', 'movement-differences', 'balance-differences'].includes(state.activeTab)) {
        void printIsolatedPreview(preview, true);
        return;
      }
      void printIsolatedPreview(preview, false);
    }

    if (event.target.closest('[data-share-preview-page]')) {
      const requestedPage = Number(
        event.target.closest('[data-share-preview-page]').dataset.sharePreviewPage
      );
      state.sharePreviewPage = Math.max(
        0,
        Math.min(Math.ceil(state.sharePrintCards.length / 20) - 1, requestedPage)
      );
      renderShareCardBatchPreview(state.sharePrintCards, settings, state, preview);
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

function openPrintDocumentPreview(title, documentHtml, landscape = false, printAction = null, contentClass = '', pageAction = null) {
  document.querySelector('.generic-print-preview-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop index-document-preview-backdrop generic-print-preview-backdrop';
  backdrop.innerHTML = `
    <section class="request-document-modal index-document-preview-modal" role="dialog" aria-modal="true">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">ΠΡΟΕΠΙΣΚΟΠΗΣΗ</p><h2>${escapeHtml(title)}</h2></div>
        <div class="row-actions">
          <button class="primary-button" data-print-generic-preview type="button">Εκτύπωση</button>
          <button class="secondary-button" data-close-generic-preview type="button">Κλείσιμο</button>
        </div>
      </header>
      <div class="print-preview-shell index-document-preview-content ${escapeHtml(contentClass)}" data-generic-preview-content>${documentHtml}</div>
    </section>
  `;
  const close = () => backdrop.remove();
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-generic-preview]')) close();
    const pageButton = event.target.closest('[data-share-preview-page]');
    if (pageButton && pageAction) {
      pageAction(
        Number(pageButton.dataset.sharePreviewPage),
        backdrop.querySelector('[data-generic-preview-content]')
      );
    }
  });
  backdrop.querySelector('[data-print-generic-preview]').addEventListener('click', () => {
    if (printAction) {
      void printAction();
      return;
    }
    void printIsolatedPreview(backdrop.querySelector('[data-generic-preview-content]'), landscape);
  });
  document.body.appendChild(backdrop);
}
