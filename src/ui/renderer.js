import { renderHomeTiles } from './navigation.js';
import { renderSharesPage } from './pages/sharesPage.js';
import { renderSettingsPage } from './pages/settingsPage.js';
import { renderTransactionsPage } from './pages/transactionsPage.js';
import { renderRequestsPage } from './pages/requestsPage.js';
import { renderPlaceholderPage } from './pages/placeholderPage.js';
import { renderPrintsPage } from './pages/printsPage.js';
import { renderChargesPage } from './pages/chargesPage.js';
import { renderInventoryPage } from './pages/inventoryPage.js';
import { renderMovementDifferencesPage } from './pages/movementDifferencesPage.js';
import { renderAdministrationPage } from './pages/administrationPage.js';
import { showToast } from './components/toast.js';
import { escapeHtml } from './components/forms.js';

const THEME_STORAGE_KEY = 'diaxeirisi-theme';
const DEFAULT_THEME = 'blueprint';

applyStoredTheme();

const sections = [
  { id: 'shares', title: 'ΜΕΡΙΔΕΣ', type: 'shares' },
  { id: 'charges', title: 'ΧΟΡΗΓΗΣΕΙΣ ΣΕ ΤΜΗΜΑΤΑ', type: 'charges' },
  { id: 'transactions', title: 'ΔΟΣΟΛΗΨΙΕΣ', type: 'transactions' },
  { id: 'movement-differences', title: 'ΔΙΑΦΟΡΕΣ', type: 'movement-differences' },
  { id: 'requests', title: 'ΑΙΤΗΣΕΙΣ', type: 'requests' },
  { id: 'as', title: 'ΑΠΟΓΡΑΦΕΣ', type: 'inventory' },
  { id: 'administration', title: 'ΔΙΑΧΕΙΡΙΣΗ', type: 'administration' },
  {
    id: 'prints',
    title: 'ΕΚΤΥΠΩΣΕΙΣ',
    type: 'prints',
    hidden: true,
    printOptions: {
      title: 'Συγκεντρωτικές Εκτυπώσεις',
      menuTitle: 'Μερίδες Υλικού',
      visibleGroups: ['shares'],
      initialGroup: 'shares',
      tileMenu: true
    }
  },
  {
    id: 'indexes',
    title: 'ΕΥΡΕΤΗΡΙΑ',
    type: 'prints',
    hidden: true,
    printOptions: {
      title: 'Ευρετήρια',
      menuTitle: 'Ευρετήρια Δοσοληψιών',
      visibleGroups: ['transactions'],
      initialGroup: 'transactions',
      tileMenu: true
    }
  },
  {
    id: 'movement-difference-indexes',
    title: 'ΕΥΡΕΤΗΡΙΑ ΔΙΑΦΟΡΩΝ',
    type: 'prints',
    hidden: true,
    printOptions: {
      title: 'Ευρετήριο Πρωτοκόλλων Διαφορών από Διακίνηση Υλικού',
      menuTitle: 'Ευρετήρια Πρωτοκόλλων Διαφορών από Διακίνηση Υλικού',
      visibleGroups: ['management'],
      initialGroup: 'management'
    }
  },
  { id: 'settings', title: 'ΡΥΘΜΙΣΕΙΣ', type: 'settings' }
];

const homeGroups = [
  {
    label: 'Υλικό και κινήσεις',
    items: [
      { id: 'shares', title: 'Μερίδες' },
      { id: 'transactions', title: 'Δοσοληψίες' },
      { id: 'indexes', title: 'Ευρετήρια' },
      { id: 'charges', title: 'Χορηγήσεις σε τμήματα' },
      { id: 'requests', title: 'Αιτήσεις' }
    ]
  },
  {
    label: 'Έλεγχος και συμφωνία',
    items: [
      { id: 'as', title: 'Απογραφές' },
      { id: 'movement-differences', title: 'Διαφορές' }
    ]
  },
  {
    label: 'Διαχείριση',
    items: [
      { id: 'administration-handover', sectionId: 'administration', tab: 'handover', title: 'Παράδοση - Παραλαβή' },
      { id: 'administration-archive', sectionId: 'administration', tab: 'archive', title: 'Αρχείο Μερίδων' },
      { id: 'administration-aggregate-prints', sectionId: 'administration', tab: 'aggregate-prints', title: 'Συγκεντρωτικές Εκτυπώσεις' },
      { id: 'administration-serial-numbers', sectionId: 'administration', tab: 'serial-numbers', title: 'Σειριακοί Αριθμοί' }
    ]
  },
  {
    label: 'Ρυθμίσεις',
    items: [
      { id: 'settings-general', sectionId: 'settings', tab: 'general', title: 'Γενικά' },
      { id: 'settings-personnel', sectionId: 'settings', tab: 'personnel', title: 'Προσωπικό' },
      { id: 'settings-parameters', sectionId: 'settings', tab: 'parameters', title: 'Παράμετροι' }
    ]
  }
];

const state = {
  activeSection: 'home',
  inventoryTab: 'counts',
  administrationTab: 'handover',
  settingsTab: 'general'
};

const app = document.querySelector('#app');

document.addEventListener('diaxeirisi:navigate', (event) => {
  const detail = event.detail || {};
  navigate(detail.sectionId, detail);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;

  const modals = [...document.querySelectorAll('.modal-backdrop')];
  const modal = modals[modals.length - 1];

  event.preventDefault();
  event.stopPropagation();

  if (!modal) {
    showWindowOptions();
    return;
  }

  const closeControl = modal.querySelector([
    '[data-close-exhp-document]',
    '[data-close-exhp-doc-preview]',
    '[data-close-addy-document]',
    '[data-close-support-folder]',
    '[data-close-template]',
    '[data-close-card]',
    '[data-close-material-form]',
    '[data-close-share-print]',
    '[data-close-md-document]',
    '[data-close-k2310]',
    '[data-close-renewals]',
    '[data-cancel-composition]',
    '[data-cancel-internal-composition]'
  ].join(','));

  if (closeControl) {
    closeControl.click();
  } else {
    modal.remove();
  }
});

function applyStoredTheme() {
  window.localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.dataset.theme = DEFAULT_THEME;
}

function renderShell() {
  app.innerHTML = `
    <div class="app-shell app-shell-headerless">
      <main class="content">
        <div id="page-root"></div>
      </main>
      <div id="toast-root" class="toast-root"></div>
    </div>
  `;

  void renderAppVersion();
  renderActivePage();
}

async function renderAppVersion() {
  try {
    const version = await window.appApi.app.getVersion();
    const targets = document.querySelectorAll('#home-version-label');
    targets.forEach((target) => {
      target.textContent = `v${version}`;
    });
  } catch (_error) {
    const targets = document.querySelectorAll('#home-version-label');
    targets.forEach((target) => {
      target.textContent = '';
    });
  }
}

function showWindowOptions() {
  if (document.querySelector('[data-window-options-modal]')) return;

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop window-options-backdrop';
  modal.dataset.windowOptionsModal = 'true';
  modal.innerHTML = `
    <div class="window-options-modal" role="dialog" aria-modal="true" aria-labelledby="window-options-title">
      <h2 id="window-options-title">Επιλογές παραθύρου</h2>
      <div class="window-options-actions">
        <button class="secondary-button" data-window-action="exit-fullscreen" type="button">Έξοδος από πλήρη οθόνη</button>
        <button class="secondary-button" data-window-action="minimize" type="button">Ελαχιστοποίηση παραθύρου</button>
        <button class="primary-button" data-window-action="save" type="button">Αποθήκευση αλλαγών</button>
        <button class="danger-button" data-window-action="save-exit" type="button">Αποθήκευση και έξοδος</button>
        <button class="secondary-button" data-window-action="exit" type="button">Έξοδος χωρίς νέα αποθήκευση</button>
        <button class="secondary-button" data-window-action="cancel" type="button">Άκυρο</button>
      </div>
    </div>
  `;

  modal.addEventListener('click', async (event) => {
    if (event.target === modal) {
      modal.remove();
      return;
    }

    const button = event.target.closest('[data-window-action]');
    if (!button) return;

    const action = button.dataset.windowAction;
    try {
      if (action === 'exit-fullscreen') {
        await window.appApi.windowControls.setFullscreen(false);
        modal.remove();
        return;
      }

      if (action === 'minimize') {
        modal.remove();
        await window.appApi.windowControls.minimize();
        return;
      }

      if (action === 'save') {
        showToast('Οι αλλαγές αποθηκεύονται αυτόματα.');
        modal.remove();
        return;
      }

      if (action === 'save-exit' || action === 'exit') {
        await window.appApi.windowControls.quit();
        return;
      }

      modal.remove();
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια παραθύρου.', 'error');
    }
  });

  document.body.appendChild(modal);
  modal.querySelector('[data-window-action="cancel"]')?.focus();
}

function navigate(sectionId, options = {}) {
  state.activeSection = sectionId || 'home';
  if (sectionId === 'as') {
    state.inventoryTab = options.inventoryTab || 'counts';
  }
  if (sectionId === 'administration') {
    state.administrationTab = options.tab || 'handover';
  }
  if (sectionId === 'settings') {
    state.settingsTab = options.tab || 'general';
  }
  renderShell();
}

async function renderActivePage() {
  const section = sections.find((item) => item.id === state.activeSection);
  const pageRoot = document.querySelector('#page-root');

  try {
    if (state.activeSection === 'home') {
      renderHomeTiles({
        container: pageRoot,
        groups: homeGroups,
        onNavigate: navigate
      });
      return;
    }

    if (!section) {
      navigate('home');
      return;
    }

    pageRoot.innerHTML = `
      <div class="page-toolbar no-print${section.type === 'prints' ? ' print-page-toolbar' : ''}">
        <button class="secondary-button page-back-button" type="button" data-back-home>Πίσω</button>
      </div>
      <div id="section-root"></div>
    `;
    const backButton = pageRoot.querySelector('[data-back-home]');
    if (backButton) {
      backButton.addEventListener('click', (event) => {
        event.preventDefault();
        navigate('home');
      });
    }
    const sectionRoot = pageRoot.querySelector('#section-root');

    if (section.type === 'settings') {
      await renderSettingsPage(
        sectionRoot,
        window.appApi.settings,
        window.appApi.clothing,
        showToast,
        state.settingsTab,
        window.appApi.shares
      );
      return;
    }

    if (section.type === 'shares') {
      await renderSharesPage(sectionRoot, window.appApi.shares, window.appApi.settings, showToast);
      return;
    }

    if (section.type === 'transactions') {
      await renderTransactionsPage(
        sectionRoot,
        window.appApi.transactions,
        window.appApi.settings,
        showToast
      );
      return;
    }

    if (section.type === 'charges') {
      await renderChargesPage(sectionRoot, window.appApi.internal, showToast);
      return;
    }

    if (section.type === 'inventory') {
      await renderInventoryPage(
        sectionRoot,
        window.appApi.inventory,
        window.appApi.settings,
        showToast,
        null,
        state.inventoryTab
      );
      return;
    }

    if (section.type === 'movement-differences') {
      await renderMovementDifferencesPage(sectionRoot, window.appApi.movementDifferences, showToast);
      return;
    }

    if (section.type === 'administration') {
      await renderAdministrationPage(
        sectionRoot,
        window.appApi.administration,
        window.appApi.annualAccounts,
        window.appApi.settings,
        showToast,
        null,
        state.administrationTab,
        window.appApi.shares
      );
      return;
    }

    if (section.type === 'prints') {
      await renderPrintsPage(
        sectionRoot,
        window.appApi.shares,
        window.appApi.settings,
        window.appApi.transactions,
        window.appApi.inventory,
        window.appApi.movementDifferences,
        showToast,
        section.printOptions
      );
      return;
    }

    if (section.type === 'requests') {
      await renderRequestsPage(
        sectionRoot,
        window.appApi.requests,
        window.appApi.settings,
        showToast
      );
      return;
    }

    renderPlaceholderPage(sectionRoot, section);
  } catch (error) {
    pageRoot.innerHTML = `
      <section class="page-panel">
        <h2>Σφάλμα</h2>
        <p class="muted">${escapeHtml(error.message || 'Δεν ήταν δυνατή η φόρτωση της σελίδας.')}</p>
      </section>
    `;
  }
}

renderShell();
showRequestRenewalNotice();

async function showRequestRenewalNotice() {
  try {
    const candidates = await window.appApi.requests.getRenewalCandidates();
    if (!candidates.length) {
      return;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-backdrop renewal-backdrop';
    modal.innerHTML = `
      <div class="renewal-modal" role="dialog" aria-modal="true">
        <header>
          <div>
            <p class="eyebrow">ΑΙΤΗΣΕΙΣ</p>
            <h2>Ληγμένες αιτήσεις για επανυποβολή</h2>
          </div>
          <button class="secondary-button" data-close-renewals type="button">Κλείσιμο</button>
        </header>
        <p class="muted">Μπορείς να δημιουργήσεις νέα αίτηση στη φετινή χρονιά με νέο Α/Α ή να αναβάλεις την ειδοποίηση.</p>
        <div class="renewal-list">
          ${candidates.map(renderRenewalCandidate).join('')}
        </div>
      </div>
    `;

    modal.addEventListener('click', async (event) => {
      if (event.target === modal || event.target.closest('[data-close-renewals]')) {
        modal.remove();
        return;
      }

      const row = event.target.closest('[data-renewal-id]');
      if (!row) {
        return;
      }

      const id = Number(row.dataset.renewalId);
      try {
        if (event.target.closest('[data-postpone-renewal]')) {
          await window.appApi.requests.postponeRenewal(id);
          row.remove();
          showToast('Η ειδοποίηση αναβλήθηκε για αύριο.');
        }

        if (event.target.closest('[data-renew-request]')) {
          const protocolNumber = row.querySelector('[data-renewal-protocol]').value.trim();
          const result = await window.appApi.requests.renew(id, { protocolNumber });
          row.remove();
          showToast(result.message || 'Δημιουργήθηκε νέα αίτηση.');
        }

        if (!modal.querySelector('[data-renewal-id]')) {
          modal.remove();
        }
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
      }
    });

    document.body.appendChild(modal);
  } catch (error) {
    showToast(error.message || 'Δεν ήταν δυνατός ο έλεγχος ληγμένων αιτήσεων.', 'error');
  }
}

function renderRenewalCandidate(candidate) {
  const description = candidate.items.map((item) => item.description).filter(Boolean).join(', ');
  return `
    <article class="renewal-row" data-renewal-id="${escapeHtml(candidate.id)}">
      <div>
        <strong>${escapeHtml(candidate.protocolNumber)}</strong>
        <span>${escapeHtml(description || 'Χωρίς υλικά')}</span>
        <small>${escapeHtml(candidate.daysRemaining)} ημέρες για επανυποβολή πριν χαρακτηριστεί διαγραμμένη.</small>
      </div>
      <label class="field">
        <span>Νέο Πρωτόκολλο</span>
        <input data-renewal-protocol autocomplete="off" />
      </label>
      <div class="row-actions">
        <button class="secondary-button" data-postpone-renewal type="button">Αναβολή</button>
        <button class="primary-button" data-renew-request type="button">Νέα Αίτηση</button>
      </div>
    </article>
  `;
}
