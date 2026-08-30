import { escapeHtml, field } from '../components/forms.js';
import { confirmDialog, showNoticeDialog } from '../components/confirmDialog.js';
import { EXP_AITIOLOGIES } from '../../exhpForm/aitiologies.js';
import {
  bindTransactionSettings,
  renderExhpIssueReasonSettings,
  syncExhpIssueReasonSettings
} from './settingsPage.js';
import { bindAddyForm } from '../transactions/addyForm.js';
import { bindExhpDocumentsWizard, renderExhpDocumentOptions } from '../transactions/exhpDocumentsWizard.js';
import {
  renderAddyRows,
  renderExhpEntryTables,
  renderSavedAddyRows,
  renderSavedExhpRows
} from '../transactions/entryHelpers.js';
import { isSameIssueReason } from '../transactions/shared.js';

const transactionDraftState = {
  items: [],
  exhpItems: [],
  exhpDraftSupports: new Map(),
  viewedExhp: null,
  exhpDocumentsState: {
    selectedExhp: null,
    supportDocuments: [],
    uselessA: null,
    uselessB: null,
    ammo: null,
    draftUselessA: null,
    draftUselessB: null,
    draftAmmo: null,
    newModuleDrafts: {},
    uselessStatements: {}
  }
};

export async function renderTransactionsPage(
  container,
  transactionsApi,
  settingsApi,
  showToast,
  activeTab = 'home'
) {
  const [referenceData, documents, exhpDocuments, settings] = await Promise.all([
    transactionsApi.getAddyReferenceData(),
    transactionsApi.listAddyDocuments(),
    transactionsApi.listExhpDocuments(),
    settingsApi.get()
  ]);
  const state = transactionDraftState;
  state.documents = documents;
  state.exhpDocuments = exhpDocuments;
  const exhpReasons = referenceData.exhpIssueReasons.map((reason, index) => ({
    ...reason,
    displayNumber: index + 1,
    moduleCode: EXP_AITIOLOGIES.find((aitiologia) =>
      isSameIssueReason(aitiologia.label, reason.name)
    )?.code || ''
  }));
  const today = localDateValue(referenceData.fiscalYear);

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΔΟΣΟΛΗΨΙΕΣ</p>
        <h2>${activeTab === 'exhp' ? 'Εντολές Χρεωπιστώσεως' : activeTab === 'addy' ? 'Α.Δ.Δ.Υ.' : 'Δοσοληψίες Υλικού'}</h2>
      </div>
    </section>

    <section class="transaction-flow-home uniform-task-menu ${activeTab === 'home' ? '' : 'is-hidden'}" aria-label="Επιλογή ροής δοσοληψιών">
      <button class="home-tile transaction-flow-tile" data-transaction-flow="addy" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΑΔ</span>
        <span class="home-tile-title">ΑΔΔΥ</span>
        <span class="home-tile-code">§ ΔΣ-1</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-transaction-flow="exhp" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΕΧ</span>
        <span class="home-tile-title">ΕΧΠ</span>
        <span class="home-tile-code">§ ΔΣ-2</span>
      </button>
    </section>

    <div class="transaction-tab-panel ${activeTab === 'addy' ? 'active' : ''}" data-transaction-panel="addy" ${activeTab === 'addy' ? '' : 'hidden'}>
    <div class="page-toolbar no-print">
      <button class="secondary-button" data-transaction-flow-back type="button">Πίσω στις Δοσοληψίες</button>
    </div>
    <section class="page-panel addy-panel">
      <div class="addy-entry-grid">
        <label class="field">
          <span>Ημερομηνία</span>
          <input id="addy-date" type="date" value="${new Date().toISOString().slice(0, 10)}" />
        </label>
        <label class="field">
          <span>Μονάδα Δοσοληψιών</span>
          <select id="addy-unit">
            <option value="">Επιλογή</option>
            ${referenceData.transactionUnits
              .map((unit) => `<option value="${escapeHtml(unit.name)}">${escapeHtml(unit.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field addy-notes-field">
          <span>Πληροφορίες</span>
          <input id="addy-notes" autocomplete="off" />
        </label>
        <label class="field">
          <span>Αριθμός Μερίδας</span>
          <input id="addy-share-number" autocomplete="off" />
        </label>
        <label class="field">
          <span>Αριθμός Ονομαστικού</span>
          <input id="addy-nominal-number" autocomplete="off" />
        </label>
        <label class="field">
          <span>Περιγραφή</span>
          <input id="addy-description" autocomplete="off" />
        </label>
        <label class="field">
          <span>Ποσότητα</span>
          <input id="addy-quantity" type="number" min="0.001" step="0.001" />
        </label>
        <label class="field">
          <span>Τιμή</span>
          <input id="addy-unit-price" type="number" min="0" step="0.01" disabled />
        </label>
        <label class="field">
          <span>Μονάδα Μέτρησης</span>
          <select id="addy-measurement-unit">
            <option value="">Επιλογή</option>
            ${referenceData.measurementUnits
              .map((unit) => `<option value="${escapeHtml(unit.name)}">${escapeHtml(unit.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field">
          <span>Είδος Δοσοληψίας</span>
          <select id="addy-transaction-type">
            <option value="">Επιλογή</option>
            <option value="Χρέωση">Χρέωση</option>
            <option value="Πίστωση">Πίστωση</option>
          </select>
        </label>
        <label class="field">
          <span>Είδος Υλικού</span>
          <select id="addy-material-type" disabled>
            <option value="">Επιλογή</option>
            ${referenceData.materialTypes
              .map((type) => `<option value="${escapeHtml(type)}">${escapeHtml(type)}</option>`)
              .join('')}
          </select>
        </label>
        <button id="addy-add-item" class="primary-button" type="button" disabled>Προσθήκη</button>
      </div>

      <div class="modal-backdrop addy-commerce-backdrop" id="addy-commerce-modal" hidden>
        <section class="request-document-modal addy-commerce-modal" role="dialog" aria-modal="true" aria-labelledby="addy-commerce-title">
          <header class="material-card-header">
            <div>
              <p class="eyebrow">ΑΔΔΥ ΕΜΠΟΡΙΟΥ</p>
              <h2 id="addy-commerce-title">Στοιχεία Εμπορίου</h2>
            </div>
            <button class="secondary-button" data-cancel-addy-commerce type="button">Κλείσιμο</button>
          </header>
          <div class="addy-commerce-modal-body">
            <label class="field addy-commerce-field" id="addy-invoice-number-field">
              <span>Αρ. Τιμολογίου</span>
              <input id="addy-invoice-number" autocomplete="off" disabled />
            </label>
            <label class="field addy-commerce-field" id="addy-invoice-date-field">
              <span>Ημερομηνία Τιμολογίου</span>
              <input id="addy-invoice-date" type="date" disabled />
            </label>
            <label class="field addy-commerce-field" id="addy-commerce-company-field">
              <span>Επιχείρηση</span>
              <select id="addy-commerce-company" disabled>
                <option value="">Επιλογή</option>
                ${(referenceData.commerceCompanies || [])
                  .map((company) => `<option value="${company.id}">${escapeHtml(company.name)}</option>`)
                  .join('')}
                <option value="__new__">+ Νέα επιχείρηση</option>
              </select>
            </label>
            <div class="addy-new-company-inline" id="addy-new-company-form" hidden>
              <label class="field"><span>Επωνυμία</span><input id="addy-new-company-name" autocomplete="off" /></label>
              <label class="field"><span>ΑΦΜ</span><input id="addy-new-company-tax-number" autocomplete="off" /></label>
              <label class="field"><span>Διεύθυνση</span><input id="addy-new-company-address" autocomplete="off" /></label>
              <button class="secondary-button" id="addy-new-company-save" type="button">Αποθήκευση επιχείρησης</button>
            </div>
          </div>
          <div class="row-actions addy-commerce-modal-actions">
            <button class="secondary-button" data-cancel-addy-commerce type="button">Ακύρωση</button>
            <button class="primary-button" data-confirm-addy-commerce type="button">Συνέχεια στην αποθήκευση</button>
          </div>
        </section>
      </div>

    </section>

    <section class="page-panel shares-panel addy-list-panel">
      <div class="shares-table-wrap addy-table-wrap">
        <table class="shares-table addy-table">
          <thead>
            <tr>
              <th>Α/Α</th>
              <th>Αριθμός Μερίδας</th>
              <th>Αριθμός Ονομαστικού</th>
              <th>Περιγραφή</th>
              <th class="number-cell">Ποσότητα</th>
              <th class="number-cell">Τιμή</th>
              <th>Μονάδα Μέτρησης</th>
              <th>Είδος Δοσοληψίας</th>
              <th>Μονάδα Δοσοληψιών</th>
              <th>Είδος Υλικού</th>
            </tr>
          </thead>
          <tbody id="addy-items-body">
            ${renderAddyRows(state.items)}
          </tbody>
        </table>
      </div>
      <div class="addy-save-row">
        <span id="addy-limit-text" class="muted">0/10 καταχωρήσεις</span>
        <button id="addy-save" class="primary-button" type="button" disabled>Αποθήκευση</button>
      </div>
    </section>

    <section class="page-panel no-print">
      <h3>Καταχωρημένα ΑΔΔΥ</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Α/Α</th>
              <th>Ημερομηνία</th>
              <th>Μονάδα</th>
              <th>Είδος</th>
              <th>Αριθμός Ονομαστικού</th>
              <th>Περιγραφή</th>
              <th class="number-cell">Ποσότητα ΑΔΔΥ</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${renderSavedAddyRows(state.documents)}</tbody>
        </table>
      </div>
    </section>

    </div>

    <div class="transaction-tab-panel exhp-flat-flow ${activeTab === 'exhp' ? 'active' : ''}" data-transaction-panel="exhp" ${activeTab === 'exhp' ? '' : 'hidden'}>
    <div class="page-toolbar no-print">
      <button class="secondary-button" data-transaction-flow-back type="button">Πίσω στις Δοσοληψίες</button>
    </div>
    <section class="transaction-flow-home exhp-main-menu no-print" data-exhp-menu-home aria-label="Μενού ΕΧΠ">
      <button class="home-tile transaction-flow-tile" data-exhp-menu="reasons" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΑΙ</span>
        <span class="home-tile-title">ΑΙΤΙΟΛΟΓΙΕΣ</span>
        <span class="home-tile-code">§ ΕΧΠ-1</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-exhp-menu="settings" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΡΥ</span>
        <span class="home-tile-title">ΡΥΘΜΙΣΕΙΣ</span>
        <span class="home-tile-code">§ ΕΧΠ-2</span>
      </button>
    </section>
    <div data-exhp-menu-panel="reasons" hidden>
    <div class="page-toolbar no-print">
      <button class="secondary-button" data-exhp-menu-back type="button">Πίσω στο Μενού ΕΧΠ</button>
    </div>
    <div class="exhp-step-indicator no-print" aria-label="Βήματα ΕΧΠ" hidden>
      <span class="active" data-exhp-step-dot="1">1</span>
      <span data-exhp-step-dot="2">2</span>
      <span data-exhp-step-dot="3">3</span>
    </div>
    <div data-exhp-reason-list>
    <section class="exhp-reasons-surface no-print" data-exhp-wizard-step="1">
      <label class="field visually-hidden">
        <span>Αιτιολογία Εκδόσεως</span>
        <select id="exhp-wizard-reason">
          <option value="">Επιλογή</option>
          ${exhpReasons
            .map((reason) => `<option value="${escapeHtml(reason.name)}" data-issue-reason-code="${escapeHtml(reason.moduleCode)}">${escapeHtml(reason.name)}</option>`)
            .join('')}
        </select>
      </label>
      <div class="exhp-reason-tile-grid">
        ${exhpReasons
          .map((reason) => `
            <button class="home-tile transaction-flow-tile exhp-reason-tile" data-exhp-reason-tile="${escapeHtml(reason.name)}" data-exhp-reason-code="${escapeHtml(reason.moduleCode)}" type="button">
              <span class="home-tile-icon" aria-hidden="true">ΑΙ</span>
              <span class="home-tile-title">${escapeHtml(reason.name)}</span>
              <span class="home-tile-code">§ ΕΧΠ-${reason.displayNumber}</span>
            </button>
          `)
          .join('')}
      </div>
      <div class="addy-save-row">
        <span id="exhp-selected-reason-text" class="muted"></span>
        <button id="exhp-wizard-next" class="primary-button" type="button">Επόμενο</button>
      </div>
    </section>
    </div>

    <div data-exhp-reason-detail hidden>
    <div class="page-toolbar no-print">
      <button class="secondary-button" data-exhp-reason-back type="button">Πίσω στις Αιτιολογίες</button>
    </div>
    <section class="page-panel no-print" data-exhp-wizard-step="2">
      <p class="eyebrow">ΒΗΜΑ 2 ΑΠΟ 3</p>
      <h3>Δικαιολογητικά</h3>
      <select id="exhp-documents-exhp" hidden>
        <option value=""></option>
        ${renderExhpDocumentOptions(state.exhpDocuments)}
      </select>
      <div id="exhp-documents-editor-home"></div>
      <div id="exhp-documents-editor" class="exhp-support-checklist">
        <p class="muted">Επίλεξε Αιτιολογία Εκδόσεως για να εμφανιστούν τα διαθέσιμα δικαιολογητικά.</p>
      </div>
      <section id="exhp-support-checklist" class="exhp-support-checklist">
        <p class="muted">Επίλεξε Αιτιολογία Εκδόσεως για να εμφανιστούν τα απαιτούμενα δικαιολογητικά.</p>
      </section>
      <div class="addy-save-row">
        <button id="exhp-reason-back" class="secondary-button" type="button">Πίσω</button>
        <button id="exhp-support-next" class="primary-button" type="button">Επόμενο</button>
      </div>
    </section>

    <div data-exhp-wizard-step="3">
    <section class="page-panel addy-secondary-grid">
      <h3>Έντυπο ΕΧΠ</h3>
      <div class="exhp-entry-grid">
        <label class="field">
          <span>Ημερομηνία</span>
          <input id="exhp-date" type="date" value="${today}" />
        </label>
        <label class="field">
          <span>Μονάδα</span>
          <input id="exhp-unit" value="${escapeHtml(referenceData.serviceName || '')}" readonly />
        </label>
        <label class="field">
          <span>Αιτιολογία Εκδόσεως</span>
          <input id="exhp-reason-display" readonly />
        </label>
        <select id="exhp-reason" hidden>
          <option value="">Επιλογή</option>
          ${exhpReasons
            .map((reason) => `<option value="${escapeHtml(reason.name)}" data-issue-reason-code="${escapeHtml(reason.moduleCode)}">${escapeHtml(reason.name)}</option>`)
            .join('')}
        </select>
        <label class="field">
          <span>Αριθμός Μερίδας</span>
          <input id="exhp-share-number" autocomplete="off" />
        </label>
        <label class="field">
          <span>Αριθμός Ονομαστικού</span>
          <input id="exhp-nominal-number" readonly />
        </label>
        <label class="field">
          <span>Περιγραφή</span>
          <input id="exhp-description" readonly />
        </label>
        <label class="field">
          <span>Μονάδα Μέτρησης</span>
          <select id="exhp-measurement-unit" disabled>
            <option value="">Επιλογή Μ/Μ</option>
            ${referenceData.measurementUnits
              .map((unit) => `<option value="${escapeHtml(unit.name)}">${escapeHtml(unit.name)}</option>`)
              .join('')}
          </select>
        </label>
        <label class="field">
          <span>Ποσότητα</span>
          <input id="exhp-quantity" type="number" min="0" step="0.001" />
        </label>
        <label class="field">
          <span>Είδος Δοσοληψίας</span>
          <select id="exhp-transaction-type">
            <option value="">Επιλογή</option>
            <option value="Χρέωση">Χρέωση</option>
            <option value="Πίστωση">Πίστωση</option>
          </select>
        </label>
        <button id="exhp-add-item" class="primary-button" type="button">Προσθήκη</button>
      </div>

      <div id="exhp-items-view" class="exhp-entry-split">
        ${renderExhpEntryTables(state.exhpItems)}
      </div>
      <div class="addy-save-row">
        <span id="exhp-limit-text" class="muted">0/14 καταχωρήσεις</span>
        <div class="row-actions">
          <button id="exhp-wizard-back" class="secondary-button" type="button">← Πίσω</button>
          <button id="exhp-save" class="primary-button" type="button" disabled>Αποθήκευση ΕΧΠ</button>
        </div>
      </div>
    </section>
    </div>
    </div>
    </div>
    <div data-exhp-menu-panel="settings" hidden>
    <div class="page-toolbar no-print">
      <button class="secondary-button" data-exhp-menu-back type="button">Πίσω στο Μενού ΕΧΠ</button>
    </div>
    <section class="page-panel no-print" data-exhp-settings-list>
      <h3>Καταχωρημένες ΕΧΠ</h3>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Αριθμός Ευρετηρίου</th>
              <th>Ημερομηνία</th>
              <th>Αιτιολογία Εκδόσεως</th>
              <th>Έγκριση</th>
              <th>Κατάσταση</th>
              <th></th>
            </tr>
          </thead>
          <tbody>${renderSavedExhpRows(state.exhpDocuments)}</tbody>
        </table>
      </div>
    </section>

    <section id="exhp-edit-panel" class="page-panel no-print" hidden>
      <h3>Επεξεργασία ΕΧΠ</h3>
      <form id="exhp-metadata-edit-form" class="inline-form exhp-metadata-edit-form">
        <input id="exhp-edit-id" type="hidden" />
        <label class="field">
          <span>Αριθμός ΕΧΠ</span>
          <input id="exhp-edit-registry-number" type="number" min="1" step="1" required />
        </label>
        <label class="field">
          <span>Ημερομηνία</span>
          <input id="exhp-edit-date" type="date" required />
        </label>
        <button class="primary-button exhp-edit-save-button" type="submit">Αποθήκευση αλλαγών</button>
      </form>
      <p class="muted">Οι αλλαγές ενημερώνουν την ΕΧΠ, το Ευρετήριο Εντολών Χρεωπιστώσεων και τις κινήσεις των αντίστοιχων μερίδων.</p>
      <h4>Υλικά της ΕΧΠ</h4>
      <div id="exhp-edit-items-mount" class="exhp-entry-split"></div>
    </section>

    <section class="page-panel no-print" data-exhp-settings-reasons>
      <h3>Αιτιολογία Εκδόσεως ΕΧΠ</h3>
      ${renderExhpIssueReasonSettings(settings.exhpIssueReasons)}
      <form id="exhp-issue-reason-form" class="inline-form compact-form">
        ${field('Νέα αιτιολογία εκδόσεως', 'name')}
        <button class="primary-button" type="submit">Προσθήκη</button>
      </form>
    </section>
    </div>
    </div>

  `;

  bindExhpMenu(container, transactionsApi, settingsApi, settings, state, showToast);

  container.querySelectorAll('[data-transaction-flow]').forEach((button) => {
    button.addEventListener('click', () => {
      void renderTransactionsPage(
        container,
        transactionsApi,
        settingsApi,
        showToast,
        button.dataset.transactionFlow
      );
    });
  });

  container.querySelectorAll('[data-transaction-flow-back]').forEach((button) => {
    button.addEventListener('click', () => {
      if (
        !container.querySelector('[data-transaction-panel="exhp"].exhp-flat-flow')
        && container.querySelector('[data-transaction-panel="exhp"].active')
        && container.querySelector('#exhp-wizard-reason')?.value
      ) {
        container.querySelectorAll('[data-exhp-wizard-step]').forEach((panel) => {
          panel.hidden = panel.dataset.exhpWizardStep !== '1';
        });
        container.querySelectorAll('[data-exhp-step-dot]').forEach((dot) => {
          dot.classList.toggle('active', dot.dataset.exhpStepDot === '1');
        });
        return;
      }
      void renderTransactionsPage(container, transactionsApi, settingsApi, showToast, 'home');
    });
  });

  bindAddyForm(container, transactionsApi, settingsApi, referenceData, settings, state, showToast, renderTransactionsPage);
  bindExhpDocumentsWizard(container, state, settings, showToast);
  bindTransactionSettings(
    container,
    settingsApi,
    settings.exhpIssueReasons,
    showToast,
    (tab) => renderTransactionsPage(container, transactionsApi, settingsApi, showToast, tab)
  );
}

function bindExhpMenu(container, transactionsApi, settingsApi, settings, state, showToast) {
  const tabs = [...container.querySelectorAll('[data-exhp-menu]')];
  const panels = [...container.querySelectorAll('[data-exhp-menu-panel]')];
  const menuHome = container.querySelector('[data-exhp-menu-home]');
  const reasonList = container.querySelector('[data-exhp-reason-list]');
  const reasonDetail = container.querySelector('[data-exhp-reason-detail]');
  const editor = container.querySelector('#exhp-documents-editor');
  const editorHome = container.querySelector('#exhp-documents-editor-home');
  const editItemsMount = container.querySelector('#exhp-edit-items-mount');
  const selector = container.querySelector('#exhp-documents-exhp');
  const editPanel = container.querySelector('#exhp-edit-panel');
  const editForm = container.querySelector('#exhp-metadata-edit-form');
  const settingsList = container.querySelector('[data-exhp-settings-list]');
  const settingsReasons = container.querySelector('[data-exhp-settings-reasons]');

  const closeEditor = () => {
    editPanel.hidden = true;
    settingsList.hidden = false;
    settingsReasons.hidden = false;
    if (editor && editorHome && editor.parentElement !== editorHome.parentElement) {
      editorHome.after(editor);
    }
    state.viewedExhp = null;
    state.exhpDocumentsState.selectedExhp = null;
    selector.value = '';
  };

  const activate = (menu) => {
    menuHome.hidden = true;
    panels.forEach((panel) => {
      panel.hidden = panel.dataset.exhpMenuPanel !== menu;
    });
    if (menu === 'reasons') {
      reasonList.hidden = false;
      reasonDetail.hidden = true;
    }
    if (menu === 'settings') closeEditor();
    if (menu === 'reasons' && editor && editorHome && editor.parentElement !== editorHome.parentElement) {
      editorHome.after(editor);
      state.viewedExhp = null;
      state.exhpDocumentsState.selectedExhp = null;
      selector.value = '';
    }
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => activate(tab.dataset.exhpMenu));
  });

  container.querySelectorAll('[data-exhp-menu-back]').forEach((button) => {
    button.addEventListener('click', () => {
      panels.forEach((panel) => { panel.hidden = true; });
      menuHome.hidden = false;
      closeEditor();
    });
  });

  container.querySelectorAll('[data-exhp-reason-tile]').forEach((button) => {
    button.addEventListener('click', () => {
      reasonList.hidden = true;
      reasonDetail.hidden = false;
      reasonDetail.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  container.querySelector('[data-exhp-reason-back]')?.addEventListener('click', () => {
    reasonDetail.hidden = true;
    reasonList.hidden = false;
    reasonList.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  container.querySelectorAll('[data-edit-exhp-document]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        const documentData = await transactionsApi.getExhpDocument(
          Number(button.dataset.editExhpDocument)
        );
        activate('settings');
        state.viewedExhp = documentData;
        settingsList.hidden = true;
        settingsReasons.hidden = true;
        editPanel.hidden = false;
        container.querySelector('#exhp-edit-id').value = documentData.id;
        container.querySelector('#exhp-edit-registry-number').value = documentData.registryNumber;
        container.querySelector('#exhp-edit-date').value = documentData.date;
        if (editItemsMount) editItemsMount.innerHTML = renderEditableExhpItems(documentData.items);
        editPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η φόρτωση της ΕΧΠ.', 'error');
      }
    });
  });


  container.querySelectorAll('[data-delete-exhp-document]').forEach((button) => {
    button.addEventListener('click', async () => {
      const accepted = await confirmDialog({
        message: 'Αυτή η ενέργεια θα διαγράψει την ΕΧΠ από το Ευρετήριο Εντολών Χρεωπιστώσεως και τις κινήσεις από τις Μερίδες Υλικού. Να προχωρήσω;'
      });
      if (!accepted) return;
      try {
        const id = Number(button.dataset.deleteExhpDocument);
        const result = await transactionsApi.deleteExhp(id);
        button.closest('tr')?.remove();
        state.exhpDocuments = state.exhpDocuments.filter((item) => Number(item.id) !== id);
        if (Number(state.viewedExhp?.id) === id) closeEditor();
        showToast(result.message);
      } catch (error) {
        if (error?.code === 'DOCUMENT_HAS_SUBSEQUENT_MOVEMENTS') {
          await showNoticeDialog({ message: error.message });
          return;
        }
        showToast(error.message || 'Δεν ήταν δυνατή η διαγραφή της ΕΧΠ.', 'error');
      }
    });
  });

  editForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const id = Number(container.querySelector('#exhp-edit-id').value);
      const result = await transactionsApi.updateExhpMetadata(id, {
        registryNumber: Number(container.querySelector('#exhp-edit-registry-number').value),
        documentDate: container.querySelector('#exhp-edit-date').value,
        items: [...container.querySelectorAll('[data-exhp-edit-item]')].map((input) => ({
          id: Number(input.dataset.exhpEditItem),
          quantity: Number(input.value)
        }))
      });
      state.viewedExhp = result.document;
      if (editItemsMount) editItemsMount.innerHTML = renderEditableExhpItems(result.document.items);
      const row = container.querySelector(`[data-edit-exhp-document="${id}"]`)?.closest('tr');
      if (row) {
        row.children[0].textContent = result.document.registryNumber;
        row.children[1].textContent = formatLocalDate(result.document.date);
      }
      showToast(result.message);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση της ΕΧΠ.', 'error');
    }
  });
}

function renderEditableExhpItems(items = []) {
  return ['Χρέωση', 'Πίστωση'].map((transactionType) => {
    const rows = items.filter((item) => item.transactionType === transactionType);
    return `
      <section class="exhp-entry-section">
        <h4>${transactionType} Διαχειρίσεως</h4>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Αριθμός Μερίδας</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Μονάδα Μέτρησης</th><th>Ποσότητα</th></tr></thead>
            <tbody>${rows.length ? rows.map((item) => `
              <tr>
                <td>${escapeHtml(item.shareNumber)}</td>
                <td>${escapeHtml(item.nominalNumber)}</td>
                <td class="material-description-cell">${escapeHtml(item.description)}</td>
                <td>${escapeHtml(item.measurementUnit)}</td>
                <td><input class="table-input exhp-edit-quantity-input" data-exhp-edit-item="${Number(item.id)}" type="number" min="${item.ledgerSerial === 'Φ.Μ.' ? '0' : '0.001'}" step="0.001" value="${Number(item.quantity)}" aria-label="Ποσότητα μερίδας ${escapeHtml(item.shareNumber)}" /></td>
              </tr>`).join('') : '<tr><td colspan="5" class="empty-table">Δεν υπάρχουν υλικά.</td></tr>'}</tbody>
          </table>
        </div>
      </section>`;
  }).join('');
}

function localDateValue(fiscalYear = new Date().getFullYear()) {
  const now = new Date();
  if (Number(fiscalYear) !== now.getFullYear()) {
    return `${Number(fiscalYear)}-01-01`;
  }
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

function formatLocalDate(value) {
  const [year, month, day] = String(value || '').split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value || '');
}

export function renderShareNumberOptions(shares) {
  return shares
    .map((share) => `<option value="${escapeHtml(share.shareNumber)}"></option>`)
    .join('');
}
