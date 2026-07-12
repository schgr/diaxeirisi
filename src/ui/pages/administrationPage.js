import { escapeHtml } from '../components/forms.js';
import { splitOfficerSignature } from '../officerSignature.js';
import { renderOfficialHandoverProtocol } from '../handoverProtocol.js';

export async function renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast, selectedHandoverId = null) {
  const [data, settings] = await Promise.all([
    api.getReferenceData(),
    settingsApi.get()
  ]);
  const selectedHandover = selectedHandoverId ? await api.getHandover(selectedHandoverId) : null;

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΓΕΝΙΚΗ ΔΙΑΧΕΙΡΙΣΗ</p>
        <h2>Παράδοση - Παραλαβή και Αρχείο Μερίδων</h2>
      </div>
    </section>

    <section class="transaction-flow-home contextual-tile-menu administration-tile-menu" data-administration-menu>
      <button class="home-tile transaction-flow-tile" data-administration-tab="handover" type="button"><span class="home-tile-icon">ΠΠ</span><span class="home-tile-title">Παράδοση - Παραλαβή</span><span class="home-tile-code">§ ΔΧ-Α</span></button>
      <button class="home-tile transaction-flow-tile" data-administration-tab="archive" type="button"><span class="home-tile-icon">ΑΜ</span><span class="home-tile-title">Αρχείο Μερίδων</span><span class="home-tile-code">§ ΔΧ-Β</span></button>
      <button class="home-tile transaction-flow-tile" data-administration-tab="aggregate-prints" type="button"><span class="home-tile-icon">ΣΕ</span><span class="home-tile-title">Συγκεντρωτικές Εκτυπώσεις</span><span class="home-tile-code">§ ΔΧ-Γ</span></button>
    </section>
    <div data-administration-panel="handover" hidden>
      ${renderHandoverPanel(data, selectedHandover, settings)}
    </div>
    <div data-administration-panel="archive" hidden>
      ${renderArchivePanel(data)}
    </div>
    <div data-administration-panel="aggregate-prints" hidden>
      ${renderAggregatePrintsPanel()}
    </div>
  `;

  bindAdministrationPage(container, api, annualAccountsApi, settingsApi, data, selectedHandover, settings, showToast);
}

function renderHandoverPanel(data, selected, settings) {
  const manager = settings.financialOfficers.manager || '';
  return `
    <section class="page-panel">
      <h3>Νέο Πρωτόκολλο Παράδοσης Γενικής Διαχείρισης</h3>
      <div class="administration-form-grid">
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
          <thead><tr><th>Α/Α</th><th>Ημερομηνία Παράδοσης</th><th>Παραδίδων</th><th>Παραλαμβάνων</th><th>Απογραφή</th><th>Έλεγχοι</th><th>Κατάσταση</th><th></th></tr></thead>
          <tbody>
            ${data.handovers.length ? data.handovers.map((item) => `
              <tr>
                <td>${item.serialNumber}</td><td>${formatDate(item.completionDate || item.startDate)}</td>
                <td>${escapeHtml(manager || item.outgoingOfficer)}</td><td>${escapeHtml(item.incomingOfficer)}</td>
                <td>${escapeHtml(item.inventoryReference || '-')}</td>
                <td>${item.completedCheckCount}/${item.checkCount}</td>
                <td><span class="status-pill ${item.status === 'Ολοκληρωμένη' ? 'balanced' : 'pending'}">${escapeHtml(item.status)}</span></td>
                <td><div class="row-actions"><button data-preview-handover="${item.id}" class="secondary-button" type="button">Άνοιγμα</button><button data-open-handover="${item.id}" class="secondary-button" type="button">Επεξεργασία</button></div></td>
              </tr>
            `).join('') : '<tr><td colspan="8" class="empty-table">Δεν υπάρχουν πρωτόκολλα παράδοσης.</td></tr>'}
          </tbody>
        </table>
      </div>
    </section>
    ${selected ? renderHandoverWorkspace(selected, data.today, settings) : ''}
  `;
}

function renderAggregatePrintsPanel() {
  return `
    <section class="page-panel">
      <h3>Συγκεντρωτικές Εκτυπώσεις</h3>
      <p class="muted">Προσωρινή θέση για εκτυπώσεις πολλών μερίδων, ευρετηρίων και ετών.</p>
      <div class="row-actions">
        <button class="primary-button" data-open-aggregate-prints type="button">Άνοιγμα Εκτυπώσεων</button>
      </div>
    </section>
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

function renderArchivePanel(data) {
  const eligible = data.activeShares.filter((share) => share.accountingBalance === 0 && share.chargedQuantity === 0);
  return `
    <section class="page-panel">
      <h3>Αρχειοθέτηση Ανενεργής Μερίδας</h3>
      <p class="muted">Επιτρέπεται μόνο για Μερίδα με μηδενικό λογιστικό και μηδενικό χρεωμένο υπόλοιπο.</p>
      <div class="administration-form-grid">
        <label class="field administration-wide-field"><span>Μερίδα</span><select id="archive-share"><option value="">Επιλογή</option>${eligible.map((share) => `<option value="${share.id}">${escapeHtml(share.shareNumber)} · ${escapeHtml(share.nominalNumber)} · ${escapeHtml(share.description)}</option>`).join('')}</select></label>
        <label class="field"><span>Ημερομηνία</span><input id="archive-date" type="date" value="${data.today}" /></label>
        <label class="field administration-wide-field"><span>Αιτιολογία</span><input id="archive-reason" placeholder="Κατάργηση είδους, μεταβολή ΑΟ ή άλλη διαταγή" /></label>
        <button id="archive-submit" class="primary-button" type="button">Αρχειοθέτηση</button>
      </div>
      ${eligible.length ? '' : '<p class="empty-table">Δεν υπάρχουν Μερίδες που πληρούν τις προϋποθέσεις.</p>'}
    </section>
    <section class="page-panel">
      <h3>Αρχειοθετημένες Μερίδες</h3>
      <div class="table-wrap">
        <table class="index-table administration-table">
          <thead><tr><th>Μερίδα</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th><th>Ημερομηνία</th><th>Αιτιολογία</th><th></th></tr></thead>
          <tbody>${data.archivedShares.length ? data.archivedShares.map((share) => `
            <tr><td>${escapeHtml(share.shareNumber)}</td><td>${escapeHtml(share.nominalNumber)}</td><td class="material-description-cell">${escapeHtml(share.description)}</td><td>${formatDate(share.archivedAt)}</td><td>${escapeHtml(share.archiveReason)}</td><td><button data-restore-share="${share.id}" class="secondary-button" type="button">Επαναφορά</button></td></tr>
          `).join('') : '<tr><td colspan="6" class="empty-table">Δεν υπάρχουν αρχειοθετημένες Μερίδες.</td></tr>'}</tbody>
        </table>
      </div>
    </section>
  `;
}

function bindAdministrationPage(container, api, annualAccountsApi, settingsApi, data, selectedHandover, settings, showToast) {
  const menu = container.querySelector('[data-administration-menu]');
  container.querySelectorAll('[data-administration-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const tab = button.dataset.administrationTab;
      menu.querySelectorAll('[data-administration-tab]').forEach((item) => {
        item.classList.toggle('active', item === button);
        item.setAttribute('aria-pressed', item === button ? 'true' : 'false');
      });
      container.querySelectorAll('[data-administration-panel]').forEach((panel) => {
        panel.hidden = panel.dataset.administrationPanel !== tab;
      });
    });
  });

  if (selectedHandover) {
    container.querySelector('[data-administration-tab="handover"]').click();
  }

  container.querySelector('[data-open-aggregate-prints]')?.addEventListener('click', () => {
    // TODO: Move each aggregate report to its final contextual home as the print page is retired.
    document.dispatchEvent(new CustomEvent('diaxeirisi:navigate', {
      detail: { sectionId: 'prints' }
    }));
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

  container.querySelector('#archive-submit').addEventListener('click', async () => run(async () => {
    const result = await api.archiveShare({
      shareId: Number(value(container, '#archive-share')),
      actionDate: value(container, '#archive-date'),
      reason: value(container, '#archive-reason')
    });
    showToast(result.message);
    await renderAdministrationPage(container, api, annualAccountsApi, settingsApi, showToast);
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
