import { escapeHtml, field, getFormData } from '../components/forms.js';
import { requestPriorityColumns, requestPriorityRows } from '../requestPriorities.js';

const materialCategorySection = {
  key: 'material-category',
  title: 'Κατηγορία Υλικού',
  inputLabel: 'Νέα κατηγορία',
  itemsKey: 'materialCategories',
  addMethod: 'addMaterialCategory',
  deleteMethod: 'deleteMaterialCategory',
  addMessage: 'Η κατηγορία υλικού προστέθηκε.',
  deleteMessage: 'Η κατηγορία υλικού διαγράφηκε.'
};

export async function renderSettingsPage(container, settingsApi, clothingApi, showToast, initialTab = '', sharesApi = window.appApi.shares) {
  const [settings, shares, authStatus, backups, appVersion] = await Promise.all([
    settingsApi.get(),
    sharesApi.list(),
    window.appApi.auth.status(),
    window.appApi.backup.list(),
    window.appApi.app.getVersion().catch(() => '')
  ]);

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΡΥΘΜΙΣΕΙΣ</p>
        <h2>Βασικά στοιχεία εφαρμογής</h2>
      </div>
    </section>

    <nav class="transaction-flow-home contextual-tile-menu settings-tile-menu" data-settings-menu aria-label="Ενότητες ρυθμίσεων">
      <button class="home-tile transaction-flow-tile" data-settings-tab="general" type="button"><span class="home-tile-icon">ΓΕ</span><span class="home-tile-title">Γενικά</span><span class="home-tile-code">§ ΡΥ-Α</span></button>
      <button class="home-tile transaction-flow-tile" data-settings-tab="personnel" type="button"><span class="home-tile-icon">ΤΜ</span><span class="home-tile-title">Τμήματα Μονάδος</span><span class="home-tile-code">§ ΡΥ-Β</span></button>
      <button class="home-tile transaction-flow-tile" data-settings-tab="parameters" type="button"><span class="home-tile-icon">ΠΑ</span><span class="home-tile-title">Παράμετροι</span><span class="home-tile-code">§ ΡΥ-Γ</span></button>
      <button class="home-tile transaction-flow-tile" data-settings-tab="security" type="button"><span class="home-tile-icon">ΑΣ</span><span class="home-tile-title">Ασφάλεια και Backup</span><span class="home-tile-code">§ ΡΥ-Δ</span></button>
      <button class="home-tile transaction-flow-tile" data-settings-tab="information" type="button"><span class="home-tile-icon">ΠΛ</span><span class="home-tile-title">Πληροφορίες</span><span class="home-tile-code">§ ΡΥ-Ε</span></button>
    </nav>
    <div class="transaction-tab-panel" data-settings-panel="general" hidden>
      <div class="settings-layout">
        <section class="page-panel">
          <h3>Στοιχεία Υπηρεσίας</h3>
          <form id="service-form" class="stacked-form autosave-form">
            ${field('Στρατιωτική Υπηρεσία', 'serviceName', settings.serviceInfo.serviceName, 'π.χ. 1ο Τμήμα')}
            ${field('Τοποθεσία Στρατιωτικής Υπηρεσίας', 'serviceLocation', settings.serviceInfo.serviceLocation, 'π.χ. Αθήνα')}
            ${field('ΤΥΠΟΣ ΔΙΑΧΕΙΡΙΣΗΣ', 'managementType', settings.serviceInfo.managementType, 'π.χ. Γενική Διαχείριση Υλικού', 'data-preserve-case="true"')}
          </form>
        </section>

        <section class="page-panel">
          <h3>Οικονομικά Όργανα</h3>
          <form id="officers-form" class="stacked-form autosave-form">
            ${field('ΔΚΤΗΣ', 'commander', settings.financialOfficers.commander, '', 'data-preserve-case="true"')}
            ${field('Π.Ε.Δ', 'ped', settings.financialOfficers.ped, '', 'data-preserve-case="true"')}
            ${field('ΔΧΣΤΗΣ', 'manager', settings.financialOfficers.manager, '', 'data-preserve-case="true"')}
          </form>
        </section>

        ${renderInitialInventorySection()}
        ${renderCompositionImportSection()}
      </div>
    </div>

    <div class="transaction-tab-panel" data-settings-panel="personnel" hidden>
      <div class="settings-layout">
        <section class="page-panel wide-panel">
          <h3>Μερικοί Διαχειριστές</h3>
          ${renderDepartmentManagerTable(settings.departmentManagers)}
          <form id="department-form" class="inline-form">
            ${field('Τμήμα Μονάδος', 'departmentName')}
            ${field('Επικεφαλής Τμήματος', 'departmentHead', '', '', 'data-preserve-case="true"')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>
      </div>
    </div>

    <div class="transaction-tab-panel" data-settings-panel="parameters" hidden>
      <div class="settings-layout parameters-settings-layout">
        <section class="page-panel measurement-units-panel">
          <h3>Μονάδες Μέτρησης</h3>
          ${renderMeasurementUnitTable(settings.measurementUnits)}
          <form id="measurement-unit-form" class="inline-form">
            ${field('Περιγραφή', 'name')}
            ${field('Αγγλική ορολογία', 'code')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>

        <section class="page-panel">
          <h3>${materialCategorySection.title}</h3>
          ${renderNamedList(materialCategorySection.key, settings[materialCategorySection.itemsKey])}
          <form id="${materialCategorySection.key}-form" class="inline-form compact-form">
            ${field(materialCategorySection.inputLabel, 'name')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>

        <section class="page-panel">
          <h3>Μονάδες Δοσοληψιών</h3>
          ${renderNamedList('transaction-unit', settings.transactionUnits)}
          <form id="transaction-unit-form" class="inline-form compact-form">
            ${field('Νέα μονάδα δοσοληψιών', 'name')}
            <button class="primary-button" type="submit">Προσθήκη</button>
          </form>
        </section>

        <section class="page-panel wide-panel">
          <h3>Πεδία Καρτελών Υλικού</h3>
          <p class="muted">Ενεργοποιήστε ανά μερίδα τη Σύνθεση Υλικού, τον Σειριακό Αριθμό, το Μητρώο Οπλισμού, τα Πυρομαχικά Β.Φ. ή/και τα Πυρομαχικά Εκπαιδεύσεως.</p>
          ${renderMaterialCardFlags(shares)}
        </section>
      </div>
    </div>

    <div class="transaction-tab-panel" data-settings-panel="security" hidden>
      <div class="settings-layout security-settings-layout">
        <section class="page-panel">
          <h3>Στοιχεία Εισόδου</h3>
          <p class="muted">Η προστασία είναι ${authStatus.configured ? 'ενεργή' : 'ανενεργή'}. Ο κωδικός δεν αποθηκεύεται σε αναγνώσιμη μορφή.</p>
          <form id="change-password-form" class="stacked-form">
            <label class="field"><span>Τρέχων κωδικός</span><input name="currentPassword" type="password" autocomplete="current-password" required /></label>
            <label class="field"><span>Όνομα χρήστη</span><input name="username" value="${escapeHtml(authStatus.username || 'admin')}" minlength="3" maxlength="50" autocomplete="username" required /></label>
            <label class="field"><span>Νέος κωδικός</span><input name="newPassword" type="password" minlength="6" autocomplete="new-password" required /></label>
            <label class="field"><span>Επιβεβαίωση νέου κωδικού</span><input name="confirmation" type="password" minlength="6" autocomplete="new-password" required /></label>
            <button class="primary-button" type="submit">Αλλαγή κωδικού</button>
          </form>
          <div class="credential-recovery-settings">
            <h4>Ερωτήσεις Ασφαλείας</h4>
            <p class="muted">Αλλάξτε τις όταν αλλάζει ο Διαχειριστής. Για επιβεβαίωση απαιτείται ο τρέχων κωδικός.</p>
            <form data-security-questions-form class="stacked-form">
              <label class="field"><span>Τρέχων κωδικός</span><input name="currentPassword" type="password" autocomplete="current-password" required /></label>
              ${[1, 2, 3].map((number) => `
                <label class="field"><span>Ερώτηση ${number}</span><input name="question${number}" minlength="5" required /></label>
                <label class="field"><span>Απάντηση ${number}</span><input name="answer${number}" minlength="2" autocomplete="off" required /></label>
              `).join('')}
              <button class="secondary-button" type="submit">Αποθήκευση Ερωτήσεων Ασφαλείας</button>
            </form>
          </div>
        </section>

        <section class="page-panel">
          <h3>Αντίγραφα Ασφαλείας</h3>
          <p class="muted">Τα αντίγραφα περιλαμβάνουν τη βάση δεδομένων και τις αποθηκευμένες φωτογραφίες. Διατηρούνται αυτόματα τα 15 νεότερα.</p>
          <div class="backup-actions">
            <button class="primary-button" data-backup-now type="button">Αυτόματο αντίγραφο τώρα</button>
            <button class="secondary-button" data-backup-export type="button">Αποθήκευση σε φάκελο</button>
            <button class="danger-button" data-backup-restore type="button">Επαναφορά αντιγράφου</button>
            <button class="secondary-button" data-backup-cancel type="button" hidden>Ακύρωση</button>
          </div>
          <p class="muted" data-backup-status aria-live="polite"></p>
          <div class="backup-list">
            ${backups.length ? backups.map((backup) => `
              <article><strong>${escapeHtml(formatBackupDate(backup.createdAt))}</strong><span>${backup.kind === 'automatic' ? 'Αυτόματο' : 'Χειροκίνητο'} · ${backup.includesPhotos ? 'με φωτογραφίες' : 'χωρίς φωτογραφίες'}</span></article>
            `).join('') : '<p class="empty-table">Δεν υπάρχουν ακόμη αυτόματα αντίγραφα.</p>'}
          </div>
        </section>
      </div>
    </div>

    <div class="transaction-tab-panel" data-settings-panel="information" hidden>
      ${renderAppInformation(appVersion)}
    </div>
  `;

  if (initialTab) container.querySelector('.page-header')?.remove();
  bindSettingsTabs(container, initialTab);
  bindSettingsEvents(container, settingsApi, clothingApi, sharesApi, showToast);
}

export function renderAppInformation(version) {
  return `
    <div class="settings-layout information-settings-layout">
      <section class="page-panel app-information-panel">
        <img class="app-information-mark" src="../../build/icon.ico" alt="" aria-hidden="true" />
        <div class="app-information-content">
          <p class="eyebrow">ΔΙΑΧΕΙΡΙΣΗ ΥΛΙΚΟΥ</p>
          <h3>Πληροφορίες εφαρμογής</h3>
          <dl class="app-information-list">
            <div><dt>Έκδοση</dt><dd>${escapeHtml(version ? `v${version}` : 'Μη διαθέσιμη')}</dd></div>
            <div><dt>Δημιουργός</dt><dd>Λγος (ΦΠΒ) Αλεξανδρής Ιωάννης</dd></div>
          </dl>
          <div class="copyright-notice">
            <strong>© 2026 Λγος (ΦΠΒ) Αλεξανδρής Ιωάννης.</strong>
            <p>Με επιφύλαξη παντός δικαιώματος. Απαγορεύεται η μη εξουσιοδοτημένη αντιγραφή, τροποποίηση ή διανομή της εφαρμογής και του περιεχομένου της.</p>
          </div>
        </div>
      </section>
    </div>
  `;
}

function renderMaterialCardFlags(shares) {
  return `
    <div class="table-wrap material-card-flags-wrap">
      <table class="index-table material-card-flags-table">
        <thead><tr><th>Α/Α</th><th>Μερίδα Υλικού</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Σύνθεση Υλικού</th><th>Σειριακός Αριθμός</th><th>Μητρώο Οπλισμού</th><th>Πυρομαχικά Β.Φ.</th><th>Πυρομαχικά Εκπαιδεύσεως</th></tr></thead>
        <tbody>${shares.length ? shares.map((share, index) => `
          <tr data-material-card-flags="${share.id}">
            <td>${index + 1}</td>
            <td>${escapeHtml(share.shareNumber)}</td>
            <td>${escapeHtml(share.nominalNumber)}</td>
            <td class="material-description-cell">${escapeHtml(share.description)}</td>
            <td><input data-material-flag="requiresComposition" type="checkbox" ${share.requiresComposition ? 'checked' : ''} aria-label="Σύνθεση Υλικού ${escapeHtml(share.shareNumber)}" /></td>
            <td><input data-material-flag="requiresSerialNumber" type="checkbox" ${share.requiresSerialNumber ? 'checked' : ''} aria-label="Σειριακός Αριθμός ${escapeHtml(share.shareNumber)}" /></td>
            <td><input data-material-flag="requiresWeaponRegistry" type="checkbox" ${share.requiresWeaponRegistry ? 'checked' : ''} aria-label="Μητρώο Οπλισμού ${escapeHtml(share.shareNumber)}" /></td>
            <td><input data-material-flag="requiresAmmunitionBatchBook" type="checkbox" ${share.requiresAmmunitionBatchBook ? 'checked' : ''} aria-label="Πυρομαχικά Β.Φ. ${escapeHtml(share.shareNumber)}" /></td>
            <td><input data-material-flag="requiresTrainingAmmunitionBatchBook" type="checkbox" ${share.requiresTrainingAmmunitionBatchBook ? 'checked' : ''} aria-label="Πυρομαχικά Εκπαιδεύσεως ${escapeHtml(share.shareNumber)}" /></td>
          </tr>
        `).join('') : '<tr><td colspan="9" class="empty-table">Δεν υπάρχουν ενεργές μερίδες υλικού.</td></tr>'}</tbody>
      </table>
    </div>
  `;
}

export function renderInitialInventorySection() {
  return `
    <section class="page-panel wide-panel initial-inventory-panel">
      <div>
        <h3>Αρχική ενημέρωση μερίδων</h3>
        <p class="muted">Κατεβάστε το πρότυπο Excel, συμπληρώστε τα στοιχεία της τελευταίας ετήσιας απογραφής και εισαγάγετέ το. Οι υπάρχουσες μερίδες ενημερώνονται βάσει του αριθμού μερίδας και οι νέες δημιουργούνται αυτόματα.</p>
        <p class="muted">Υποχρεωτικά πεδία: Α/Α, Αριθμός Μερίδας, Περιγραφή, Μονάδα Μέτρησης και Ποσότητα. Ο Αριθμός Ονομαστικού είναι προαιρετικός.</p>
      </div>
      <div class="initial-inventory-actions">
        <button class="secondary-button" data-download-initial-inventory-template type="button">Λήψη προτύπου Excel</button>
        <form id="initial-inventory-form" class="stacked-form initial-inventory-form">
          <label class="field">
            <span>Ημερομηνία τελευταίας ετήσιας απογραφής</span>
            <input name="inventoryDate" type="date" />
          </label>
          <button class="primary-button" type="submit">Εισαγωγή αρχικής απογραφής</button>
        </form>
        <p class="muted" data-initial-inventory-status aria-live="polite">Δεν έχει επιλεγεί αρχείο.</p>
      </div>
    </section>
  `;
}

export function renderCompositionImportSection() {
  const today = new Date().toISOString().slice(0, 10);
  return `
    <section class="page-panel wide-panel initial-inventory-panel">
      <div>
        <h3>Ενημέρωση συνθέσεων μερίδων</h3>
        <p class="muted">Το πρότυπο περιλαμβάνει τις ενεργές συνθέσεις. Η εισαγωγή αντικαθιστά τις γραμμές των μερίδων που υπάρχουν στο Excel, χωρίς να επηρεάζει τις υπόλοιπες.</p>
        <p class="muted">Η Μη Χορηγηθείσα Ποσότητα υπολογίζεται αυτόματα: Προβλεπόμενη − Υπάρχουσα, με ελάχιστη τιμή το μηδέν.</p>
        <p class="muted">Ο Αριθμός Ονομαστικού είναι προαιρετικός. Το πρότυπο περιλαμβάνει ξεχωριστό φύλλο με οδηγίες συμπλήρωσης.</p>
      </div>
      <div class="initial-inventory-actions">
        <label class="field">
          <span>Ημερομηνία τελευταίας ετήσιας απογραφής</span>
          <input data-composition-inventory-date type="date" value="${today}" />
        </label>
        <button class="secondary-button" data-download-composition-template type="button">Λήψη προτύπου συνθέσεων</button>
        <button class="primary-button" data-import-compositions type="button">Εισαγωγή συνθέσεων από Excel</button>
        <p class="muted" data-composition-import-status aria-live="polite">Δεν έχει επιλεγεί αρχείο.</p>
      </div>
    </section>
  `;
}

function renderClothingItemsSection(items) {
  return `
    <h3>ΕΙΔΗ ΙΜΑΤΙΣΜΟΥ</h3>
    <div class="table-wrap request-codes-wrap">
      <table>
        <thead>
          <tr>
            <th>Α/Α</th>
            <th>Περιγραφή</th>
            <th>Σύντομη</th>
            <th>Κατηγορία</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items.length
            ? items.map((item, index) => `
                <tr data-clothing-item-id="${item.id}">
                  <td>${index + 1}</td>
                  <td>${escapeHtml(item.name)}</td>
                  <td>${escapeHtml(item.shortName || '')}</td>
                  <td>${escapeHtml(clothingCategoryLabel(item.category))}</td>
                  <td class="row-actions">
                    <button class="secondary-button" data-move-clothing="-1" type="button" ${index === 0 ? 'disabled' : ''}>↑</button>
                    <button class="secondary-button" data-move-clothing="1" type="button" ${index === items.length - 1 ? 'disabled' : ''}>↓</button>
                    <button class="danger-button" data-delete-clothing type="button" title="Διαγραφή">Δ</button>
                  </td>
                </tr>
              `).join('')
            : '<tr><td colspan="5" class="empty-table">Δεν υπάρχουν είδη ιματισμού.</td></tr>'}
        </tbody>
      </table>
    </div>
    <form id="clothing-item-form" class="inline-form">
      ${field('Περιγραφή', 'name', '', '', 'required')}
      ${field('Σύντομη', 'shortName')}
      <label class="field">
        <span>Κατηγορία</span>
        <select name="category" required>
          <option value="">Επιλογή</option>
          <option value="ιματισμός">Ιματισμός</option>
          <option value="υπόδηση">Υπόδηση</option>
          <option value="ατομικά">Ατομικά</option>
        </select>
      </label>
      ${field('Σειρά', 'sortOrder', String(items.length + 1), '', 'type="number" min="0" step="1" required')}
      <button class="primary-button" type="submit">Προσθήκη</button>
    </form>
  `;
}

function clothingCategoryLabel(category) {
  return {
    'ιματισμός': 'Ιματισμός',
    'υπόδηση': 'Υπόδηση',
    'ατομικά': 'Ατομικά'
  }[category] || category;
}

function bindSettingsTabs(container, initialTab = '') {
  const menu = container.querySelector('[data-settings-menu]');
  container.querySelectorAll('[data-settings-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.settingsTab;
      menu.hidden = true;
      container.querySelectorAll('[data-settings-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.settingsPanel !== tab;
      });
    });
  });
  if (initialTab) container.querySelector(`[data-settings-tab="${initialTab}"]`)?.click();
}

export function renderRequestPriorityTable() {
  return `
    <div class="table-wrap request-codes-wrap">
      <table class="settings-priority-table">
        <thead>
          <tr>
            <th>Επείγον Ανάγκης</th>
            <th>Σπουδαιότητα Μονάδων</th>
            ${requestPriorityColumns.map((column) => `<th>${escapeHtml(column.label)}</th>`).join('')}
          </tr>
          <tr>
            <th></th>
            <th>Προτεραιότητα Σχηματισμού</th>
            ${requestPriorityColumns
              .map((column) => `<th>${escapeHtml(column.formation).replace(/\n/g, '<br />')}</th>`)
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${requestPriorityRows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(row.urgency)}</td>
                  <td>${escapeHtml(row.description)}</td>
                  ${row.codes.map((code) => `<td>${escapeHtml(code)}</td>`).join('')}
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderMeasurementUnitTable(items) {
  if (!items.length) {
    return '<p class="empty-state">Δεν υπάρχουν μονάδες μέτρησης.</p>';
  }

  return `
    <div class="table-wrap request-codes-wrap">
      <table>
        <thead>
          <tr>
            <th>Περιγραφή</th>
            <th>Αγγλική ορολογία</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr data-id="${item.id}" data-kind="measurement-unit">
                  <td><input class="locked-input" data-field="name" value="${escapeHtml(item.name)}" readonly /></td>
                  <td><input class="locked-input" data-field="code" value="${escapeHtml(item.code || '')}" readonly /></td>
                  <td class="row-actions">
                    <button class="danger-button" data-action="delete-measurement-unit" type="button">Διαγραφή</button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderRequestCodeTable(items) {
  if (!items.length) {
    return '<p class="empty-state">Δεν έχουν καταχωρηθεί κωδικοί αιτήσεων.</p>';
  }

  return `
    <div class="table-wrap request-codes-wrap">
      <table>
        <thead>
          <tr>
            <th>α/α</th>
            <th>Κωδικός Αιτιολογίας</th>
            <th>Περιγραφή Κωδικού Αιτιολογίας</th>
            <th>Αυτόματη Διαγραφή Οφειλομένων</th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td class="strong-cell">${escapeHtml(item.code)}</td>
                  <td>${escapeHtml(item.description)}</td>
                  <td>${item.autoDeleteOwed ? 'ΝΑΙ' : 'ΟΧΙ'}</td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

function renderDepartmentManagerTable(items) {
  if (!items.length) {
    return '<p class="empty-state">Δεν έχουν προστεθεί μερικοί διαχειριστές.</p>';
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Τμήμα Μονάδος</th>
            <th>Επικεφαλής Τμήματος</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${items
            .map(
              (item) => `
                <tr data-id="${item.id}" data-kind="department-manager">
                  <td><input class="locked-input" data-field="departmentName" value="${escapeHtml(item.departmentName)}" readonly /></td>
                  <td><input class="locked-input" data-field="departmentHead" data-preserve-case="true" value="${escapeHtml(item.departmentHead)}" readonly /></td>
                  <td class="row-actions">
                    <button class="secondary-button" data-action="edit-department" type="button">Επεξεργασία</button>
                    <button class="danger-button" data-action="delete-department" type="button">Διαγραφή</button>
                  </td>
                </tr>
              `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `;
}

export function renderNamedList(kind, items) {
  if (!items.length) {
    return '<p class="empty-state">Δεν υπάρχουν εγγραφές.</p>';
  }

  return `
    <div class="item-list">
      ${items
        .map(
          (item) => `
            <div class="list-row no-save-row" data-id="${item.id}" data-kind="${kind}">
              <input class="locked-input" data-field="name" value="${escapeHtml(item.name)}" readonly />
              <button class="danger-button" data-action="delete-${kind}" type="button">Διαγραφή</button>
            </div>
          `
        )
        .join('')}
    </div>
  `;
}

export function renderExhpIssueReasonSettings(items, selectedReasonName = '') {
  if (!items.length) {
    return '<p class="empty-state">Δεν υπάρχουν αιτιολογίες εκδόσεως.</p>';
  }

  const selectedItem = items.find((item) => item.name === selectedReasonName) || items[0];

  return `
    <div class="exhp-reason-settings">
      <label class="field">
        <span>Αιτιολογία Εκδόσεως</span>
        <select id="exhp-reason-settings-select">
          ${items.map((item) => `
            <option value="${item.id}" ${item.id === selectedItem.id ? 'selected' : ''}>${escapeHtml(item.name)}</option>
          `).join('')}
        </select>
      </label>
      <article class="exhp-reason-setting" data-exhp-reason-setting="${selectedItem.id}">
        <label class="field">
          <span>Εισήγηση</span>
          <textarea data-field="recommendationText" rows="3">${escapeHtml(selectedItem.recommendationText || '')}</textarea>
        </label>
        <label class="field">
          <span>Γνωμάτευση 1η</span>
          <textarea data-field="firstOpinionText" rows="3">${escapeHtml(selectedItem.firstOpinionText || '')}</textarea>
        </label>
        <label class="field">
          <span>Γνωμάτευση 2η</span>
          <textarea data-field="secondOpinionText" rows="3">${escapeHtml(selectedItem.secondOpinionText || '')}</textarea>
        </label>
        <div class="row-actions">
          <button class="primary-button" data-save-exhp-reason-texts type="button">Αποθήκευση Κειμένων</button>
        </div>
      </article>
    </div>
  `;
}

export function syncExhpIssueReasonSettings(container, items, selectedReasonName) {
  if (!items.length) return;

  const selectedItem = items.find((item) => item.name === selectedReasonName) || items[0];
  const select = container.querySelector('#exhp-reason-settings-select');
  const row = container.querySelector('[data-exhp-reason-setting]');
  if (!select || !row) return;

  select.value = String(selectedItem.id);
  row.dataset.exhpReasonSetting = String(selectedItem.id);
  row.querySelector('[data-field="recommendationText"]').value = selectedItem.recommendationText || '';
  row.querySelector('[data-field="firstOpinionText"]').value = selectedItem.firstOpinionText || '';
  row.querySelector('[data-field="secondOpinionText"]').value = selectedItem.secondOpinionText || '';
}

function bindSettingsEvents(container, settingsApi, clothingApi, sharesApi, showToast) {
  bindAutosaveForm(container, '#service-form', showToast, async (form) => {
    await settingsApi.saveServiceInfo(getFormData(form));
  });

  bindAutosaveForm(container, '#officers-form', showToast, async (form) => {
    await settingsApi.saveFinancialOfficers(getFormData(form));
  });

  bindInitialInventoryEvents(container, settingsApi, showToast);
  bindCompositionImportEvents(container, settingsApi, showToast);

  bindForm(container, '#department-form', showToast, async (form) => {
    await settingsApi.addDepartmentManager(getFormData(form));
    await refresh(container, settingsApi, showToast, 'Ο μερικός διαχειριστής προστέθηκε.');
  });

  bindForm(container, `#${materialCategorySection.key}-form`, showToast, async (form) => {
    await settingsApi[materialCategorySection.addMethod](getFormData(form));
    await refresh(container, settingsApi, showToast, materialCategorySection.addMessage);
  });

  bindForm(container, '#measurement-unit-form', showToast, async (form) => {
    await settingsApi.addMeasurementUnit(getFormData(form));
    await refresh(container, settingsApi, showToast, 'Η μονάδα μέτρησης προστέθηκε.');
  });

  bindForm(container, '#transaction-unit-form', showToast, async (form) => {
    await settingsApi.addTransactionUnit(getFormData(form));
    await refresh(container, settingsApi, showToast, 'Η μονάδα δοσοληψιών προστέθηκε.');
  });

  bindForm(container, '#change-password-form', showToast, async (form) => {
    const data = getFormData(form);
    await window.appApi.auth.changeCredentials(data.currentPassword, data.username, data.newPassword, data.confirmation);
    form.reset();
    showToast('Το όνομα χρήστη και ο κωδικός εισόδου ενημερώθηκαν.');
  });

  bindForm(container, '[data-security-questions-form]', showToast, async (form) => {
    const data = getFormData(form);
    await window.appApi.auth.changeSecurityQuestions(
      data.currentPassword,
      [1, 2, 3].map((number) => ({
        question: data[`question${number}`],
        answer: data[`answer${number}`]
      }))
    );
    form.reset();
    showToast('Οι ερωτήσεις ασφαλείας ενημερώθηκαν.');
  });

  const backupButtons = [...container.querySelectorAll('[data-backup-now], [data-backup-export], [data-backup-restore]')];
  const cancelBackupButton = container.querySelector('[data-backup-cancel]');
  const backupStatus = container.querySelector('[data-backup-status]');
  let activeBackupTask = '';
  const stopProgress = window.appApi.backup.onProgress((progress) => {
    if (!activeBackupTask || progress.id !== activeBackupTask || !backupStatus) return;
    const percentage = progress.total ? Math.round(progress.current * 100 / progress.total) : 0;
    backupStatus.textContent = `${progress.message || 'Προετοιμασία…'} ${percentage}%`;
  });
  const runBackupAction = async (operation) => {
    activeBackupTask = crypto.randomUUID();
    backupButtons.forEach((button) => { button.disabled = true; });
    if (cancelBackupButton) cancelBackupButton.hidden = false;
    if (backupStatus) backupStatus.textContent = 'Προετοιμασία…';
    try {
      return await operation(activeBackupTask);
    } finally {
      activeBackupTask = '';
      backupButtons.forEach((button) => { button.disabled = false; });
      if (cancelBackupButton) cancelBackupButton.hidden = true;
    }
  };
  cancelBackupButton?.addEventListener('click', async () => {
    if (activeBackupTask) await window.appApi.backup.cancel(activeBackupTask);
  });

  container.querySelector('[data-backup-now]')?.addEventListener('click', async () => {
    try {
      await runBackupAction((taskId) => window.appApi.backup.createAutomatic(taskId));
      showToast('Δημιουργήθηκε νέο αυτόματο αντίγραφο.');
      await renderSettingsPage(container, settingsApi, clothingApi, showToast, 'security', sharesApi);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η δημιουργία αντιγράφου.', 'error');
    }
  });

  container.querySelector('[data-backup-export]')?.addEventListener('click', async () => {
    try {
      const backup = await runBackupAction((taskId) => window.appApi.backup.createManual(taskId));
      if (backup) showToast('Το αντίγραφο ασφαλείας αποθηκεύτηκε στον επιλεγμένο φάκελο.');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση του αντιγράφου.', 'error');
    }
  });

  container.querySelector('[data-backup-restore]')?.addEventListener('click', async () => {
    if (!window.confirm('Η εφαρμογή θα επανεκκινηθεί και τα τρέχοντα δεδομένα θα αντικατασταθούν. Θα δημιουργηθεί πρώτα αντίγραφο ασφαλείας. Συνέχεια;')) return;
    try {
      const result = await runBackupAction((taskId) => window.appApi.backup.restore(taskId));
      if (result) showToast('Το αντίγραφο ετοιμάστηκε. Η εφαρμογή επανεκκινείται.');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η επαναφορά του αντιγράφου.', 'error');
    }
  });

  bindDeletes(container, settingsApi, showToast);

  container.querySelectorAll('[data-material-flag]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => {
      const row = checkbox.closest('[data-material-card-flags]');
      const inputs = Object.fromEntries(
        [...row.querySelectorAll('[data-material-flag]')].map((input) => [input.dataset.materialFlag, input.checked])
      );
      try {
        await sharesApi.updateDetails(Number(row.dataset.materialCardFlags), inputs);
        showToast('Τα πεδία της καρτέλας υλικού ενημερώθηκαν.');
      } catch (error) {
        checkbox.checked = !checkbox.checked;
        showToast(error.message || 'Δεν ήταν δυνατή η ενημέρωση της καρτέλας.', 'error');
      }
    });
  });
}

function bindInitialInventoryEvents(container, settingsApi, showToast) {
  const downloadButton = container.querySelector('[data-download-initial-inventory-template]');
  const form = container.querySelector('#initial-inventory-form');
  const status = container.querySelector('[data-initial-inventory-status]');

  downloadButton?.addEventListener('click', async () => {
    downloadButton.disabled = true;
    try {
      const result = await settingsApi.downloadInitialInventoryTemplate();
      if (!result) return;
      status.textContent = `Το πρότυπο αποθηκεύτηκε: ${result.filePath}`;
      showToast(result.message || 'Το πρότυπο Excel δημιουργήθηκε.');
    } catch (error) {
      status.textContent = error.message || 'Δεν ήταν δυνατή η δημιουργία του προτύπου.';
      showToast(status.textContent, 'error');
    } finally {
      downloadButton.disabled = false;
    }
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const inventoryDate = form.elements.inventoryDate.value;
    if (!inventoryDate) {
      status.textContent = 'Συμπληρώστε την ημερομηνία της τελευταίας ετήσιας απογραφής.';
      showToast(status.textContent, 'error');
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    if (inventoryDate > today) {
      status.textContent = 'Η ημερομηνία δεν μπορεί να είναι μελλοντική.';
      showToast(status.textContent, 'error');
      return;
    }
    if (!window.confirm('Η εισαγωγή θα δημιουργήσει νέες μερίδες και θα ενημερώσει τις υπάρχουσες βάσει του αριθμού μερίδας. Να συνεχιστεί;')) return;

    const submitButton = form.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    const taskId = crypto.randomUUID();
    const stopProgress = window.appApi.heavyTasks.onProgress((progress) => {
      if (progress.id === taskId && progress.message) status.textContent = progress.message;
    });
    status.textContent = 'Έλεγχος και εισαγωγή του αρχείου αρχικής απογραφής...';
    try {
      const result = await settingsApi.importInitialInventory(inventoryDate, taskId);
      if (!result) {
        status.textContent = 'Η επιλογή αρχείου ακυρώθηκε.';
        return;
      }
      status.textContent = `${result.message} Αριθμός απογραφής: ${result.serialNumber}.`;
      showToast(result.message || 'Η αρχική απογραφή εισήχθη επιτυχώς.');
    } catch (error) {
      status.textContent = error.message || 'Δεν ήταν δυνατή η εισαγωγή της αρχικής απογραφής.';
      showToast(status.textContent, 'error');
    } finally {
      stopProgress();
      submitButton.disabled = false;
    }
  });
}

function bindCompositionImportEvents(container, settingsApi, showToast) {
  const downloadButton = container.querySelector('[data-download-composition-template]');
  const importButton = container.querySelector('[data-import-compositions]');
  const status = container.querySelector('[data-composition-import-status]');
  const inventoryDate = container.querySelector('[data-composition-inventory-date]');

  downloadButton?.addEventListener('click', async () => {
    downloadButton.disabled = true;
    try {
      const result = await settingsApi.downloadCompositionTemplate();
      if (!result) return;
      status.textContent = `Το πρότυπο αποθηκεύτηκε: ${result.filePath}`;
      showToast(result.message || 'Το πρότυπο συνθέσεων δημιουργήθηκε.');
    } catch (error) {
      status.textContent = error.message || 'Δεν ήταν δυνατή η δημιουργία του προτύπου.';
      showToast(status.textContent, 'error');
    } finally {
      downloadButton.disabled = false;
    }
  });

  importButton?.addEventListener('click', async () => {
    if (!inventoryDate?.value) {
      status.textContent = 'Συμπληρώστε την ημερομηνία τελευταίας ετήσιας απογραφής.';
      showToast(status.textContent, 'error');
      return;
    }
    if (inventoryDate.value > new Date().toISOString().slice(0, 10)) {
      status.textContent = 'Η ημερομηνία δεν μπορεί να είναι μελλοντική.';
      showToast(status.textContent, 'error');
      return;
    }
    if (!window.confirm('Οι συνθέσεις των μερίδων που περιλαμβάνονται στο Excel θα αντικατασταθούν. Να συνεχιστεί;')) return;
    importButton.disabled = true;
    const taskId = crypto.randomUUID();
    const stopProgress = window.appApi.heavyTasks.onProgress((progress) => {
      if (progress.id === taskId && progress.message) status.textContent = progress.message;
    });
    status.textContent = 'Έλεγχος και εισαγωγή του αρχείου συνθέσεων...';
    try {
      const result = await settingsApi.importCompositions(taskId, inventoryDate.value);
      if (!result) {
        status.textContent = 'Η επιλογή αρχείου ακυρώθηκε.';
        return;
      }
      status.textContent = result.message;
      showToast(result.message || 'Οι συνθέσεις ενημερώθηκαν.');
    } catch (error) {
      status.textContent = error.message || 'Δεν ήταν δυνατή η εισαγωγή των συνθέσεων.';
      showToast(status.textContent, 'error');
    } finally {
      stopProgress();
      importButton.disabled = false;
    }
  });
}

function formatBackupDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('el-GR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function bindClothingSettings(container, clothingApi, showToast, initialItems) {
  const section = container.querySelector('#clothing-items-section');
  let items = initialItems;

  const bindAddForm = () => {
    const form = section.querySelector('#clothing-item-form');
    form?.addEventListener('submit', async (event) => {
      event.preventDefault();
      try {
        await clothingApi.addItem(getFormData(form));
        await refreshSection();
        showToast('Το είδος ιματισμού προστέθηκε.');
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η προσθήκη του είδους ιματισμού.', 'error');
      }
    });
  };

  const refreshSection = async () => {
    items = await clothingApi.getItems();
    section.innerHTML = renderClothingItemsSection(items);
    bindAddForm();
  };

  bindAddForm();
  section.addEventListener('click', async (event) => {
    const row = event.target.closest('[data-clothing-item-id]');
    if (!row) return;
    const itemId = Number(row.dataset.clothingItemId);
    const itemIndex = items.findIndex((item) => item.id === itemId);

    if (event.target.closest('[data-delete-clothing]')) {
      if (!window.confirm('Να διαγραφεί το είδος ιματισμού;')) return;
      try {
        await clothingApi.deleteItem(itemId);
        await refreshSection();
        showToast('Το είδος ιματισμού διαγράφηκε.');
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η διαγραφή του είδους ιματισμού.', 'error');
      }
      return;
    }

    const moveButton = event.target.closest('[data-move-clothing]');
    if (!moveButton) return;
    const targetIndex = itemIndex + Number(moveButton.dataset.moveClothing);
    if (itemIndex < 0 || targetIndex < 0 || targetIndex >= items.length) return;

    try {
      const current = items[itemIndex];
      const target = items[targetIndex];
      await clothingApi.updateItem(current.id, clothingItemUpdatePayload(current, target.sortOrder));
      await clothingApi.updateItem(target.id, clothingItemUpdatePayload(target, current.sortOrder));
      await refreshSection();
      showToast('Η σειρά των ειδών ιματισμού ενημερώθηκε.');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αλλαγή σειράς.', 'error');
    }
  });
}

function clothingItemUpdatePayload(item, sortOrder) {
  return {
    name: item.name,
    shortName: item.shortName,
    category: item.category,
    sortOrder
  };
}

function bindDeletes(container, settingsApi, showToast) {
  if (typeof container.__settingsDeletesCleanup === 'function') container.__settingsDeletesCleanup();

  const settingsDeletesClickHandler = async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) {
      return;
    }

    const row = button.closest('[data-id]');
    const id = Number(row.dataset.id);
    const action = button.dataset.action;

    try {
      if (action === 'edit-department') {
        const inputs = [...row.querySelectorAll('[data-field]')];
        const editing = button.dataset.editing === 'true';
        if (!editing) {
          inputs.forEach((input) => { input.readOnly = false; input.classList.remove('locked-input'); });
          button.dataset.editing = 'true';
          button.textContent = 'Αποθήκευση';
          inputs[0]?.focus();
          return;
        }
        await settingsApi.updateDepartmentManager(id, {
          departmentName: row.querySelector('[data-field="departmentName"]').value,
          departmentHead: row.querySelector('[data-field="departmentHead"]').value
        });
        await refresh(container, settingsApi, showToast, 'Τα στοιχεία του Τμήματος ενημερώθηκαν.');
        return;
      }

      if (action === 'delete-department') {
        await settingsApi.deleteDepartmentManager(id);
        await refresh(container, settingsApi, showToast, 'Η εγγραφή διαγράφηκε.');
        return;
      }

      if (action === 'delete-measurement-unit') {
        await settingsApi.deleteMeasurementUnit(id);
        await refresh(container, settingsApi, showToast, 'Η μονάδα μέτρησης διαγράφηκε.');
        return;
      }

      if (action === `delete-${materialCategorySection.key}`) {
        await settingsApi[materialCategorySection.deleteMethod](id);
        await refresh(container, settingsApi, showToast, materialCategorySection.deleteMessage);
        return;
      }

      if (action === 'delete-transaction-unit') {
        await settingsApi.deleteTransactionUnit(id);
        await refresh(container, settingsApi, showToast, 'Η μονάδα δοσοληψιών διαγράφηκε.');
      }
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
    }
  };
  container.addEventListener('click', settingsDeletesClickHandler);
  container.__settingsDeletesCleanup = () => {
    container.removeEventListener('click', settingsDeletesClickHandler);
  };
}

export function bindRequestSettings(container, settingsApi, showToast, rerender) {
  if (typeof container.__settingsRequestCleanup === 'function') container.__settingsRequestCleanup();

  bindForm(container, '#request-issuing-unit-form', showToast, async (form) => {
    await settingsApi.addRequestIssuingUnit(getFormData(form));
    await refreshMovedSettings(container, rerender, showToast, 'Η μονάδα χορήγησης προστέθηκε.');
  });

  const settingsRequestClickHandler = async (event) => {
    const button = event.target.closest('[data-action="delete-request-issuing-unit"]');
    if (!button) return;
    try {
      await settingsApi.deleteRequestIssuingUnit(Number(button.closest('[data-id]').dataset.id));
      await refreshMovedSettings(container, rerender, showToast, 'Η μονάδα χορήγησης διαγράφηκε.');
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
    }
  };
  container.addEventListener('click', settingsRequestClickHandler);
  container.__settingsRequestCleanup = () => {
    container.removeEventListener('click', settingsRequestClickHandler);
  };
}

export function bindTransactionSettings(container, settingsApi, exhpIssueReasons, showToast, rerender) {
  if (typeof container.__settingsTransactionCleanup === 'function') container.__settingsTransactionCleanup();

  bindForm(container, '#transaction-unit-form', showToast, async (form) => {
    await settingsApi.addTransactionUnit(getFormData(form));
    await refreshMovedSettings(container, () => rerender('addy'), showToast, 'Η μονάδα δοσοληψιών προστέθηκε.');
  });

  bindForm(container, '#exhp-issue-reason-form', showToast, async (form) => {
    await settingsApi.addExhpIssueReason(getFormData(form));
    await refreshMovedSettings(container, () => rerender('exhp'), showToast, 'Η αιτιολογία εκδόσεως προστέθηκε.');
  });

  container.querySelector('#exhp-reason-settings-select')?.addEventListener('change', (event) => {
    const selectedItem = exhpIssueReasons.find((item) => item.id === Number(event.target.value));
    syncExhpIssueReasonSettings(container, exhpIssueReasons, selectedItem?.name);
  });

  const settingsTransactionClickHandler = async (event) => {
    const saveTexts = event.target.closest('[data-save-exhp-reason-texts]');
    if (saveTexts) {
      const row = saveTexts.closest('[data-exhp-reason-setting]');
      try {
        await settingsApi.updateExhpIssueReasonTexts(
          Number(row.dataset.exhpReasonSetting),
          Object.fromEntries(
            [...row.querySelectorAll('[data-field]')].map((input) => [input.dataset.field, input.value])
          )
        );
        showToast('Τα κείμενα της ΕΧΠ αποθηκεύτηκαν.');
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση των κειμένων.', 'error');
      }
      return;
    }

    const button = event.target.closest('button[data-action]');
    if (!button) return;
    const id = Number(button.closest('[data-id]').dataset.id);
    try {
      if (button.dataset.action === 'delete-transaction-unit') {
        await settingsApi.deleteTransactionUnit(id);
        await refreshMovedSettings(container, () => rerender('addy'), showToast, 'Η μονάδα δοσοληψιών διαγράφηκε.');
      }
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
    }
  };
  container.addEventListener('click', settingsTransactionClickHandler);
  container.__settingsTransactionCleanup = () => {
    container.removeEventListener('click', settingsTransactionClickHandler);
  };
}

function bindAutosaveForm(container, selector, showToast, onSave) {
  const form = container.querySelector(selector);
  const save = debounce(async () => {
    await onSave(form);
    showToast('Η αλλαγή αποθηκεύτηκε αυτόματα.');
  }, 700, showToast);

  form.addEventListener('submit', (event) => event.preventDefault());

  for (const input of form.querySelectorAll('input')) {
    input.addEventListener('input', save);
    input.addEventListener('blur', save);
  }
}

function bindForm(container, selector, showToast, onSubmit) {
  const form = container.querySelector(selector);
  if (!form) return;
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      await onSubmit(form);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η προσθήκη.', 'error');
    }
  });
}

function debounce(operation, delay, showToast) {
  let timeoutId;

  return () => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(async () => {
      try {
        await operation();
      } catch (error) {
        showToast(error.message || 'Δεν ήταν δυνατή η αυτόματη αποθήκευση.', 'error');
      }
    }, delay);
  };
}

async function refresh(container, settingsApi, showToast, message) {
  const activePanel = Array.from(container.querySelectorAll('[data-settings-panel]'))
    .find((panel) => !panel.hidden);
  const activeTab = activePanel?.dataset.settingsPanel || '';
  await renderSettingsPage(
    container,
    settingsApi,
    window.appApi.clothing,
    showToast,
    activeTab,
    window.appApi.shares
  );
  const content = container.closest('.content');
  if (content) content.scrollTop = 0;
  showToast(message);
}

async function refreshMovedSettings(container, rerender, showToast, message) {
  await rerender();
  const content = container.closest('.content');
  if (content) content.scrollTop = 0;
  showToast(message);
}
