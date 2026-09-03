import { escapeHtml } from '../../components/forms.js';
import { splitOfficerSignature } from '../../officerSignature.js';
import { renderOfficialHandoverProtocol } from '../../handoverProtocol.js';
import { renderControlledMaterialsBook, renderWeaponRegistry, bindControlledMaterialEvents } from '../../administration/controlledMaterials.js';

export async function renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast, selectedHandoverId = null, initialTab = '', sharesApi = window.appApi.shares) {
  const settings = await settingsApi.get();
  const currentYear = Number(settings?.serviceInfo?.activeFiscalYear || new Date().getFullYear());
  const [data, serialRegistry, ammunitionBatchRegistry, trainingAmmunitionBatchRegistry, managementReport, shareCards, weaponRegistry] = await Promise.all([
    api.getReferenceData(),
    sharesApi.listSerialRegistry(),
    sharesApi.listAmmunitionBatchRegistry(),
    sharesApi.listTrainingAmmunitionBatchRegistry(),
    api.getManagementReport(currentYear),
    sharesApi.getCardsBatch({ mode: 'all', year: currentYear }),
    sharesApi.listWeaponRegistry()
  ]);
  const selectedHandover = selectedHandoverId ? await api.getHandover(selectedHandoverId) : null;

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΓΕΝΙΚΗ ΔΙΑΧΕΙΡΙΣΗ</p>
        <h2>Διαχείριση Υλικού</h2>
      </div>
    </section>

    <section class="transaction-flow-home contextual-tile-menu administration-tile-menu" data-administration-menu>
      <button class="home-tile transaction-flow-tile" data-administration-tab="handover" type="button"><span class="home-tile-icon">ΠΠ</span><span class="home-tile-title">Παράδοση - Παραλαβή</span><span class="home-tile-code">§ ΔΧ-Α</span></button>
      <button class="home-tile transaction-flow-tile" data-administration-tab="management-report" type="button"><span class="home-tile-icon">ΑΔ</span><span class="home-tile-title">Αναφορά Διαχείρισης</span><span class="home-tile-code">§ ΔΧ-Β</span></button>
      <button class="home-tile transaction-flow-tile" data-administration-tab="aggregate-prints" type="button"><span class="home-tile-icon">ΕΚ</span><span class="home-tile-title">ΕΚΤΥΠΩΣΕΙΣ</span><span class="home-tile-code">§ ΔΧ-Γ</span></button>
      <button class="home-tile transaction-flow-tile" data-administration-tab="books-registries" type="button"><span class="home-tile-icon">ΒΜ</span><span class="home-tile-title">Βιβλία &amp; Μητρώα</span><span class="home-tile-code">§ ΔΧ-Δ</span></button>
    </section>
    <div data-administration-panel="handover" hidden>
      ${renderHandoverPanel(data, selectedHandover, settings)}
    </div>
    <div data-administration-panel="management-report" hidden>
      ${renderManagementReport(managementReport)}
    </div>
    <div data-administration-panel="books-registries" hidden>
      <nav class="transaction-flow-home contextual-tile-menu administration-subtab-menu" data-administration-submenu aria-label="Βιβλία και μητρώα">
        <button class="home-tile transaction-flow-tile" data-administration-subtab="serial-numbers" type="button"><span class="home-tile-icon">SN</span><span class="home-tile-title">Σειριακοί Αριθμοί</span><span class="home-tile-code">§ ΒΜ-1</span></button>
        <button class="home-tile transaction-flow-tile" data-administration-subtab="ammunition-batches" type="button"><span class="home-tile-icon">ΒΦ</span><span class="home-tile-title">Βιβλίο Μερίδων Β.Φ.</span><span class="home-tile-code">§ ΒΜ-2</span></button>
        <button class="home-tile transaction-flow-tile" data-administration-subtab="training-ammunition-batches" type="button"><span class="home-tile-icon">ΠΕ</span><span class="home-tile-title">Βιβλίο Μερίδων Πυρομαχικών Εκπαιδεύσεως</span><span class="home-tile-code">§ ΒΜ-3</span></button>
        <button class="home-tile transaction-flow-tile" data-administration-subtab="controlled-materials" type="button"><span class="home-tile-icon">ΕΥ</span><span class="home-tile-title">Βιβλίο Ελεγχομένων Υλικών</span><span class="home-tile-code">§ ΒΜ-4</span></button>
        <button class="home-tile transaction-flow-tile" data-administration-subtab="weapon-registry" type="button"><span class="home-tile-icon">ΜΟ</span><span class="home-tile-title">Μητρώο Οπλισμού</span><span class="home-tile-code">§ ΒΜ-5</span></button>
      </nav>
      <div data-administration-subpanel="serial-numbers" hidden>${renderBooksRegistryBackButton()}${renderSerialNumberRegistry(serialRegistry)}</div>
      <div data-administration-subpanel="ammunition-batches" hidden>${renderBooksRegistryBackButton()}${renderAmmunitionBatchRegistry(ammunitionBatchRegistry)}</div>
      <div data-administration-subpanel="training-ammunition-batches" hidden>${renderBooksRegistryBackButton()}${renderTrainingAmmunitionBatchRegistry(trainingAmmunitionBatchRegistry)}</div>
      <div data-administration-subpanel="controlled-materials" hidden>${renderBooksRegistryBackButton()}${renderControlledMaterialsBook(shareCards)}</div>
      <div data-administration-subpanel="weapon-registry" hidden>${renderBooksRegistryBackButton()}${renderWeaponRegistry(weaponRegistry)}</div>
    </div>
  `;

  if (initialTab) container.querySelector('.page-header')?.remove();
  bindAdministrationPage(container, api, annualAccountsApi, settingsApi, sharesApi, data, selectedHandover, settings, showToast, initialTab);
}

function renderBooksRegistryBackButton() {
  return '<button class="secondary-button books-registries-back-button no-print" data-back-to-books-registries type="button">Πίσω στα Βιβλία και Μητρώα</button>';
}

export function renderManagementReport(report) {
  const metrics = [
    ['Σύνολο Μερίδων', report.totalShares],
    ['Μηδενικές Μερίδες', report.zeroBalanceShares],
    ['Μερίδες με Υπόλοιπο', report.sharesWithBalance],
    [`Κίνηση εντός ${report.fiscalYear}`, report.movedShares],
    ['Μερίδες με Έλλειμμα', report.deficitShares],
    ['Μερίδες με Πλεόνασμα', report.surplusShares],
    ['Μερίδες που απαιτούν Σύνθεση', report.compositionShares],
    ['Σύνθεση που δεν καταχωρήθηκε', report.missingCompositionShares],
    ['Μερίδες με ίδιο Αριθμό Ονομαστικού', report.duplicateNominalShares]
  ];
  return `
    <section class="page-panel wide-panel management-report-panel">
      <div class="requests-status-header">
        <div>
          <h3>Αναφορά Διαχείρισης</h3>
          <p class="muted">Συνοπτική εικόνα των ενεργών Μερίδων για το τρέχον οικονομικό έτος ${escapeHtml(report.fiscalYear)}.</p>
        </div>
      </div>
      <div class="management-report-grid">
        ${metrics.map(([label, value]) => `
          <article class="management-report-card">
            <strong>${escapeHtml(value)}</strong>
            <span>${escapeHtml(label)}</span>
          </article>
        `).join('')}
      </div>
      <section class="management-report-details">
        <h4>Επαναλαμβανόμενοι Αριθμοί Ονομαστικού</h4>
        <div class="table-wrap">
          <table class="index-table">
            <thead><tr><th>Αριθμός Ονομαστικού</th><th>Πλήθος Μερίδων</th><th>Αριθμοί Μερίδων</th></tr></thead>
            <tbody>${report.duplicateNominalGroups.length
              ? report.duplicateNominalGroups.map((group) => `
                <tr>
                  <td>${escapeHtml(group.nominalNumber)}</td>
                  <td>${group.shareCount}</td>
                  <td>${escapeHtml(group.shareNumbers)}</td>
                </tr>
              `).join('')
              : '<tr><td colspan="3" class="empty-table">Δεν υπάρχουν ενεργές Μερίδες με ίδιο Αριθμό Ονομαστικού.</td></tr>'}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  `;
}

function renderSerialNumberRegistry(registry) {
  let sequence = 0;
  const rows = registry.map((item) => {
    sequence += 1;
    if (!item.entries.length) {
      return `<tr data-serial-share="${item.share.id}"><td>${sequence}</td><td>${escapeHtml(item.share.shareNumber)}</td><td>${escapeHtml(item.share.nominalNumber)}</td><td class="material-description-cell">${escapeHtml(item.share.description)}</td><td>0</td><td colspan="3" class="empty-table">Δεν υπάρχει τελικώς χρεωμένη ποσότητα.</td></tr>`;
    }
    return item.entries.map((entry, index) => `
      <tr data-serial-share="${item.share.id}" data-serial-position="${entry.position}">
        ${index === 0 ? `<td rowspan="${item.entries.length}">${sequence}</td><td rowspan="${item.entries.length}">${escapeHtml(item.share.shareNumber)}</td><td rowspan="${item.entries.length}">${escapeHtml(item.share.nominalNumber)}</td><td rowspan="${item.entries.length}" class="material-description-cell">${escapeHtml(item.share.description)}</td><td rowspan="${item.entries.length}">${item.quantity}</td>` : ''}
        <td><input data-serial-number value="${escapeHtml(entry.serialNumber)}" aria-label="S/N ${entry.position}" disabled /></td>
        <td class="serial-department-cell">${escapeHtml(entry.department || '—')}</td>
        <td><input data-serial-notes value="${escapeHtml(entry.notes)}" aria-label="Παρατηρήσεις ${entry.position}" disabled /></td>
      </tr>
    `).join('');
  }).join('');
  return `
    <section class="page-panel wide-panel serial-number-registry-panel">
      <div class="requests-status-header"><div><h3>Μητρώο Σειριακών Αριθμών</h3><p class="muted">Οι γραμμές και τα τμήματα προκύπτουν αυτόματα από την τελικώς χρεωμένη ποσότητα κάθε μερίδας.</p></div><div class="row-actions serial-registry-actions"><button class="secondary-button" data-edit-serial-registry type="button">Επεξεργασία</button><button class="primary-button" data-save-serial-registry type="button" disabled>Αποθήκευση</button><button class="secondary-button" data-preview-serial-registry type="button">Προβολή</button></div></div>
      <div class="table-wrap serial-number-registry-wrap">
        <table class="index-table serial-number-registry-table">
          <thead><tr><th>Α/Α</th><th>Μερίδα Υλικού</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Ποσότητα</th><th>S/N</th><th>Τμήμα</th><th>Παρατηρήσεις</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="8" class="empty-table">Δεν υπάρχουν μερίδες με ενεργοποιημένο Σειριακό Αριθμό.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAmmunitionBatchRegistry(registry) {
  const rows = registry.flatMap((item, shareIndex) => {
    const entries = item.entries.length ? item.entries : [{}];
    return entries.map((entry, entryIndex) =>
      renderAmmunitionBatchRow(item.share, item.departments, entry, shareIndex, entryIndex)
    );
  }).join('');
  return `
    <section class="page-panel wide-panel ammunition-batch-registry-panel">
      <div class="requests-status-header">
        <div>
          <h3>Βιβλίο Μερίδων Β.Φ.</h3>
          <p class="muted">Εμφανίζονται μόνο οι καρτέλες με ενεργό το πεδίο «Πυρομαχικά Β.Φ.». Σε κάθε καρτέλα μπορούν να καταχωριστούν όσες Μερίδες Πυρκού απαιτούνται, με ξεχωριστή ποσότητα.</p>
        </div>
        <div class="row-actions">
          <button class="primary-button" data-save-ammunition-batches type="button">Αποθήκευση</button>
          <button class="secondary-button" data-preview-ammunition-batches type="button">Προβολή</button>
        </div>
      </div>
      <div class="table-wrap ammunition-batch-registry-wrap">
        <table class="index-table ammunition-batch-registry-table" data-ammunition-batch-table>
          <thead><tr><th>Α/Α</th><th>Μερίδα Υλικού</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Μερίδα Πυρκού</th><th>Ποσότητα</th><th>Τμήμα</th><th>Παρατηρήσεις</th><th class="no-print">Ενέργειες</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="9" class="empty-table">Δεν υπάρχουν καρτέλες με ενεργό το πεδίο «Πυρομαχικά Β.Φ.».</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderAmmunitionBatchRow(share, departments = [], entry = {}, shareIndex = 0, entryIndex = 0) {
  const selectedDepartment = entry.department ||
    (departments.length === 1 ? departments[0].department : '');
  const departmentOptions = [
    '<option value="">Επιλογή</option>',
    ...departments.map((item) => `
      <option value="${escapeHtml(item.department)}" ${item.department === selectedDepartment ? 'selected' : ''}>
        ${escapeHtml(item.department)} (${escapeHtml(item.quantity)})
      </option>
    `)
  ].join('');
  return `
    <tr data-ammunition-batch-row data-ammunition-share="${share.id}" data-share-index="${shareIndex}">
      <td>${shareIndex + 1}</td>
      <td>${escapeHtml(share.shareNumber)}</td>
      <td>${escapeHtml(share.nominalNumber)}</td>
      <td class="material-description-cell">${escapeHtml(share.description)}</td>
      <td><input data-ammunition-batch-number value="${escapeHtml(entry.batchNumber || '')}" aria-label="Μερίδα Πυρκού ${entryIndex + 1}" /></td>
      <td><input data-ammunition-batch-quantity type="number" min="0.001" step="0.001" value="${escapeHtml(entry.quantity || '')}" aria-label="Ποσότητα Μερίδας Πυρκού ${entryIndex + 1}" /></td>
      <td><select data-ammunition-batch-department aria-label="Τμήμα Μερίδας Πυρκού ${entryIndex + 1}">${departmentOptions}</select></td>
      <td><input data-ammunition-batch-notes value="${escapeHtml(entry.notes || '')}" aria-label="Παρατηρήσεις Μερίδας Πυρκού ${entryIndex + 1}" /></td>
      <td class="no-print ammunition-batch-actions-cell"><div class="row-actions"><button class="secondary-button" data-add-ammunition-batch="${share.id}" type="button">+ Νέα</button><button class="danger-button" data-remove-ammunition-batch type="button">Διαγραφή</button></div></td>
    </tr>
  `;
}

function renderTrainingAmmunitionBatchRegistry(registry) {
  const rows = registry.flatMap((item, shareIndex) => {
    const entries = item.entries.length ? item.entries : [{}];
    return entries.map((entry, entryIndex) =>
      renderTrainingAmmunitionBatchRow(item.share, item.departments, entry, shareIndex, entryIndex)
    );
  }).join('');
  return `
    <section class="page-panel wide-panel training-ammunition-batch-registry-panel">
      <div class="requests-status-header">
        <div>
          <h3>Βιβλίο Μερίδων Πυρομαχικών Εκπαιδεύσεως</h3>
          <p class="muted">Εμφανίζονται μόνο οι καρτέλες με ενεργό το πεδίο «Πυρομαχικά Εκπαιδεύσεως» στις Ρυθμίσεις.</p>
        </div>
        <div class="row-actions">
          <button class="primary-button" data-save-training-ammunition-batches type="button">Αποθήκευση</button>
          <button class="secondary-button" data-preview-training-ammunition-batches type="button">Προβολή</button>
        </div>
      </div>
      <div class="table-wrap ammunition-batch-registry-wrap">
        <table class="index-table ammunition-batch-registry-table" data-training-ammunition-batch-table>
          <thead><tr><th>Α/Α</th><th>Μερίδα Υλικού</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Μερίδα Πυρκού</th><th>Ποσότητα</th><th>Τμήμα</th><th>Παρατηρήσεις</th><th class="no-print">Ενέργειες</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="9" class="empty-table">Δεν υπάρχουν καρτέλες με ενεργό το πεδίο «Πυρομαχικά Εκπαιδεύσεως».</td></tr>'}</tbody>
        </table>
      </div>
    </section>`;
}

function renderTrainingAmmunitionBatchRow(share, departments = [], entry = {}, shareIndex = 0, entryIndex = 0) {
  const selectedDepartment = entry.department || (departments.length === 1 ? departments[0].department : '');
  const departmentOptions = [
    '<option value="">Επιλογή</option>',
    ...departments.map((item) => `<option value="${escapeHtml(item.department)}" ${item.department === selectedDepartment ? 'selected' : ''}>${escapeHtml(item.department)} (${escapeHtml(item.quantity)})</option>`)
  ].join('');
  return `
    <tr data-training-ammunition-batch-row data-training-ammunition-share="${share.id}" data-share-index="${shareIndex}">
      <td>${shareIndex + 1}</td><td>${escapeHtml(share.shareNumber)}</td><td>${escapeHtml(share.nominalNumber)}</td>
      <td class="material-description-cell">${escapeHtml(share.description)}</td>
      <td><input data-training-ammunition-batch-number value="${escapeHtml(entry.batchNumber || '')}" aria-label="Μερίδα Πυρκού ${entryIndex + 1}" /></td>
      <td><input data-training-ammunition-batch-quantity type="number" min="0.001" step="0.001" value="${escapeHtml(entry.quantity || '')}" aria-label="Ποσότητα Μερίδας Πυρκού ${entryIndex + 1}" /></td>
      <td><select data-training-ammunition-batch-department aria-label="Τμήμα Μερίδας Πυρκού ${entryIndex + 1}">${departmentOptions}</select></td>
      <td><input data-training-ammunition-batch-notes value="${escapeHtml(entry.notes || '')}" aria-label="Παρατηρήσεις Μερίδας Πυρκού ${entryIndex + 1}" /></td>
      <td class="no-print ammunition-batch-actions-cell"><div class="row-actions"><button class="secondary-button" data-add-training-ammunition-batch="${share.id}" type="button">+ Νέα</button><button class="danger-button" data-remove-training-ammunition-batch type="button">Διαγραφή</button></div></td>
    </tr>`;
}

function renderHandoverPanel(data, selected, settings) {
  const manager = settings.financialOfficers.manager || '';
  return `
    <section class="page-panel">
      <h3>Νέο Πρωτόκολλο Παράδοσης Γενικής Διαχείρισης</h3>
      <div class="administration-form-grid handover-create-grid">
        <label class="field"><span>ΗΜΕΡΟΜΗΝΙΑ ΠΑΡΑΔΟΣΗΣ</span><input id="handover-start" type="date" value="${data.today}" /></label>
        <label class="field"><span>Διαταγή Παράδοσης</span><input id="handover-order" /></label>
        <label class="field administration-wide-field"><span>Παραδίδων (ΔΧΣΤΗΣ)</span><input id="handover-outgoing" data-preserve-case="true" value="${escapeHtml(manager)}" readonly /></label>
        <label class="field administration-wide-field"><span>Παραλαμβάνων</span><input id="handover-incoming" data-preserve-case="true" /></label>
        <label class="field">
          <span>Ολοκληρωμένη Απογραφή</span>
          <select id="handover-inventory"><option value="">Επιλογή</option>${data.inventories.map((item) => `<option value="${item.id}">${item.serialNumber} · ${formatDate(item.inventoryDate)}</option>`).join('')}</select>
        </label>
        <button id="handover-create" class="primary-button" type="button">Δημιουργία</button>
      </div>
    </section>
    <section class="page-panel">
      <h3>Πρωτόκολλα Παράδοσης</h3>
      <div class="table-wrap">
        <table class="index-table administration-table">
          <thead><tr><th>Α/Α</th><th>Ημερομηνία Παράδοσης</th><th>Παραδίδων</th><th>Παραλαμβάνων</th><th>Απογραφή</th><th>Έλεγχοι</th><th>Κατάσταση</th><th>Άνοιγμα</th><th>Επεξεργασία</th></tr></thead>
          <tbody>
            ${data.handovers.length ? data.handovers.map((item) => `
              <tr>
                <td>${item.serialNumber}</td><td>${formatDate(item.completionDate || item.startDate)}</td>
                <td>${escapeHtml(manager || item.outgoingOfficer)}</td><td>${escapeHtml(item.incomingOfficer)}</td>
                <td>${escapeHtml(item.inventoryReference || '-')}</td>
                <td>${item.completedCheckCount}/${item.checkCount}</td>
                <td><span class="status-pill ${item.status === 'Ολοκληρωμένη' ? 'balanced' : 'pending'}">${escapeHtml(item.status)}</span></td>
                <td><button data-preview-handover="${item.id}" class="secondary-button" type="button">Άνοιγμα</button></td>
                <td><button data-open-handover="${item.id}" class="secondary-button" type="button">Επεξεργασία</button></td>
              </tr>
            `).join('') : '<tr><td colspan="9" class="empty-table">Δεν υπάρχουν πρωτόκολλα παράδοσης.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    ${selected ? renderHandoverWorkspace(selected, data.today, settings) : ''}
  `;
}

function renderHandoverWorkspace(handover, today, settings) {
  const locked = handover.status === 'Ολοκληρωμένη';
  const outgoingOfficer = settings.financialOfficers.manager || handover.outgoingOfficer;
  return `
    <section class="page-panel handover-workspace">
      <div class="requests-status-header">
        <div><h3>Πρωτόκολλο ${handover.serialNumber}</h3><p class="muted">${escapeHtml(handover.orderReference)} · Απογραφή ${escapeHtml(handover.inventoryReference || 'δεν συνδέθηκε')}</p></div>
        <div class="row-actions">
          <span class="status-pill ${locked ? 'balanced' : 'pending'}">${escapeHtml(handover.status)}</span>
          <button id="handover-protocol-preview" class="secondary-button" type="button">Προεπισκόπηση / Εκτύπωση ΕΦΕΔ 500</button>
        </div>
      </div>
      ${renderHandoverProtocolForm(handover)}
      <div class="handover-checklist">
        ${handover.checks.map((check) => `
          <label class="handover-check">
            <input data-handover-check="${check.id}" type="checkbox" ${check.completed ? 'checked' : ''} ${locked ? 'disabled' : ''} />
            <span>${escapeHtml(check.label)}</span>
            <input data-handover-check-notes="${check.id}" value="${escapeHtml(check.notes)}" placeholder="Παρατήρηση" ${locked ? 'disabled' : ''} />
          </label>
        `).join('')}
      </div>
      ${locked ? `
        <div class="handover-signatures">
          <div><span>Ο Παραδίδων</span>${renderOfficerIdentity(outgoingOfficer)}<p>${escapeHtml(handover.protocolData?.outgoingObservations || handover.outgoingObservations)}</p></div>
          <div><span>Ο Παραλαμβάνων</span>${renderOfficerIdentity(handover.incomingOfficer)}<p>${escapeHtml(handover.protocolData?.receivingObservations || handover.incomingObservations)}</p></div>
        </div>
      ` : `
        <div class="administration-form-grid handover-completion">
          <label class="field"><span>ΗΜΕΡΟΜΗΝΙΑ ΠΑΡΑΔΟΣΗΣ</span><input id="handover-completion-date" type="date" value="${handover.completionDate || today}" /></label>
          <button id="handover-complete" data-handover-id="${handover.id}" class="primary-button" type="button">Ολοκλήρωση Παράδοσης</button>
        </div>
      `}
    </section>
  `;
}

function renderHandoverProtocolForm(handover) {
  const data = handover.protocolData || {};
  const assistants = Array.from({ length: 3 }, (_, index) => data.assistants?.[index] || {});
  return `
    <details class="settings-menu handover-protocol-form" open>
      <summary>Στοιχεία Εντύπου ΕΦΕΔ 500</summary>
      <div class="administration-form-grid">
        ${protocolField('Ημερομηνία κατάστασης υπολοίπων', 'handover-protocol-inventory-date', data.inventoryStatementDate, 'date')}
        ${protocolField('Μερίδες από Α/Α', 'handover-protocol-share-from', data.shareRangeFrom)}
        ${protocolField('Μερίδες έως Α/Α', 'handover-protocol-share-to', data.shareRangeTo)}
      </div>

      <h4>Βοηθοί Γενικού Διαχειριστή</h4>
      <div class="table-wrap">
        <table class="index-table handover-assistants-table">
          <thead><tr><th>Α/Α</th><th>Βαθμός</th><th>Ονοματεπώνυμο</th><th>Κατηγορίες Υλικού</th><th>Μερίδες από</th><th>Μερίδες έως</th></tr></thead>
          <tbody>${assistants.map((assistant, index) => `
            <tr data-handover-assistant>
              <td>${index + 1}</td>
              <td><input data-assistant-field="rank" value="${escapeHtml(assistant.rank || '')}" /></td>
              <td><input data-assistant-field="name" data-preserve-case="true" value="${escapeHtml(assistant.name || '')}" /></td>
              <td><input data-assistant-field="categories" value="${escapeHtml(assistant.categories || '')}" /></td>
              <td><input data-assistant-field="shareRangeFrom" value="${escapeHtml(assistant.shareRangeFrom || '')}" /></td>
              <td><input data-assistant-field="shareRangeTo" value="${escapeHtml(assistant.shareRangeTo || '')}" /></td>
            </tr>
          `).join('')}</tbody>
        </table>
      </div>

      <div class="administration-form-grid handover-protocol-fields">
        ${protocolTextarea('Στοιχεία δειγματοληπτικής καταμέτρησης', 'handover-protocol-sample-details', data.sampleCountingDetails)}
        ${protocolField('Ποσοστό ολογράφως', 'handover-protocol-sample-words', data.samplePercentageWords)}
        ${protocolField('Ποσοστό αριθμητικώς', 'handover-protocol-sample-number', data.samplePercentageNumber)}
        <label class="field handover-checkbox-field"><span>Πλήρης καταμέτρηση</span><input id="handover-protocol-full-count" type="checkbox" ${data.fullCountCompleted ? 'checked' : ''} /></label>
        ${protocolTextarea('Πλεονάσματα / παραπομπή κατάστασης', 'handover-protocol-surpluses', data.surplusesReference)}
        ${protocolTextarea('Ελλείμματα / παραπομπή κατάστασης', 'handover-protocol-deficits', data.deficitsReference)}
        ${protocolField('Απογραφή Υλικού', 'handover-protocol-inventory-reference', data.inventoryInspectionReference)}
        ${protocolField('Ημερομηνία απογραφής', 'handover-protocol-inspection-date', data.inventoryInspectionDate, 'date')}
        ${protocolField('Είδος απογραφής', 'handover-protocol-inspection-type', data.inventoryInspectionType)}
        ${protocolField('Οικονομικός Έλεγχος', 'handover-protocol-financial-reference', data.financialInspectionReference)}
        ${protocolField('Ημερομηνία οικονομικού ελέγχου', 'handover-protocol-financial-date', data.financialInspectionDate, 'date')}
        ${protocolField('Είδος οικονομικού ελέγχου', 'handover-protocol-financial-type', data.financialInspectionType)}
        <label class="field"><span>Ιδιαίτερη αποθήκη εύφλεκτου υλικού</span><select id="handover-protocol-separate-storage"><option value="">Επιλογή</option><option value="yes" ${data.separateStorage === 'yes' ? 'selected' : ''}>ΝΑΙ</option><option value="no" ${data.separateStorage === 'no' ? 'selected' : ''}>ΟΧΙ</option></select></label>
        ${protocolTextarea('Περιγραφή ιδιαίτερης αποθήκης', 'handover-protocol-storage-description', data.separateStorageDescription)}
        ${protocolTextarea('Ασφάλεια υλικών υψηλής αξίας', 'handover-protocol-high-value', data.highValueSecurity)}
        ${protocolTextarea('Μέτρα ασφαλείας καυσίμων', 'handover-protocol-fuel', data.fuelSecurity)}
        ${protocolTextarea('Εκκρεμότητες Διαχείρισης Υλικού', 'handover-protocol-pending', data.managementPending || handover.pendingDocuments)}
        ${protocolTextarea('Παρατηρήσεις Παραλαμβάνοντος', 'handover-protocol-receiving-notes', data.receivingObservations || handover.incomingObservations)}
        ${protocolTextarea('Παρατηρήσεις Παραδίδοντος', 'handover-protocol-outgoing-notes', data.outgoingObservations || handover.outgoingObservations)}
        ${protocolField('Βοηθοί Γεν. Δχστη', 'handover-protocol-general-assistants', data.generalManagerAssistants || data.inventoryCommitteePresident)}
        ${protocolField('Προϊστάμενος Λογιστηρίου', 'handover-protocol-accounting-supervisor', data.accountingSupervisor)}
      </div>
      <div class="addy-save-row">
        <span class="muted">Τα στοιχεία χρησιμοποιούνται στην εκτύπωση «Παράδοση Γενικής Διαχείρισης».</span>
        <button id="handover-protocol-save" data-handover-id="${handover.id}" class="primary-button" type="button">Αποθήκευση Στοιχείων ΕΦΕΔ 500</button>
      </div>
    </details>
  `;
}

function protocolField(label, id, value, type = 'text') {
  return `<label class="field"><span>${label}</span><input id="${id}" type="${type}" value="${escapeHtml(value || '')}" /></label>`;
}

function protocolTextarea(label, id, value) {
  return `<label class="field administration-wide-field"><span>${label}</span><textarea id="${id}" rows="3">${escapeHtml(value || '')}</textarea></label>`;
}

export function renderArchivePanel(data) {
  const eligible = data.activeShares.filter((share) => share.accountingBalance === 0 && share.chargedQuantity === 0);
  const archiveDate = `${String(data.today || new Date().toISOString().slice(0, 10)).slice(0, 4)}-12-31`;
  return `
    <section class="page-panel">
      <h3>Αρχειοθέτηση Ανενεργής Μερίδας</h3>
      <p class="muted">Εμφανίζονται όλες οι ενεργές Μερίδες με μηδενικό λογιστικό και μηδενικό χρεωμένο υπόλοιπο. Επιλέξτε «Αρχείο» για όσες θα αρχειοθετηθούν.</p>
      <div class="administration-form-grid archive-options-grid">
        <label class="field"><span>Ημερομηνία αρχειοθέτησης</span><input id="archive-date" type="date" value="${archiveDate}" readonly /></label>
        <label class="field administration-wide-field"><span>Αιτιολογία</span><input id="archive-reason" placeholder="Κατάργηση είδους, μεταβολή ΑΟ ή άλλη διαταγή" /></label>
      </div>
      <div class="table-wrap">
        <table class="index-table administration-table archive-selection-table">
          <thead><tr><th>Α/Α</th><th>Αριθμός Μερίδας</th><th>Α/Ο</th><th>Περιγραφή</th><th>Ποσότητα</th><th>Αρχείο</th></tr></thead>
          <tbody>${eligible.length ? eligible.map((share, index) => `
            <tr><td>${index + 1}</td><td>${escapeHtml(share.shareNumber)}</td><td>${escapeHtml(share.nominalNumber)}</td><td class="material-description-cell">${escapeHtml(share.description)}</td><td>${escapeHtml(formatQuantity(share.accountingBalance))}</td><td><label class="checkbox-field"><input data-archive-share="${share.id}" type="checkbox" /><span>Αρχείο</span></label></td></tr>
          `).join('') : '<tr><td colspan="6" class="empty-table">Δεν υπάρχουν Μερίδες που πληρούν τις προϋποθέσεις.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="form-actions archive-submit-actions"><button id="archive-submit" class="primary-button" type="button" ${eligible.length ? '' : 'disabled'}>Αρχειοθέτηση Επιλεγμένων</button></div>
    </section>
    <section class="page-panel">
      <div class="section-heading archived-shares-heading">
        <h3>Αρχειοθετημένες Μερίδες</h3>
        <button class="primary-button compact-print-button no-print" data-preview-archive-table type="button" ${data.archivedShares.length ? '' : 'disabled'}>Προβολή</button>
      </div>
      <div class="table-wrap">
        <table class="index-table administration-table" data-archived-shares-table>
          <thead><tr><th>Α/Α</th><th>Μερίδα</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Ημερομηνία</th><th>Αιτιολογία</th><th class="no-print"></th></tr></thead>
          <tbody>${data.archivedShares.length ? data.archivedShares.map((share, index) => `
            <tr><td>${index + 1}</td><td>${escapeHtml(share.shareNumber)}</td><td>${escapeHtml(share.nominalNumber)}</td><td class="material-description-cell">${escapeHtml(share.description)}</td><td>${formatDate(share.archivedAt)}</td><td>${escapeHtml(share.archiveReason)}</td><td class="no-print"><button data-restore-share="${share.id}" class="secondary-button" type="button">Επαναφορά</button></td></tr>
          `).join('') : '<tr><td colspan="7" class="empty-table">Δεν υπάρχουν αρχειοθετημένες Μερίδες.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function setSerialRegistryEditing(container, editing) {
  container.querySelectorAll('[data-serial-number], [data-serial-notes]').forEach((input) => {
    input.disabled = !editing;
  });
  const editButton = container.querySelector('[data-edit-serial-registry]');
  const saveButton = container.querySelector('[data-save-serial-registry]');
  if (editButton) editButton.disabled = editing;
  if (saveButton) saveButton.disabled = !editing;
  if (editing) container.querySelector('[data-serial-number]')?.focus();
}

function collectSerialRegistryPreviewRows(container) {
  let sharedCells = [];
  return [...container.querySelectorAll('.serial-number-registry-table tbody tr')].map((row) => {
    const cells = [...row.children];
    if (!row.dataset.serialPosition) {
      return { emptyHtml: row.innerHTML };
    }
    if (cells[0]?.hasAttribute('rowspan')) {
      sharedCells = cells.slice(0, 5).map((cell) => cell.textContent.trim());
    }
    return {
      group: row.dataset.serialShare,
      sharedCells,
      serialNumber: row.querySelector('[data-serial-number]')?.value || '',
      department: row.querySelector('.serial-department-cell')?.textContent.trim() || '',
      notes: row.querySelector('[data-serial-notes]')?.value || ''
    };
  });
}

function renderSerialRegistryPreviewPage(rows, pageNumber, pageCount) {
  const body = rows.map((row, index) => {
    if (row.emptyHtml) return `<tr>${row.emptyHtml}</tr>`;
    const previous = rows[index - 1];
    const startsGroup = !previous || previous.group !== row.group;
    let shared = '';
    if (startsGroup) {
      let rowspan = 1;
      while (rows[index + rowspan]?.group === row.group) rowspan += 1;
      shared = row.sharedCells.map((value, cellIndex) => `<td rowspan="${rowspan}"${cellIndex === 3 ? ' class="material-description-cell"' : ''}>${escapeHtml(value)}</td>`).join('');
    }
    return `<tr>${shared}<td>${escapeHtml(row.serialNumber)}</td><td class="serial-department-cell">${escapeHtml(row.department)}</td><td>${escapeHtml(row.notes)}</td></tr>`;
  }).join('');
  return `
    <article class="serial-registry-print-page print-document-area">
      <table class="index-table serial-number-registry-print-table">
        <thead><tr><th>Α/Α</th><th>Μερίδα Υλικού</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Ποσότητα</th><th>S/N</th><th>Τμήμα</th><th>Παρατηρήσεις</th></tr></thead>
        <tbody>${body}</tbody>
      </table>
      <footer>Σελίδα ${pageNumber} από Σελίδες ${pageCount}</footer>
    </article>`;
}

function openSerialRegistryPreview(container, showToast) {
  const rows = collectSerialRegistryPreviewRows(container);
  const rowsPerPage = 18;
  const pages = [];
  for (let index = 0; index < rows.length; index += rowsPerPage) {
    pages.push(rows.slice(index, index + rowsPerPage));
  }
  if (!pages.length) pages.push([]);

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop handover-document-backdrop serial-registry-preview-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal handover-document-modal serial-registry-preview-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">ΕΛΕΓΧΟΣ ΕΚΤΥΠΩΣΗΣ</p><h2>Μητρώο Σειριακών Αριθμών</h2></div>
        <div class="row-actions"><button class="secondary-button" data-close-serial-preview type="button">Κλείσιμο</button><button class="primary-button" data-print-serial-preview type="button">Εκτύπωση</button></div>
      </header>
      <div class="handover-document-preview serial-registry-preview">${pages.map((page, index) => renderSerialRegistryPreviewPage(page, index + 1, pages.length)).join('')}</div>
    </section>`;
  modal.querySelector('[data-close-serial-preview]').addEventListener('click', () => modal.remove());
  modal.querySelector('[data-print-serial-preview]').addEventListener('click', async () => {
    try {
      await printSerialRegistryPreview(modal.querySelector('.serial-registry-preview'));
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η εκτύπωση του μητρώου σειριακών αριθμών.', 'error');
    }
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) modal.remove();
  });
  document.body.appendChild(modal);
}

async function printSerialRegistryPreview(preview) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root serial-registry-print-root';
  printRoot.innerHTML = preview.innerHTML;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await new Promise((resolve) => {
      window.requestAnimationFrame(() => window.requestAnimationFrame(resolve));
    });
    await window.appApi.print.currentDocument({ landscape: true });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

function bindAdministrationPage(container, api, annualAccountsApi, settingsApi, sharesApi, data, selectedHandover, settings, showToast, initialTab = '') {
  const menu = container.querySelector('[data-administration-menu]');
  const bookSubtabs = new Set([
    'serial-numbers',
    'ammunition-batches',
    'training-ammunition-batches',
    'controlled-materials',
    'weapon-registry'
  ]);
  bindControlledMaterialEvents(container, showToast, sharesApi);
  container.querySelectorAll('[data-administration-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.administrationTab;
      if (tab === 'aggregate-prints') {
        document.dispatchEvent(new CustomEvent('diaxeirisi:navigate', {
          detail: { sectionId: 'prints' }
        }));
        return;
      }
      menu.hidden = true;
      container.querySelectorAll('[data-administration-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.administrationPanel !== tab;
      });
    });
  });

  container.querySelectorAll('[data-administration-subtab]').forEach((button) => {
    button.addEventListener('click', () => {
      const subtab = button.dataset.administrationSubtab;
      const submenu = button.closest('[data-administration-panel]')?.querySelector('[data-administration-submenu]');
      if (submenu) submenu.hidden = true;
      container.querySelectorAll('[data-administration-subpanel]').forEach((panel) => {
        panel.hidden = panel.dataset.administrationSubpanel !== subtab;
      });
    });
  });

  container.querySelectorAll('[data-back-to-books-registries]').forEach((button) => {
    button.addEventListener('click', () => {
      container.querySelectorAll('[data-administration-subpanel]').forEach((panel) => { panel.hidden = true; });
      const booksPanel = button.closest('[data-administration-panel="books-registries"]');
      const submenu = booksPanel?.querySelector('[data-administration-submenu]');
      if (submenu) submenu.hidden = false;
      const controlledMenu = booksPanel?.querySelector('[data-controlled-material-menu]');
      if (controlledMenu) controlledMenu.hidden = false;
      booksPanel?.querySelectorAll('[data-controlled-material-panel]').forEach((panel) => { panel.hidden = true; });
    });
  });

  if (selectedHandover) {
    container.querySelector('[data-administration-tab="handover"]').click();
  } else if (initialTab) {
    if (bookSubtabs.has(initialTab)) {
      container.querySelector('[data-administration-tab="books-registries"]')?.click();
      container.querySelector(`[data-administration-subtab="${initialTab}"]`)?.click();
    } else {
      container.querySelector(`[data-administration-tab="${initialTab}"]`)?.click();
    }
  }

  container.querySelector('[data-save-serial-registry]')?.addEventListener('click', async () => run(async () => {
    const grouped = new Map();
    container.querySelectorAll('[data-serial-position]').forEach((row) => {
      const shareId = Number(row.dataset.serialShare);
      if (!grouped.has(shareId)) grouped.set(shareId, []);
      grouped.get(shareId).push({
        position: Number(row.dataset.serialPosition),
        serialNumber: row.querySelector('[data-serial-number]').value,
        notes: row.querySelector('[data-serial-notes]').value
      });
    });
    for (const [shareId, entries] of grouped) {
      await sharesApi.saveSerialNumbers(shareId, entries);
    }
    setSerialRegistryEditing(container, false);
    showToast('Οι σειριακοί αριθμοί αποθηκεύτηκαν.');
  }, showToast));

  container.querySelector('[data-edit-serial-registry]')?.addEventListener('click', () => {
    setSerialRegistryEditing(container, true);
  });

  container.querySelector('[data-preview-serial-registry]')?.addEventListener('click', () => {
    openSerialRegistryPreview(container, showToast);
  });

  container.querySelector('[data-save-ammunition-batches]')?.addEventListener('click', async () => run(async () => {
    const grouped = new Map();
    container.querySelectorAll('[data-ammunition-batch-row]').forEach((row) => {
      const shareId = Number(row.dataset.ammunitionShare);
      if (!grouped.has(shareId)) grouped.set(shareId, []);
      const batchNumber = row.querySelector('[data-ammunition-batch-number]').value.trim();
      const quantity = row.querySelector('[data-ammunition-batch-quantity]').value;
      const department = row.querySelector('[data-ammunition-batch-department]').value;
      const notes = row.querySelector('[data-ammunition-batch-notes]').value.trim();
      if (batchNumber || quantity || notes) {
        grouped.get(shareId).push({ batchNumber, quantity, department, notes });
      }
    });
    for (const [shareId, entries] of grouped) {
      await sharesApi.saveAmmunitionBatches(shareId, entries);
    }
    showToast('Το Βιβλίο Μερίδων Β.Φ. αποθηκεύτηκε.');
    await renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast, null, 'ammunition-batches', sharesApi);
  }, showToast));

  container.querySelector('[data-preview-ammunition-batches]')?.addEventListener('click', () => {
    openAmmunitionBatchPreview(
      container.querySelector('[data-ammunition-batch-table]'),
      'Βιβλίο Μερίδων Β.Φ.'
    );
  });

  container.querySelector('[data-ammunition-batch-table]')?.addEventListener('click', (event) => {
    const add = event.target.closest('[data-add-ammunition-batch]');
    const remove = event.target.closest('[data-remove-ammunition-batch]');
    const row = event.target.closest('[data-ammunition-batch-row]');
    if (!row) return;
    if (add) {
      const clone = row.cloneNode(true);
      clone.querySelectorAll('input').forEach((input) => { input.value = ''; });
      const sameShareRows = [...container.querySelectorAll(`[data-ammunition-batch-row][data-ammunition-share="${row.dataset.ammunitionShare}"]`)];
      sameShareRows[sameShareRows.length - 1].after(clone);
      clone.querySelector('[data-ammunition-batch-number]')?.focus();
    } else if (remove) {
      const sameShareRows = [...container.querySelectorAll(`[data-ammunition-batch-row][data-ammunition-share="${row.dataset.ammunitionShare}"]`)];
      if (sameShareRows.length === 1) {
        row.querySelectorAll('input').forEach((input) => { input.value = ''; });
      } else {
        row.remove();
      }
    }
  });

  container.querySelector('[data-save-training-ammunition-batches]')?.addEventListener('click', async () => run(async () => {
    const grouped = new Map();
    container.querySelectorAll('[data-training-ammunition-batch-row]').forEach((row) => {
      const shareId = Number(row.dataset.trainingAmmunitionShare);
      if (!grouped.has(shareId)) grouped.set(shareId, []);
      const batchNumber = row.querySelector('[data-training-ammunition-batch-number]').value.trim();
      const quantity = row.querySelector('[data-training-ammunition-batch-quantity]').value;
      const department = row.querySelector('[data-training-ammunition-batch-department]').value;
      const notes = row.querySelector('[data-training-ammunition-batch-notes]').value.trim();
      if (batchNumber || quantity || notes) grouped.get(shareId).push({ batchNumber, quantity, department, notes });
    });
    for (const [shareId, entries] of grouped) {
      await sharesApi.saveTrainingAmmunitionBatches(shareId, entries);
    }
    showToast('Το Βιβλίο Μερίδων Πυρομαχικών Εκπαιδεύσεως αποθηκεύτηκε.');
    await renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast, null, 'training-ammunition-batches', sharesApi);
  }, showToast));

  container.querySelector('[data-preview-training-ammunition-batches]')?.addEventListener('click', () => {
    openAmmunitionBatchPreview(
      container.querySelector('[data-training-ammunition-batch-table]'),
      'Βιβλίο Μερίδων Πυρομαχικών Εκπαιδεύσεως'
    );
  });

  container.querySelector('[data-training-ammunition-batch-table]')?.addEventListener('click', (event) => {
    const add = event.target.closest('[data-add-training-ammunition-batch]');
    const remove = event.target.closest('[data-remove-training-ammunition-batch]');
    const row = event.target.closest('[data-training-ammunition-batch-row]');
    if (!row) return;
    if (add) {
      const clone = row.cloneNode(true);
      clone.querySelectorAll('input').forEach((input) => { input.value = ''; });
      const rows = [...container.querySelectorAll(`[data-training-ammunition-batch-row][data-training-ammunition-share="${row.dataset.trainingAmmunitionShare}"]`)];
      rows[rows.length - 1].after(clone);
      clone.querySelector('[data-training-ammunition-batch-number]')?.focus();
    } else if (remove) {
      const rows = [...container.querySelectorAll(`[data-training-ammunition-batch-row][data-training-ammunition-share="${row.dataset.trainingAmmunitionShare}"]`)];
      if (rows.length === 1) row.querySelectorAll('input').forEach((input) => { input.value = ''; });
      else row.remove();
    }
  });

  container.querySelector('#handover-create').addEventListener('click', async () => run(async () => {
    const result = await api.createHandover({
      startDate: value(container, '#handover-start'),
      orderReference: value(container, '#handover-order'),
      outgoingOfficer: value(container, '#handover-outgoing'),
      incomingOfficer: value(container, '#handover-incoming'),
      inventorySessionId: Number(value(container, '#handover-inventory')) || null,
      pendingDocuments: ''
    });
    showToast(result.message);
    await renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast, result.id);
  }, showToast));

  container.querySelector('#archive-submit')?.addEventListener('click', async () => run(async () => {
    const selected = [...container.querySelectorAll('[data-archive-share]:checked')];
    if (!selected.length) throw new Error('Επιλέξτε τουλάχιστον μία Μερίδα για αρχειοθέτηση.');
    for (const checkbox of selected) {
      await api.archiveShare({
        shareId: Number(checkbox.dataset.archiveShare),
        actionDate: value(container, '#archive-date'),
        reason: value(container, '#archive-reason')
      });
    }
    showToast(`${selected.length} ${selected.length === 1 ? 'Μερίδα μεταφέρθηκε' : 'Μερίδες μεταφέρθηκαν'} στο αρχείο.`);
    await renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast, null, 'archive');
  }, showToast));

  container.querySelector('[data-preview-archive-table]')?.addEventListener('click', async () => run(async () => {
    openArchivedSharesPreview(container.querySelector('[data-archived-shares-table]'));
  }, showToast));

  container.addEventListener('click', async (event) => {
    const openHandover = event.target.closest('[data-open-handover]');
    const previewHandover = event.target.closest('[data-preview-handover]');
    const restoreShare = event.target.closest('[data-restore-share]');
    const complete = event.target.closest('#handover-complete');
    const saveProtocol = event.target.closest('#handover-protocol-save');
    const previewProtocol = event.target.closest('#handover-protocol-preview');
    if (!openHandover && !previewHandover && !restoreShare && !complete && !saveProtocol && !previewProtocol) return;
    await run(async () => {
      if (openHandover) {
        await renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast, Number(openHandover.dataset.openHandover));
      } else if (previewHandover) {
        const handoverId = Number(previewHandover.dataset.previewHandover);
        if (selectedHandover?.id === handoverId) {
          await api.updateHandoverProtocol(handoverId, collectHandoverProtocol(container));
        }
        const handover = await api.getHandover(handoverId);
        openHandoverProtocolDocument(handover, settings, showToast);
      } else if (restoreShare) {
        const result = await api.restoreShare(Number(restoreShare.dataset.restoreShare), data.today);
        showToast(result.message);
        await renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast);
      } else if (complete) {
        const protocolData = collectHandoverProtocol(container);
        await api.updateHandoverProtocol(Number(complete.dataset.handoverId), protocolData);
        const result = await api.completeHandover(Number(complete.dataset.handoverId), {
          completionDate: value(container, '#handover-completion-date'),
          outgoingObservations: protocolData.outgoingObservations,
          incomingObservations: protocolData.receivingObservations
        });
        showToast(result.message);
        await renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast, Number(complete.dataset.handoverId));
      } else if (saveProtocol) {
        const result = await api.updateHandoverProtocol(
          Number(saveProtocol.dataset.handoverId),
          collectHandoverProtocol(container)
        );
        showToast(result.message);
      } else if (previewProtocol) {
        const protocolData = collectHandoverProtocol(container);
        await api.updateHandoverProtocol(selectedHandover.id, protocolData);
        openHandoverProtocolDocument(
          { ...selectedHandover, protocolData },
          settings,
          showToast
        );
      }
    }, showToast);
  });

  container.querySelectorAll('[data-handover-check]').forEach((checkbox) => {
    checkbox.addEventListener('change', async () => run(async () => {
      const id = Number(checkbox.dataset.handoverCheck);
      await api.updateHandoverCheck(id, {
        completed: checkbox.checked,
        notes: container.querySelector(`[data-handover-check-notes="${id}"]`).value
      });
      showToast('Ο έλεγχος ενημερώθηκε.');
    }, showToast));
  });

}

function openHandoverProtocolDocument(handover, settings, showToast) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop handover-document-backdrop';
  modal.innerHTML = `
    <section class="request-document-modal handover-document-modal">
      <header class="material-card-header no-print">
        <div>
          <p class="eyebrow">ΠΡΩΤΟΚΟΛΛΟ ${handover.serialNumber}</p>
          <h2>Παράδοση - Παραλαβή Γενικής Διαχείρισης</h2>
        </div>
        <div class="row-actions">
          <button class="secondary-button" data-close-handover-document type="button">Κλείσιμο</button>
          <button class="primary-button" data-print-handover-document type="button">Εκτύπωση</button>
        </div>
      </header>
      <div class="handover-document-preview">
        ${renderOfficialHandoverProtocol(
          settings,
          handover
        )}
      </div>
    </section>
  `;

  const closeButton = modal.querySelector('[data-close-handover-document]');
  const printButton = modal.querySelector('[data-print-handover-document]');
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation();
    modal.remove();
  });
  printButton.addEventListener('click', async (event) => {
    event.stopPropagation();
    try {
      await printHandoverDocument(modal.querySelector('.handover-document-preview'));
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η εκτύπωση του ΕΦΕΔ 500.', 'error');
    }
  });
  modal.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.remove();
    }
  });
  document.body.appendChild(modal);
}

async function printHandoverDocument(preview) {
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = preview.innerHTML;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({ landscape: false });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

function collectHandoverProtocol(container) {
  return {
    inventoryStatementDate: value(container, '#handover-protocol-inventory-date'),
    shareRangeFrom: value(container, '#handover-protocol-share-from'),
    shareRangeTo: value(container, '#handover-protocol-share-to'),
    sampleCountingDetails: value(container, '#handover-protocol-sample-details'),
    samplePercentageWords: value(container, '#handover-protocol-sample-words'),
    samplePercentageNumber: value(container, '#handover-protocol-sample-number'),
    fullCountCompleted: Boolean(container.querySelector('#handover-protocol-full-count')?.checked),
    surplusesReference: value(container, '#handover-protocol-surpluses'),
    deficitsReference: value(container, '#handover-protocol-deficits'),
    inventoryInspectionReference: value(container, '#handover-protocol-inventory-reference'),
    inventoryInspectionDate: value(container, '#handover-protocol-inspection-date'),
    inventoryInspectionType: value(container, '#handover-protocol-inspection-type'),
    financialInspectionReference: value(container, '#handover-protocol-financial-reference'),
    financialInspectionDate: value(container, '#handover-protocol-financial-date'),
    financialInspectionType: value(container, '#handover-protocol-financial-type'),
    separateStorage: value(container, '#handover-protocol-separate-storage'),
    separateStorageDescription: value(container, '#handover-protocol-storage-description'),
    highValueSecurity: value(container, '#handover-protocol-high-value'),
    fuelSecurity: value(container, '#handover-protocol-fuel'),
    managementPending: value(container, '#handover-protocol-pending'),
    receivingObservations: value(container, '#handover-protocol-receiving-notes'),
    outgoingObservations: value(container, '#handover-protocol-outgoing-notes'),
    generalManagerAssistants: value(container, '#handover-protocol-general-assistants'),
    accountingSupervisor: value(container, '#handover-protocol-accounting-supervisor'),
    assistants: [...container.querySelectorAll('[data-handover-assistant]')].map((row) =>
      Object.fromEntries(
        [...row.querySelectorAll('[data-assistant-field]')].map((input) => [
          input.dataset.assistantField,
          input.value
        ])
      )
    )
  };
}

function renderOfficerIdentity(value) {
  const officer = splitOfficerSignature(value);
  return `<strong>${escapeHtml(officer.name)}</strong><em>${escapeHtml(officer.rank)}</em>`;
}

export async function printArchivedSharesTable(table) {
  if (!table) return;
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  printRoot.innerHTML = `
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      .archived-shares-print { color: #000; background: #fff; font-family: Arial, sans-serif; }
      .archived-shares-print h2 { margin: 0 0 8mm; font-size: 18pt; }
      .archived-shares-print table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 10pt; }
      .archived-shares-print th, .archived-shares-print td { border: 1px solid #555; padding: 2mm; text-align: left; }
      .archived-shares-print th { background: #e8eef5; }
      .archived-shares-print .no-print { display: none !important; }
    </style>
    <section class="archived-shares-print print-document-area">
      <h2>Αρχειοθετημένες Μερίδες</h2>
      ${renderArchivedSharesDocument(table)}
    </section>`;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({ landscape: true });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

export function openArchivedSharesPreview(table) {
  if (!table) return;
  document.querySelector('.archived-shares-preview-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop archived-shares-preview-backdrop';
  backdrop.innerHTML = `
    <section class="request-document-modal archived-shares-preview-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">ΑΡΧΕΙΟ ΜΕΡΙΔΩΝ</p><h2>Αρχειοθετημένες Μερίδες</h2></div>
        <div class="row-actions">
          <button class="primary-button" data-print-archive-table type="button">Εκτύπωση</button>
          <button class="secondary-button" data-close-archive-preview type="button">Κλείσιμο</button>
        </div>
      </header>
      <div class="request-document-preview archived-shares-preview-content">
        ${renderArchivedSharesDocument(table)}
      </div>
    </section>`;
  backdrop.addEventListener('click', async (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-archive-preview]')) {
      backdrop.remove();
      return;
    }
    if (event.target.closest('[data-print-archive-table]')) {
      await printArchivedSharesTable(backdrop.querySelector('[data-archived-shares-table]'));
    }
  });
  document.body.appendChild(backdrop);
}

function renderArchivedSharesDocument(table) {
  const documentTable = table.cloneNode(true);
  documentTable.classList.add('archived-shares-document-table');
  documentTable.querySelectorAll('.no-print').forEach((element) => element.remove());
  return `
    <article class="archived-shares-document print-document-area">
      <div class="archived-shares-document-heading">
        <span>ΑΡΧΕΙΟ ΜΕΡΙΔΩΝ ΥΛΙΚΟΥ</span>
        <h2>Αρχειοθετημένες Μερίδες</h2>
      </div>
      ${documentTable.outerHTML}
    </article>
  `;
}

async function printAmmunitionBatchTable(table, title = 'Βιβλίο Μερίδων Β.Φ.') {
  if (!table) return;
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root';
  const printableTable = table.cloneNode(true);
  printableTable.querySelectorAll('.no-print').forEach((cell) => cell.remove());
  printableTable.querySelectorAll('[colspan="9"]').forEach((cell) => cell.setAttribute('colspan', '8'));
  printableTable.querySelectorAll('input, select').forEach((input) => {
    const text = document.createElement('span');
    text.textContent = input.tagName === 'SELECT'
      ? input.value || ''
      : input.value;
    input.replaceWith(text);
  });
  printRoot.innerHTML = `
    <style>
      @page { size: A4 landscape; margin: 10mm; }
      .ammunition-batch-print { color: #000; background: #fff; font-family: Arial, sans-serif; }
      .ammunition-batch-print table { width: 100%; border-collapse: collapse; font-size: 10pt; }
      .ammunition-batch-print th, .ammunition-batch-print td { border: 1px solid #555; padding: 2mm; text-align: left; }
      .ammunition-batch-print th { background: #e8eef5; }
      .ammunition-batch-print .no-print { display: none !important; }
    </style>
    <section class="ammunition-batch-print print-document-area">${printableTable.outerHTML}</section>`;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await window.appApi.print.currentDocument({ landscape: true });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

function openAmmunitionBatchPreview(table, title) {
  if (!table) return;
  document.querySelector('.ammunition-batch-preview-backdrop')?.remove();
  const printableTable = table.cloneNode(true);
  printableTable.querySelectorAll('.no-print').forEach((cell) => cell.remove());
  printableTable.querySelectorAll('[colspan="9"]').forEach((cell) => cell.setAttribute('colspan', '8'));
  printableTable.querySelectorAll('input, select').forEach((control) => {
    const text = document.createElement('span');
    text.textContent = control.tagName === 'SELECT'
      ? control.value || ''
      : control.value;
    control.replaceWith(text);
  });
  const rowsPerPage = 20;
  const tableHead = printableTable.querySelector('thead')?.outerHTML || '';
  const rows = [...printableTable.querySelectorAll('tbody > tr')];
  const pageCount = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const pages = Array.from({ length: pageCount }, (_, pageIndex) => {
    const pageNumber = pageIndex + 1;
    const pageRows = rows
      .slice(pageIndex * rowsPerPage, pageNumber * rowsPerPage)
      .map((row) => row.outerHTML)
      .join('');
    return `
      <article class="ammunition-batch-preview-page">
        <table class="ammunition-batch-registry-table">${tableHead}<tbody>${pageRows}</tbody></table>
        <footer>Σελίδα ${pageNumber} από Σελίδες ${pageCount}</footer>
      </article>`;
  }).join('');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop request-document-backdrop ammunition-batch-preview-backdrop';
  backdrop.innerHTML = `
    <section class="request-document-modal archived-shares-preview-modal">
      <header class="material-card-header no-print">
        <div><p class="eyebrow">ΠΡΟΕΠΙΣΚΟΠΗΣΗ</p><h2>${escapeHtml(title)}</h2></div>
        <div class="row-actions">
          <button class="primary-button" data-print-training-ammunition-preview
            data-export-title="${escapeHtml(title)}" data-export-orientation="landscape" type="button">Εκτύπωση</button>
          <button class="secondary-button" data-close-ammunition-preview type="button">Κλείσιμο</button>
        </div>
      </header>
      <div class="request-document-preview archived-shares-preview-content">
        <style>
          .ammunition-batch-preview-pages { display: grid; gap: 18px; }
          .ammunition-batch-preview-page { position: relative; box-sizing: border-box; width: min(100%, 297mm); min-height: 210mm; padding: 12mm 12mm 15mm; background: #fff; color: #000; font-family: Arial, sans-serif; }
          .ammunition-batch-preview-page table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 9pt; }
          .ammunition-batch-preview-page th, .ammunition-batch-preview-page td { padding: 2mm; border: 1px solid #555; color: #000; text-align: left; }
          .ammunition-batch-preview-page th { background: #e8eef5; }
          .ammunition-batch-preview-page footer { position: absolute; right: 12mm; bottom: 7mm; font-size: 9pt; }
          .ammunition-batch-preview-page:not(:last-child) { break-after: page; page-break-after: always; }
        </style>
        <section class="ammunition-batch-preview-pages print-document-area">${pages}</section>
      </div>
    </section>`;
  backdrop.addEventListener('click', async (event) => {
    if (event.target === backdrop || event.target.closest('[data-close-ammunition-preview]')) {
      backdrop.remove();
      return;
    }
    if (event.target.closest('[data-print-training-ammunition-preview]')) {
      await printAmmunitionBatchPreview(backdrop.querySelector('.archived-shares-preview-content'));
    }
  });
  document.body.appendChild(backdrop);
}

async function printAmmunitionBatchPreview(previewContent) {
  if (!previewContent) return;
  const printRoot = document.createElement('div');
  printRoot.className = 'isolated-print-root ammunition-batch-preview-print-root';
  printRoot.innerHTML = previewContent.innerHTML;
  document.body.dataset.isolatedDocumentPrint = 'true';
  document.body.appendChild(printRoot);
  try {
    await new Promise((resolve) => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
    await window.appApi.print.currentDocument({ landscape: true });
  } finally {
    printRoot.remove();
    delete document.body.dataset.isolatedDocumentPrint;
  }
}

async function run(operation, showToast) {
  try {
    await operation();
  } catch (error) {
    showToast(error.message || 'Δεν ήταν δυνατή η ενέργεια.', 'error');
  }
}

function value(container, selector) {
  return container.querySelector(selector)?.value || '';
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

function formatQuantity(value) {
  return new Intl.NumberFormat('el-GR', { maximumFractionDigits: 3, useGrouping: false }).format(Number(value || 0));
}

