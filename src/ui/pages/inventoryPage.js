import { escapeHtml } from '../components/forms.js';
import { renderInventoryStatement } from './printsPage.js';

export async function renderInventoryPage(
  container,
  inventoryApi,
  settingsApi,
  showToast,
  selectedSessionId = null,
  activeTab = 'counts'
) {
  let [referenceData, settings] = await Promise.all([
    inventoryApi.getReferenceData(),
    settingsApi.get()
  ]);
  const selectedId = selectedSessionId || referenceData.sessions[0]?.id || null;
  const selectedSession = selectedId ? await inventoryApi.getSession(selectedId) : null;
  const statementSession = selectedId ? selectedSession : null;
  if (selectedSession) {
    const datedReference = await inventoryApi.getReferenceData(selectedSession.inventoryDate);
    referenceData = { ...datedReference, sessions: referenceData.sessions };
  }

  container.innerHTML = `
    <section class="page-header">
      <div>
        <p class="eyebrow">ΓΕΝΙΚΗ ΔΙΑΧΕΙΡΙΣΗ</p>
        <h2>Απογραφές Υλικού</h2>
      </div>
    </section>

    ${activeTab === 'statement'
      ? renderInventoryStatementTab(settings, statementSession)
      : `
        <section class="page-panel">
          <h3>Νέα Απογραφή</h3>
          <div class="inventory-session-grid">
            <label class="field">
              <span>Ημερομηνία</span>
              <input id="inventory-date" type="date" value="${referenceData.today}" />
            </label>
            <label class="field">
              <span>Τίτλος</span>
              <input id="inventory-title" value="Ετήσια Απογραφή Γενικής Διαχείρισης" />
            </label>
            <label class="field">
              <span>Αιτιολογία</span>
              <select id="inventory-reason">
                <option value="Τακτική Απογραφή">Τακτική Απογραφή</option>
                <option value="Ετήσια απογραφή Διαχείρισης">Ετήσια απογραφή Διαχείρισης</option>
              </select>
            </label>
            <label class="field">
              <span>Παρατηρήσεις</span>
              <input id="inventory-session-notes" autocomplete="off" />
            </label>
            <fieldset class="inventory-committee-fields">
              <legend>Επιτροπή Καταμέτρησης</legend>
              ${renderCommitteeMemberFields('Πρόεδρος', 'president')}
              ${renderCommitteeMemberFields('Α΄ Μέλος', 'member-a')}
              ${renderCommitteeMemberFields('Β΄ Μέλος', 'member-b')}
            </fieldset>
            <button id="inventory-create" class="primary-button" type="button">Δημιουργία</button>
          </div>
        </section>

        <section class="page-panel">
          <h3>Καταχωρημένες Απογραφές</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Α/Α</th><th>Ημερομηνία</th><th>Τίτλος</th><th>Κατάσταση</th>
                  <th>Μερίδες</th><th>Διαφορές</th><th></th>
                </tr>
              </thead>
              <tbody>${renderSessionRows(referenceData.sessions, selectedId)}</tbody>
            </table>
          </div>
        </section>

        ${selectedSession ? renderSelectedSession(selectedSession, referenceData.shares) : renderEmptySession()}
      `}
  `;

  bindInventoryPage(container, inventoryApi, settingsApi, referenceData, selectedSession, showToast, activeTab);
}

function renderInventoryStatementTab(settings, selectedSession) {
  const preview = selectedSession
    ? renderInventoryStatement(settings, selectedSession)
    : '<section class="page-panel empty-table">Δεν υπάρχουν απογραφές.</section>';
  return `
    <section class="page-panel no-print">
      <h3>Κατάσταση Απογραφής</h3>
      <div class="registry-controls">
        <button id="inventory-statement-back" class="secondary-button" type="button">Πίσω στις Απογραφές</button>
        <button id="inventory-statement-print" class="primary-button" type="button" ${selectedSession ? '' : 'disabled'}>Εκτύπωση</button>
      </div>
    </section>
    <section id="inventory-statement-preview" class="print-preview-shell">
      ${preview}
    </section>
  `;
}

function renderSelectedSession(session, shares) {
  const locked = session.status === 'Ολοκληρωμένη';
  return `
    <section class="page-panel inventory-workspace">
      <div class="requests-status-header">
        <div>
          <h3>${escapeHtml(session.title)}</h3>
          <p class="muted">Απογραφή ${session.serialNumber} · ${formatDate(session.inventoryDate)}</p>
        </div>
        ${locked ? '<span class="status-pill balanced">Ολοκληρωμένη</span>' : '<button id="inventory-complete" class="primary-button" type="button">Ολοκλήρωση και Κλείδωμα</button>'}
      </div>
      <fieldset class="inventory-committee-fields inventory-selected-committee">
        <legend>Επιτροπή Καταμέτρησης</legend>
        ${renderCommitteeMemberFields('Πρόεδρος', 'selected-president', session.committeePresidentRank, session.committeePresidentName)}
        ${renderCommitteeMemberFields('Α΄ Μέλος', 'selected-member-a', session.committeeMemberARank, session.committeeMemberAName)}
        ${renderCommitteeMemberFields('Β΄ Μέλος', 'selected-member-b', session.committeeMemberBRank, session.committeeMemberBName)}
        <button id="inventory-save-committee" class="secondary-button" type="button">Αποθήκευση Επιτροπής</button>
      </fieldset>
      ${
        locked
          ? ''
          : `
            <div class="inventory-count-grid">
              <label class="field">
                <span>Αριθμός Μερίδας</span>
                <select id="inventory-share">
                  <option value="">Επιλογή</option>
                  ${shares.map((share) => `<option value="${share.id}">${escapeHtml(share.shareNumber)}</option>`).join('')}
                </select>
              </label>
              <label class="field"><span>Αριθμός Ονομαστικού</span><input id="inventory-nominal" readonly /></label>
              <label class="field"><span>Μονάδα Μέτρησης</span><input id="inventory-measurement" readonly /></label>
              <label class="field"><span>Λογιστικό</span><input id="inventory-accounting" readonly /></label>
              <label class="field"><span>Σε Μερικές</span><input id="inventory-partial" readonly /></label>
              <label class="field"><span>Αναμενόμενο Αποθήκης</span><input id="inventory-expected" readonly /></label>
              <label class="field"><span>1η Καταμέτρηση</span><input id="inventory-first-count" type="number" min="0" step="0.001" /></label>
              <label class="field"><span>2η Καταμέτρηση</span><input id="inventory-second-count" type="number" min="0" step="0.001" /></label>
              <label class="field inventory-count-notes"><span>Παρατηρήσεις</span><input id="inventory-count-notes" /></label>
              <button id="inventory-save-count" class="primary-button" type="button">Καταχώριση</button>
            </div>
          `
      }
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Μερίδα</th><th>Αριθμός Ονομαστικού</th><th>Περιγραφή</th>
              <th class="number-cell">Λογιστικό</th><th class="number-cell">Σε Μερικές</th>
              <th class="number-cell">Αναμενόμενο Αποθήκης</th>
              <th class="number-cell">1η</th><th class="number-cell">2η</th>
              <th class="number-cell">Τελική</th><th class="number-cell">Διαφορά</th><th>Κατάσταση</th>
            </tr>
          </thead>
          <tbody>${renderInventoryItemRows(session.items)}</tbody>
        </table>
      </div>
    </section>
  `;
}

function renderEmptySession() {
  return '<section class="page-panel empty-table">Δημιούργησε απογραφή για να ξεκινήσεις καταμετρήσεις.</section>';
}

function bindInventoryPage(container, inventoryApi, settingsApi, referenceData, selectedSession, showToast, activeTab) {
  container.querySelector('#inventory-statement-back')?.addEventListener('click', async () => {
    await renderInventoryPage(
      container,
      inventoryApi,
      settingsApi,
      showToast,
      selectedSession?.id || null
    );
  });

  container.querySelector('#inventory-statement-print')?.addEventListener('click', async () => {
    const preview = container.querySelector('#inventory-statement-preview');
    if (preview) await printInventoryStatementPreview(preview);
  });

  if (activeTab === 'statement') return;

  container.querySelector('#inventory-create').addEventListener('click', async () => {
    try {
      const result = await inventoryApi.createSession({
        inventoryDate: container.querySelector('#inventory-date').value,
        inventoryReason: container.querySelector('#inventory-reason').value,
        title: container.querySelector('#inventory-title').value,
        notes: container.querySelector('#inventory-session-notes').value,
        committeePresidentRank: container.querySelector('#inventory-president-rank').value,
        committeePresidentName: container.querySelector('#inventory-president-name').value,
        committeeMemberARank: container.querySelector('#inventory-member-a-rank').value,
        committeeMemberAName: container.querySelector('#inventory-member-a-name').value,
        committeeMemberBRank: container.querySelector('#inventory-member-b-rank').value,
        committeeMemberBName: container.querySelector('#inventory-member-b-name').value
      });
      showToast(result.message);
      await renderInventoryPage(container, inventoryApi, settingsApi, showToast, result.id);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η δημιουργία της απογραφής.', 'error');
    }
  });

  container.addEventListener('click', async (event) => {
    const openButton = event.target.closest('[data-open-inventory]');
    if (openButton) {
      await renderInventoryPage(
        container,
        inventoryApi,
        settingsApi,
        showToast,
        Number(openButton.dataset.openInventory),
        'statement'
      );
      return;
    }

  });

  if (!selectedSession) return;

  container.querySelector('#inventory-save-committee').addEventListener('click', async () => {
    try {
      const result = await inventoryApi.saveCommittee(selectedSession.id, {
        committeePresidentRank: container.querySelector('#inventory-selected-president-rank').value,
        committeePresidentName: container.querySelector('#inventory-selected-president-name').value,
        committeeMemberARank: container.querySelector('#inventory-selected-member-a-rank').value,
        committeeMemberAName: container.querySelector('#inventory-selected-member-a-name').value,
        committeeMemberBRank: container.querySelector('#inventory-selected-member-b-rank').value,
        committeeMemberBName: container.querySelector('#inventory-selected-member-b-name').value
      });
      showToast(result.message);
      await renderInventoryPage(container, inventoryApi, settingsApi, showToast, selectedSession.id);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η αποθήκευση της επιτροπής.', 'error');
    }
  });

  if (selectedSession.status === 'Ολοκληρωμένη') return;

  const shareSelect = container.querySelector('#inventory-share');
  shareSelect.addEventListener('change', () => {
    const share = referenceData.shares.find((item) => item.id === Number(shareSelect.value));
    applyInventoryShare(container, share);
  });

  container.querySelector('#inventory-save-count').addEventListener('click', async () => {
    try {
      const result = await inventoryApi.saveCount({
        sessionId: selectedSession.id,
        shareId: Number(shareSelect.value),
        firstCount: container.querySelector('#inventory-first-count').value,
        secondCount: container.querySelector('#inventory-second-count').value,
        notes: container.querySelector('#inventory-count-notes').value
      });
      showToast(`${result.message} ${result.differenceStatus}: ${formatSigned(result.difference)}.`);
      await renderInventoryPage(container, inventoryApi, settingsApi, showToast, selectedSession.id);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η καταχώριση.', 'error');
    }
  });

  container.querySelector('#inventory-complete').addEventListener('click', async () => {
    try {
      const result = await inventoryApi.completeSession(selectedSession.id);
      showToast(result.message);
      await renderInventoryPage(container, inventoryApi, settingsApi, showToast, selectedSession.id);
    } catch (error) {
      showToast(error.message || 'Δεν ήταν δυνατή η ολοκλήρωση.', 'error');
    }
  });
}

async function printInventoryStatementPreview(preview) {
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

function renderCommitteeMemberFields(label, id, rank = '', name = '') {
  return `
    <div class="inventory-committee-member">
      <strong>${label}</strong>
      <label class="field">
        <span>Βαθμός</span>
        <input id="inventory-${id}-rank" value="${escapeHtml(rank)}" data-preserve-case="true" autocomplete="off" />
      </label>
      <label class="field">
        <span>Ονοματεπώνυμο</span>
        <input id="inventory-${id}-name" value="${escapeHtml(name)}" data-preserve-case="true" autocomplete="off" />
      </label>
    </div>
  `;
}

function applyInventoryShare(container, share) {
  container.querySelector('#inventory-nominal').value = share?.nominalNumber || '';
  container.querySelector('#inventory-measurement').value = share?.measurementUnit || '';
  container.querySelector('#inventory-accounting').value = share ? formatQuantity(share.accountingBalance) : '';
  container.querySelector('#inventory-partial').value = share ? formatQuantity(share.partialManagementQuantity) : '';
  container.querySelector('#inventory-expected').value = share ? formatQuantity(share.expectedWarehouseQuantity) : '';
}

function renderSessionRows(sessions, selectedId) {
  if (!sessions.length) return '<tr><td colspan="7" class="empty-table">Δεν υπάρχουν απογραφές.</td></tr>';
  return sessions.map((session) => `
    <tr class="${session.id === selectedId ? 'selected-row' : ''}">
      <td>${session.serialNumber}</td>
      <td>${formatDate(session.inventoryDate)}</td>
      <td>${escapeHtml(session.title)}</td>
      <td>${escapeHtml(session.status)}</td>
      <td>${session.itemCount}</td>
      <td>${session.differenceCount}</td>
      <td><button class="secondary-button" data-open-inventory="${session.id}" type="button">Προβολή</button></td>
    </tr>
  `).join('');
}

function renderInventoryItemRows(items) {
  if (!items.length) return '<tr><td colspan="11" class="empty-table">Δεν έχουν καταχωριστεί μερίδες.</td></tr>';
  return items.map((item) => `
    <tr>
      <td>${escapeHtml(item.shareNumber)}</td>
      <td>${escapeHtml(item.nominalNumber)}</td>
      <td class="material-description-cell">${escapeHtml(item.description)}</td>
      <td class="number-cell">${formatQuantity(item.accountingBalance)}</td>
      <td class="number-cell">${formatQuantity(item.partialManagementQuantity)}</td>
      <td class="number-cell">${formatQuantity(item.expectedWarehouseQuantity)}</td>
      <td class="number-cell">${formatQuantity(item.firstCount)}</td>
      <td class="number-cell">${item.secondCount === null ? '' : formatQuantity(item.secondCount)}</td>
      <td class="number-cell">${formatQuantity(item.finalCount)}</td>
      <td class="number-cell ${differenceTone(item.difference)}">${formatSigned(item.difference)}</td>
      <td>${escapeHtml(item.differenceStatus)}</td>
    </tr>
  `).join('');
}

function differenceTone(value) {
  return Number(value) > 0 ? 'surplus' : Number(value) < 0 ? 'deficit' : 'balanced';
}

function formatQuantity(value) {
  return Number(value).toLocaleString('el-GR', { maximumFractionDigits: 3 });
}

function formatSigned(value) {
  const number = Number(value);
  return `${number > 0 ? '+' : ''}${formatQuantity(number)}`;
}

function formatDate(value) {
  if (!value) return '';
  const [year, month, day] = String(value).split('-');
  return year && month && day ? `${day}/${month}/${year}` : value;
}
