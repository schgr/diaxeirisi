import { escapeHtml, field } from '../components/forms.js';
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
  const state = {
    items: [],
    documents,
    exhpDocuments,
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
  const issueReasonByCode = Object.fromEntries(
    EXP_AITIOLOGIES.map((aitiologia, index) => [
      aitiologia.code,
      referenceData.exhpIssueReasons.find((item) => isSameIssueReason(item.name, aitiologia.label))?.name
        || referenceData.exhpIssueReasons[index]?.name
        || aitiologia.label
    ])
  );
  const today = localDateValue(referenceData.fiscalYear);

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΔΟΣΟΛΗΨΙΕΣ</p>
        <h2>${activeTab === 'exhp' ? 'Εντολή Χρεωπιστώσεως' : 'Δοσοληψίες Υλικού'}</h2>
      </div>
    </section>

    <section class="transaction-flow-home ${activeTab === 'home' ? '' : 'is-hidden'}" aria-label="Επιλογή ροής δοσοληψιών">
      <button class="home-tile transaction-flow-tile" data-transaction-flow="addy" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΑΔ</span>
        <span class="home-tile-title">ΑΔΔΥ</span>
        <span class="home-tile-code">§ ΔΣ-Α</span>
      </button>
      <button class="home-tile transaction-flow-tile" data-transaction-flow="exhp" type="button">
        <span class="home-tile-icon" aria-hidden="true">ΕΧ</span>
        <span class="home-tile-title">ΕΧΠ</span>
        <span class="home-tile-code">§ ΔΣ-Β</span>
      </button>
    </section>

    <div class="transaction-tab-panel ${activeTab === 'addy' ? 'active' : ''}" data-transaction-panel="addy" ${activeTab === 'addy' ? '' : 'hidden'}>
    <div class="page-toolbar no-print">
      <button class="secondary-button" data-transaction-flow-back type="button">Πίσω στις Δοσοληψίες</button>
    </div>
    <section class="page-panel addy-panel">
      <div class="addy-header-grid">
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
          <span>Παρατηρήσεις</span>
          <input id="addy-notes" autocomplete="off" />
        </label>
        <label class="field">
          <span>Αριθμός και Ημερομηνία Δικαιολογητικού</span>
          <input id="addy-justification-reference" autocomplete="off" disabled />
        </label>
      </div>

      <div class="addy-line-grid">
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
              <th></th>
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

    <div class="transaction-tab-panel ${activeTab === 'exhp' ? 'active' : ''}" data-transaction-panel="exhp" ${activeTab === 'exhp' ? '' : 'hidden'}>
    <div class="page-toolbar no-print">
      <button class="secondary-button" data-transaction-flow-back type="button">Πίσω στις Δοσοληψίες</button>
    </div>
    <div class="exhp-step-indicator no-print" aria-label="Βήματα ΕΧΠ">
      <span class="active" data-exhp-step-dot="1">1</span>
      <span data-exhp-step-dot="2">2</span>
      <span data-exhp-step-dot="3">3</span>
    </div>
    <section class="page-panel no-print" data-exhp-wizard-step="1">
      <p class="eyebrow">ΒΗΜΑ 1 ΑΠΟ 3</p>
      <h3>Αιτιολογία</h3>
      <label class="field visually-hidden">
        <span>Αιτιολογία Εκδόσεως</span>
        <select id="exhp-wizard-reason">
          <option value="">Επιλογή</option>
          ${EXP_AITIOLOGIES
            .map((aitiologia) => `<option value="${escapeHtml(issueReasonByCode[aitiologia.code])}" data-issue-reason-code="${escapeHtml(aitiologia.code)}">${escapeHtml(aitiologia.label)}</option>`)
            .join('')}
        </select>
      </label>
      <div class="exhp-reason-tile-grid">
        ${EXP_AITIOLOGIES
          .map((aitiologia) => `
            <button class="home-tile exhp-reason-tile" data-exhp-reason-tile="${escapeHtml(issueReasonByCode[aitiologia.code])}" data-exhp-reason-code="${escapeHtml(aitiologia.code)}" type="button">
              <span>${escapeHtml(aitiologia.label)}</span>
            </button>
          `)
          .join('')}
      </div>
      <div class="addy-save-row">
        <span id="exhp-selected-reason-text" class="muted">Δεν έχει επιλεγεί αιτιολογία.</span>
        <button id="exhp-wizard-next" class="primary-button" type="button">Επόμενο</button>
      </div>
    </section>

    <section class="page-panel no-print" data-exhp-wizard-step="2" hidden>
      <p class="eyebrow">ΒΗΜΑ 2 ΑΠΟ 3</p>
      <h3>Δικαιολογητικά</h3>
      <select id="exhp-documents-exhp" hidden>
        <option value=""></option>
        ${renderExhpDocumentOptions(state.exhpDocuments)}
      </select>
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

    <div data-exhp-wizard-step="3" hidden>
    <section class="page-panel addy-secondary-grid">
      <p class="eyebrow">ΒΗΜΑ 3 ΑΠΟ 3</p>
      <h3>Έντυπο ΕΧΠ</h3>
      <div class="exhp-controls">
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
          ${EXP_AITIOLOGIES
            .map((aitiologia) => `<option value="${escapeHtml(issueReasonByCode[aitiologia.code])}" data-issue-reason-code="${escapeHtml(aitiologia.code)}">${escapeHtml(aitiologia.label)}</option>`)
            .join('')}
        </select>
        <label class="field">
          <span>Αριθμός - Ημερομηνία Εγκρίσεως</span>
          <input id="exhp-approval-reference" autocomplete="off" />
        </label>
      </div>

      <div class="exhp-line-grid">
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
          <input id="exhp-measurement-unit" readonly />
        </label>
        <label class="field">
          <span>Ποσότητα</span>
          <input id="exhp-quantity" type="number" min="0.001" step="0.001" />
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
    <section class="page-panel no-print">
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

    <section class="page-panel no-print">
      <h3>Αιτιολογία Εκδόσεως ΕΧΠ</h3>
      ${renderExhpIssueReasonSettings(settings.exhpIssueReasons)}
      <form id="exhp-issue-reason-form" class="inline-form compact-form">
        ${field('Νέα αιτιολογία εκδόσεως', 'name')}
        <button class="primary-button" type="submit">Προσθήκη</button>
      </form>
    </section>
    </div>

  `;

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
      if (container.querySelector('[data-transaction-panel="exhp"].active') && container.querySelector('#exhp-wizard-reason')?.value) {
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

function localDateValue(fiscalYear = new Date().getFullYear()) {
  const now = new Date();
  if (Number(fiscalYear) !== now.getFullYear()) {
    return `${Number(fiscalYear)}-01-01`;
  }
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function renderShareNumberOptions(shares) {
  return shares
    .map((share) => `<option value="${escapeHtml(share.shareNumber)}"></option>`)
    .join('');
}
