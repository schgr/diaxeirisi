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
import { renderFinancialYearTasksPage } from './pages/financialYearTasksPage.js';
import { showToast } from './components/toast.js';
import { escapeHtml } from './components/forms.js';
import { initializeDocumentExports } from './documentExport.js';
import { initializeLocalizedQuantities } from './localizedQuantities.js';
import { createPageDraftController } from './pageDrafts.js';

const THEME_STORAGE_KEY = 'diaxeirisi-theme';
const DEFAULT_THEME = 'blueprint';

function registerGlobalErrorReporting() {
  window.addEventListener('error', (event) => {
    console.error('Μη διαχειρισμένο σφάλμα.', event.error || event.message);
    showToast('Παρουσιάστηκε απρόβλεπτο σφάλμα.', 'error');
  });
  window.addEventListener('unhandledrejection', (event) => {
    console.error('Μη διαχειρισμένη απόρριψη υπόσχεσης.', event.reason);
    showToast('Παρουσιάστηκε απρόβλεπτο σφάλμα.', 'error');
  });
}

registerGlobalErrorReporting();
applyStoredTheme();
initializeDocumentExports(showToast);
initializeLocalizedQuantities();

const sections = [
  { id: 'shares', title: 'ΜΕΡΙΔΕΣ', type: 'shares' },
  { id: 'share-compositions', title: 'ΣΥΝΘΕΣΕΙΣ ΜΕΡΙΔΩΝ', type: 'share-compositions', hidden: true },
  { id: 'charges', title: 'ΧΟΡΗΓΗΣΕΙΣ ΣΕ ΤΜΗΜΑΤΑ', type: 'charges' },
  { id: 'transactions', title: 'ΔΟΣΟΛΗΨΙΕΣ', type: 'transactions' },
  { id: 'movement-differences', title: 'ΔΙΑΦΟΡΕΣ', type: 'movement-differences' },
  { id: 'financial-year-tasks', title: 'ΕΡΓΑΣΙΕΣ ΟΙΚΟΝΟΜΙΚΟΥ ΕΤΟΥΣ', type: 'financial-year-tasks' },
  { id: 'requests', title: 'ΑΙΤΗΣΕΙΣ', type: 'requests' },
  { id: 'as', title: 'ΑΠΟΓΡΑΦΕΣ', type: 'inventory' },
  { id: 'administration', title: 'ΔΙΑΧΕΙΡΙΣΗ', type: 'administration' },
  {
    id: 'prints',
    title: 'ΕΚΤΥΠΩΣΕΙΣ',
    type: 'prints',
    hidden: true,
    printOptions: {
      title: 'Εκτυπώσεις',
      menuTitle: 'Μερίδες Υλικού',
      visibleGroups: ['shares'],
      initialGroup: 'shares',
      tileMenu: true,
      latestInventoryShareCards: true
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
      initialGroup: 'management',
      directPreview: true
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
      { id: 'requests', title: 'Αιτήσεις' },
      { id: 'share-compositions', title: 'Συνθέσεις Μερίδων' }
    ]
  },
  {
    label: 'Έλεγχος Υλικών',
    items: [
      { id: 'as', title: 'Απογραφές' },
      { id: 'movement-differences', title: 'Διαφορές' },
      { id: 'financial-year-tasks', title: 'Εργασίες Οικονομικού Έτους' }
    ]
  },
  {
    label: 'Διαχείριση',
    items: [
      { id: 'administration-handover', sectionId: 'administration', tab: 'handover', title: 'Παράδοση - Παραλαβή' },
      { id: 'administration-report', sectionId: 'administration', tab: 'management-report', title: 'Αναφορά Διαχείρισης' },
      { id: 'administration-aggregate-prints', sectionId: 'prints', title: 'ΕΚΤΥΠΩΣΕΙΣ' },
      { id: 'administration-books-registries', sectionId: 'administration', tab: 'books-registries', title: 'Βιβλία & Μητρώα' }
    ]
  },
  {
    label: 'Ρυθμίσεις',
    items: [
      { id: 'settings-general', sectionId: 'settings', tab: 'general', title: 'Στοιχεία Μονάδος' },
      { id: 'settings-parameters', sectionId: 'settings', tab: 'parameters', title: 'Δεδομένα Συστήματος' },
      { id: 'settings-security', sectionId: 'settings', tab: 'security', title: 'Ασφάλεια και Backup' },
      { id: 'settings-information', sectionId: 'settings', tab: 'information', title: 'Πληροφορίες' }
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
let applicationUnlocked = false;
const pageDrafts = createPageDraftController(window.appApi.drafts);

document.addEventListener('input', (event) => {
  if (pageDrafts.handles(event.target)) pageDrafts.capture();
});
document.addEventListener('change', (event) => {
  if (pageDrafts.handles(event.target)) pageDrafts.capture();
});
document.addEventListener('click', (event) => {
  if (!pageDrafts.handles(event.target)) return;
  window.setTimeout(() => pageDrafts.capture(), 500);
});
window.addEventListener('beforeunload', () => {
  pageDrafts.capture(0);
});

document.addEventListener('diaxeirisi:navigate', (event) => {
  const detail = event.detail || {};
  navigate(detail.sectionId, detail);
});

document.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (!applicationUnlocked) return;

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
    '[data-cancel-internal-composition]',
    '[data-cancel-year-close]'
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
  void pageDrafts.deactivate();
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
    const runtimeInfo = await window.appApi.app.getRuntimeInfo();
    const targets = document.querySelectorAll('#home-version-label');
    targets.forEach((target) => {
      target.textContent = `v${runtimeInfo.version}`;
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
        <button class="secondary-button" data-window-action="lock" type="button">Κλείδωμα εφαρμογής</button>
        <button class="danger-button" data-window-action="exit" type="button">Έξοδος εφαρμογής</button>
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

      if (action === 'lock') {
        modal.remove();
        await lockApplication();
        return;
      }

      if (action === 'exit') {
        await pageDrafts.capture(0);
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
  void pageDrafts.deactivate();
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
      await pageDrafts.mount('', null);
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
      await restoreActivePageDraft(sectionRoot);
      return;
    }

    if (section.type === 'shares') {
      await renderSharesPage(sectionRoot, window.appApi.shares, window.appApi.settings, showToast);
      await restoreActivePageDraft(sectionRoot);
      return;
    }

    if (section.type === 'share-compositions') {
      await renderSharesPage(
        sectionRoot,
        window.appApi.shares,
        window.appApi.settings,
        showToast,
        { compositionOnly: true }
      );
      await restoreActivePageDraft(sectionRoot);
      return;
    }

    if (section.type === 'transactions') {
      await renderTransactionsPage(
        sectionRoot,
        window.appApi.transactions,
        window.appApi.settings,
        showToast
      );
      await restoreActivePageDraft(sectionRoot);
      return;
    }

    if (section.type === 'charges') {
      await renderChargesPage(sectionRoot, window.appApi.internal, showToast);
      await restoreActivePageDraft(sectionRoot);
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
      await restoreActivePageDraft(sectionRoot);
      return;
    }

    if (section.type === 'movement-differences') {
      await renderMovementDifferencesPage(sectionRoot, window.appApi.movementDifferences, showToast);
      await restoreActivePageDraft(sectionRoot);
      return;
    }

    if (section.type === 'financial-year-tasks') {
      await renderFinancialYearTasksPage(
        sectionRoot,
        window.appApi.transactions,
        window.appApi.yearEnd,
        window.appApi.administration,
        window.appApi.shares,
        window.appApi.settings,
        window.appApi.inventory,
        showToast
      );
      await restoreActivePageDraft(sectionRoot);
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
      await restoreActivePageDraft(sectionRoot);
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
        window.appApi.administration,
        showToast,
        section.printOptions
      );
      await restoreActivePageDraft(sectionRoot);
      return;
    }

    if (section.type === 'requests') {
      await renderRequestsPage(
        sectionRoot,
        window.appApi.requests,
        window.appApi.settings,
        showToast
      );
      await restoreActivePageDraft(sectionRoot);
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

async function restoreActivePageDraft(sectionRoot) {
  if (state.activeSection === 'transactions') return;
  const tab = state.activeSection === 'settings'
    ? state.settingsTab
    : state.activeSection === 'administration'
      ? state.administrationTab
      : state.activeSection === 'as'
        ? state.inventoryTab
        : '';
  await pageDrafts.mount([state.activeSection, tab].filter(Boolean).join(':'), sectionRoot);
}

initializeApplication();

async function initializeApplication() {
  try {
    const status = await window.appApi.auth.status();
    if (status.unlocked) {
      startUnlockedApplication();
      return;
    }
    renderAuthGate(status);
  } catch (error) {
    app.innerHTML = `<main class="auth-screen"><section class="auth-card"><h2>Σφάλμα ασφαλείας</h2><p>${escapeHtml(error.message || 'Δεν ήταν δυνατή η εκκίνηση της εφαρμογής.')}</p></section></main>`;
  }
}

function startUnlockedApplication() {
  applicationUnlocked = true;
  state.activeSection = 'home';
  renderShell();
  void showRequestRenewalNotice();
}

async function lockApplication() {
  await window.appApi.auth.lock();
  applicationUnlocked = false;
  renderAuthGate(await window.appApi.auth.status());
}

function renderAuthGate(status) {
  applicationUnlocked = false;
  const isSetup = !status.configured;
  const lockedSeconds = status.lockedUntil
    ? Math.max(1, Math.ceil((status.lockedUntil - Date.now()) / 1000))
    : 0;
  app.innerHTML = `
    <main class="auth-screen">
      <section class="auth-card corner" aria-labelledby="auth-title">
        <p class="home-kicker">ΔΙΑΧΕΙΡΙΣΗ ΥΛΙΚΟΥ · ΑΣΦΑΛΗΣ ΠΡΟΣΒΑΣΗ</p>
        <h1 id="auth-title">${isSetup ? 'Ορισμός στοιχείων εισόδου' : 'Είσοδος στην εφαρμογή'}</h1>
        <p class="muted">${isSetup
          ? 'Δημιουργήστε όνομα χρήστη και κωδικό τουλάχιστον 6 χαρακτήρων. Θα απαιτούνται σε κάθε εκκίνηση.'
          : 'Πληκτρολογήστε το όνομα χρήστη και τον κωδικό για πρόσβαση στα δεδομένα της διαχείρισης.'}</p>
        <form class="auth-form" data-auth-form>
          ${isSetup ? `
            <label class="field"><span>Όνομα χρήστη</span><input name="username" minlength="3" maxlength="50" autocomplete="username" required autofocus /></label>
            <label class="field"><span>Νέος κωδικός</span><input name="password" type="password" minlength="10" autocomplete="new-password" required /></label>
            <label class="field"><span>Επιβεβαίωση κωδικού</span><input name="confirmation" type="password" minlength="10" autocomplete="new-password" required /></label>
            <h2>Ερωτήσεις Ασφαλείας</h2>
            <p class="muted">Ορίστε τρεις ερωτήσεις και απαντήσεις για ασφαλή ανάκτηση πρόσβασης.</p>
            ${[1, 2, 3].map((number) => `
              <label class="field"><span>Ερώτηση ${number}</span><input name="securityQuestion${number}" minlength="5" required /></label>
              <label class="field"><span>Απάντηση ${number}</span><input name="securityAnswer${number}" minlength="2" autocomplete="off" required /></label>
            `).join('')}
          ` : `
            <label class="field"><span>Όνομα χρήστη</span><input name="username" value="${escapeHtml(status.username || 'admin')}" autocomplete="username" required autofocus ${lockedSeconds ? 'disabled' : ''} /></label>
            <label class="field"><span>Κωδικός εισόδου</span><input name="password" type="password" autocomplete="current-password" required ${lockedSeconds ? 'disabled' : ''} /></label>
          `}
          <p class="auth-message" data-auth-message role="alert">${lockedSeconds ? `Η είσοδος είναι προσωρινά κλειδωμένη για ${lockedSeconds} δευτερόλεπτα.` : ''}</p>
          <button class="primary-button" type="submit" ${lockedSeconds ? 'disabled' : ''}>${isSetup ? 'Ενεργοποίηση προστασίας' : 'Είσοδος'}</button>
          ${!isSetup && status.recoveryConfigured ? '<button class="secondary-button" data-show-auth-recovery type="button">Ξέχασα τα στοιχεία εισόδου</button>' : ''}
          <button class="secondary-button" data-auth-quit type="button">Έξοδος</button>
        </form>
        ${!isSetup && status.recoveryConfigured ? `
          <form class="auth-form auth-recovery-form" data-auth-recovery-form hidden>
            ${status.securityQuestionsConfigured ? `
              <p class="muted">Απαντήστε σωστά και στις τρεις ερωτήσεις για να δημιουργηθεί νέος, διαφορετικός κωδικός ανάκτησης.</p>
              ${status.securityQuestions.map((question, index) => `
                <label class="field"><span>${escapeHtml(question)}</span><input name="securityAnswer${index + 1}" autocomplete="off" required /></label>
              `).join('')}
              <button class="secondary-button" data-generate-recovery-code type="button">Δημιουργία κωδικού ανάκτησης</button>
              <div class="recovery-code-result" data-auth-recovery-code-result hidden>
                <span>Νέος κωδικός ανάκτησης</span>
                <strong data-auth-recovery-code></strong>
              </div>
            ` : ''}
            <h2>Επαναφορά στοιχείων εισόδου</h2>
            <p class="muted">Χρησιμοποιήστε τον κωδικό ανάκτησης που δημιουργήσατε από τις Ρυθμίσεις Ασφαλείας.</p>
            <label class="field"><span>Κωδικός ανάκτησης</span><input name="recoveryCode" autocomplete="off" required /></label>
            <label class="field"><span>Νέο όνομα χρήστη</span><input name="username" minlength="3" maxlength="50" autocomplete="username" required /></label>
            <label class="field"><span>Νέος κωδικός</span><input name="newPassword" type="password" minlength="10" autocomplete="new-password" required /></label>
            <label class="field"><span>Επιβεβαίωση κωδικού</span><input name="confirmation" type="password" minlength="10" autocomplete="new-password" required /></label>
            <p class="auth-message" data-recovery-message role="alert"></p>
            <button class="primary-button" type="submit">Επαναφορά και είσοδος</button>
            <button class="secondary-button" data-hide-auth-recovery type="button">Πίσω στην είσοδο</button>
          </form>
        ` : ''}
      </section>
    </main>
  `;

  app.querySelector('[data-auth-quit]')?.addEventListener('click', () => window.appApi.windowControls.quit());
  app.querySelector('[data-show-auth-recovery]')?.addEventListener('click', () => {
    app.querySelector('[data-auth-form]').hidden = true;
    app.querySelector('[data-auth-recovery-form]').hidden = false;
  });
  app.querySelector('[data-hide-auth-recovery]')?.addEventListener('click', () => {
    app.querySelector('[data-auth-recovery-form]').hidden = true;
    app.querySelector('[data-auth-form]').hidden = false;
  });
  app.querySelector('[data-generate-recovery-code]')?.addEventListener('click', async (event) => {
    const form = event.currentTarget.closest('form');
    const message = form.querySelector('[data-recovery-message]');
    event.currentTarget.disabled = true;
    message.textContent = '';
    try {
      const data = new FormData(form);
      const result = await window.appApi.auth.answerSecurityQuestions(
        [1, 2, 3].map((number) => data.get(`securityAnswer${number}`))
      );
      form.elements.recoveryCode.value = result.recoveryCode;
      form.querySelector('[data-auth-recovery-code]').textContent = result.recoveryCode;
      form.querySelector('[data-auth-recovery-code-result]').hidden = false;
    } catch (error) {
      message.textContent = error.message || 'Οι απαντήσεις δεν επαληθεύτηκαν.';
      event.currentTarget.disabled = false;
    }
  });
  app.querySelector('[data-auth-recovery-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('[data-recovery-message]');
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    message.textContent = '';
    try {
      const data = new FormData(form);
      await window.appApi.auth.recover(
        data.get('recoveryCode'),
        data.get('username'),
        data.get('newPassword'),
        data.get('confirmation')
      );
      startUnlockedApplication();
    } catch (error) {
      message.textContent = error.message || 'Δεν ήταν δυνατή η ανάκτηση.';
      submit.disabled = false;
    }
  });
  app.querySelector('[data-auth-form]')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const message = form.querySelector('[data-auth-message]');
    const submit = form.querySelector('[type="submit"]');
    submit.disabled = true;
    message.textContent = '';
    try {
      const data = new FormData(form);
      if (isSetup) {
        await window.appApi.auth.setup(
          data.get('username'),
          data.get('password'),
          data.get('confirmation'),
          [1, 2, 3].map((number) => ({
            question: data.get(`securityQuestion${number}`),
            answer: data.get(`securityAnswer${number}`)
          }))
        );
      } else {
        await window.appApi.auth.login(data.get('username'), data.get('password'));
      }
      startUnlockedApplication();
    } catch (error) {
      message.textContent = error.message || 'Δεν ήταν δυνατή η είσοδος.';
      if (!isSetup && error.code === 'AUTH_INVALID_CREDENTIALS') {
        const recoveryButton = app.querySelector('[data-show-auth-recovery]');
        if (recoveryButton) recoveryButton.hidden = false;
      }
      submit.disabled = false;
      form.querySelector('input:not([disabled])')?.focus();
    }
  });

  if (lockedSeconds) {
    window.setTimeout(() => initializeApplication(), Math.min(lockedSeconds * 1000 + 100, 31_000));
  }
}

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
